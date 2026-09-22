#!/usr/bin/env node
/**
 * CLI: d2c:intake
 *
 * Official Ingestion Pipeline for Raw Plugin Export Payload:
 * raw export payload → adapter/normalizer → unified contract (DesignContext) → package staging → integrity check → release
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { adaptExportResultToDesignContext, type RawExportPayload } from "../normalizer/export-adapter.js";
import { validateContract } from "../contracts/validate.js";
import { createDesignPackage, type PackageInput } from "./package.js";
import type { Diagnostic, DesignPackageManifest } from "../contracts/schema.js";

export interface IntakePipelineOptions {
  rawExportPath: string;
  screenId: string;
  revision: number;
  sourceFileRef?: string;
  releasesBaseDir?: string;
  allowOverwrite?: boolean;
}

export interface IntakePipelineResult {
  success: boolean;
  packagePath?: string;
  manifest?: DesignPackageManifest;
  diagnostics: Diagnostic[];
}

function getCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "0000000000000000000000000000000000000000";
  }
}

export async function runIntakePipeline(options: IntakePipelineOptions): Promise<IntakePipelineResult> {
  const diagnostics: Diagnostic[] = [];

  if (!existsSync(options.rawExportPath)) {
    diagnostics.push({
      code: "EXPORT_FILE_NOT_FOUND",
      message: `Export file not found at: ${options.rawExportPath}`,
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }

  let rawPayload: RawExportPayload;
  try {
    rawPayload = JSON.parse(readFileSync(options.rawExportPath, "utf-8"));
  } catch (err: any) {
    diagnostics.push({
      code: "INVALID_JSON",
      message: `Failed to parse export JSON: ${err.message}`,
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }

  const commitSha = getCommitSha();
  const sourceFileRef = options.sourceFileRef || `figma://file/${options.screenId}`;

  // 1. Adapter: Convert raw ExportResult to canonical DesignContext
  const adapterRes = adaptExportResultToDesignContext(rawPayload, {
    screenId: options.screenId,
    sourceFileRef,
    exporterCommitSha: commitSha,
  });

  if (!adapterRes.success || !adapterRes.designContext) {
    diagnostics.push(...adapterRes.diagnostics);
    return { success: false, diagnostics };
  }

  // 2. Validate DesignContext against unified contract schema
  const contextValidation = validateContract("context", adapterRes.designContext);
  if (!contextValidation.success) {
    diagnostics.push(...contextValidation.diagnostics);
    return { success: false, diagnostics };
  }

  // 3. Build Source Map from DesignNodeContext
  const sourceMapElements: Record<string, { figmaNodeId: string; targetDomId: string }> = {};
  function walkForSourceMap(node: any) {
    if (node && node.sourceNodeId && node.identity) {
      const sanitized = (node.name || "el").toLowerCase().replace(/[^a-z0-9_]/g, "-");
      sourceMapElements[node.identity.semanticId] = {
        figmaNodeId: node.sourceNodeId,
        targetDomId: `${options.screenId}-${sanitized}`,
      };
    }
    for (const child of node.children || []) {
      walkForSourceMap(child);
    }
  }
  walkForSourceMap(adapterRes.designContext.exportedTree);

  const sourceMap = {
    screenId: options.screenId,
    revision: options.revision,
    elements: sourceMapElements,
  };

  // 4. Decode screenshot if present
  let screenshotBuffer: Buffer | undefined;
  if (rawPayload.screenshotBase64) {
    try {
      screenshotBuffer = Buffer.from(rawPayload.screenshotBase64, "base64");
    } catch {}
  }

  // 5. Build PackageInput
  const packageInput: PackageInput = {
    screenId: options.screenId,
    revision: options.revision,
    sourceFileRef,
    rootNodeId: rawPayload.rootNodeId,
    rawFigmaTree: rawPayload.tree as unknown as Record<string, unknown>,
    contextTree: adapterRes.designContext as unknown as Record<string, unknown>,
    sourceMap,
    tokensSnapshot: (rawPayload.variables || {}) as Record<string, unknown>,
    componentsUsed: (rawPayload.componentsUsed || {}) as Record<string, unknown>,
    interactions: [],
    diagnostics: adapterRes.designContext.diagnostics as unknown as Array<Record<string, unknown>>,
    screenshotBuffer,
    provenance: {
      designOrigin: "REAL_FIGMA",
      componentOrigin: "REAL_REPO",
      tokenOrigin: "REAL_FIGMA_VARIABLES",
      dataOrigin: "REAL_BACKEND",
    },
    exporterCommitSha: commitSha,
  };

  // 6. Create package with staging and disk integrity verification
  try {
    const pkgResult = createDesignPackage(
      packageInput,
      options.releasesBaseDir || "design/releases",
      { allowOverwrite: options.allowOverwrite }
    );

    // 7. Validate generated manifest
    const manifestValidation = validateContract("manifest", pkgResult.manifest);
    if (!manifestValidation.success) {
      diagnostics.push(...manifestValidation.diagnostics);
      return { success: false, diagnostics };
    }

    return {
      success: true,
      packagePath: pkgResult.packagePath,
      manifest: pkgResult.manifest,
      diagnostics,
    };
  } catch (err: any) {
    diagnostics.push({
      code: "PACKAGE_CREATION_FAILED",
      message: err.message,
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let rawExportPath = "";
  let screenId = "users_page";
  let revision = 1;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) rawExportPath = resolve(args[++i]);
    else if (args[i] === "--screen" && args[i + 1]) screenId = args[++i];
    else if (args[i] === "--rev" && args[i + 1]) revision = parseInt(args[++i], 10);
  }

  if (!rawExportPath) {
    console.log("Usage: pnpm run d2c:intake --input <export.json> [--screen <screenId>] [--rev <revision>]");
    process.exit(1);
  }

  console.log(`Starting D2C Intake for ${screenId} rev_${revision} from ${rawExportPath}...`);
  const res = await runIntakePipeline({
    rawExportPath,
    screenId,
    revision,
  });

  if (!res.success) {
    console.error("Intake failed with diagnostics:");
    for (const d of res.diagnostics) {
      console.error(`  [${d.severity}] ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  console.log(`✓ Intake successfully validated and published release at: ${res.packagePath}`);
  console.log(`✓ Content Hash: ${res.manifest?.contentHash}`);
}

if (process.argv[1]?.includes("intake.ts")) {
  main().catch((err) => {
    console.error("Fatal intake error:", err);
    process.exit(1);
  });
}
