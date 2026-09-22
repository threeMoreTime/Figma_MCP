/**
 * Design Package Generator & Ingestion CLI
 *
 * Takes raw exported payload (from Figma Plugin or offline fixture),
 * generates normalized design package directory according to 03-export-to-real-code.md:
 * design/releases/<screen>/<revision>/
 *   manifest.json
 *   figma.raw.json
 *   context.json
 *   source-map.json
 *   tokens.snapshot.json
 *   components.used.json
 *   interactions.json
 *   diagnostics.json
 *   screenshots/
 *   assets/
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, renameSync, cpSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { calculateContentHash, canonicalStringify, verifyPackageDiskIntegrity } from "../contracts/hash.js";
import type { DesignPackageManifest, ProvenanceRecord } from "../contracts/schema.js";

export interface PackageInput {
  screenId: string;
  revision: number;
  sourceFileRef: string;
  rootNodeId: string;
  rawFigmaTree: Record<string, unknown>;
  contextTree: Record<string, unknown>;
  sourceMap: Record<string, unknown>;
  tokensSnapshot: Record<string, unknown>;
  componentsUsed: Record<string, unknown>;
  interactions: Array<Record<string, unknown>>;
  diagnostics: Array<Record<string, unknown>>;
  screenshotBuffer?: Buffer;
  provenance: ProvenanceRecord;
  canonicalTokenHash?: string;
  exporterCommitSha?: string;
}

export interface PackageOptions {
  allowOverwrite?: boolean;
}

function getActualGitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown-commit";
  }
}

function getCanonicalTokensHash(): string {
  const p = resolve("tooling/d2c/tokens/canonical-tokens.json");
  if (existsSync(p)) {
    return createHash("sha256").update(readFileSync(p)).digest("hex");
  }
  return "0000000000000000000000000000000000000000000000000000000000000000";
}

export function createDesignPackage(
  input: PackageInput,
  baseDir: string = "design/releases",
  options: PackageOptions = {}
): {
  packagePath: string;
  manifest: DesignPackageManifest;
  contentHash: string;
} {
  // 1. Strict identity and traversal validation
  if (!input.screenId || !/^[a-zA-Z0-9_-]+$/.test(input.screenId)) {
    throw new Error(`Path traversal or invalid screenId: '${input.screenId}'`);
  }
  if (!Number.isInteger(input.revision) || input.revision <= 0) {
    throw new Error(`Invalid revision number: '${input.revision}'. Must be a positive integer.`);
  }

  const pkgDir = resolve(baseDir, input.screenId, `rev_${input.revision}`);

  // 2. Overwrite protection
  if (existsSync(pkgDir) && !options.allowOverwrite) {
    throw new Error(
      `Package revision already exists at ${pkgDir}. Silent overwrite is forbidden; specify a new revision or set allowOverwrite: true.`
    );
  }

  // 3. Staging Directory Pattern: write into temporary staging first
  const stagingDir = resolve(baseDir, input.screenId, `.staging_rev_${input.revision}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const screenshotsDir = join(stagingDir, "screenshots");
  const assetsDir = join(stagingDir, "assets");

  mkdirSync(stagingDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  try {
    const resourceHashes: Record<string, string> = {};

    function writeAndHash(relPath: string, content: string | Buffer): void {
      // Security check for relPath
      if (
        relPath.includes("..") ||
        relPath.startsWith("/") ||
        relPath.startsWith("\\") ||
        /^[a-zA-Z]:/.test(relPath)
      ) {
        throw new Error(`Illegal resource path with traversal attempt: ${relPath}`);
      }
      const fullPath = join(stagingDir, relPath);
      writeFileSync(fullPath, content);
      const hash = createHash("sha256").update(content).digest("hex");
      resourceHashes[relPath] = hash;
    }

    // 1. Raw Figma JSON
    writeAndHash("figma.raw.json", JSON.stringify(input.rawFigmaTree, null, 2));

    // 2. Context JSON
    writeAndHash("context.json", JSON.stringify(input.contextTree, null, 2));

    // 3. Source Map JSON
    writeAndHash("source-map.json", JSON.stringify(input.sourceMap, null, 2));

    // 4. Tokens Snapshot JSON
    writeAndHash("tokens.snapshot.json", JSON.stringify(input.tokensSnapshot, null, 2));

    // 5. Components Used JSON
    writeAndHash("components.used.json", JSON.stringify(input.componentsUsed, null, 2));

    // 6. Interactions JSON
    writeAndHash("interactions.json", JSON.stringify(input.interactions, null, 2));

    // 7. Diagnostics JSON
    writeAndHash("diagnostics.json", JSON.stringify(input.diagnostics, null, 2));

    // 8. Screenshot
    if (input.screenshotBuffer) {
      writeAndHash("screenshots/selection.png", input.screenshotBuffer);
    }

    // Canonical token source hash (separated from tokens.snapshot.json hash)
    const canonicalTokenHash = input.canonicalTokenHash || getCanonicalTokensHash();
    const commitSha = input.exporterCommitSha || getActualGitSha();

    // 9. Construct Manifest
    const manifestDraft: DesignPackageManifest = {
      schemaVersion: "1.0.0",
      packageId: `pkg_${input.screenId}_rev${input.revision}`,
      screenId: input.screenId,
      revision: input.revision,
      sourceFileRef: input.sourceFileRef,
      rootNodeId: input.rootNodeId,
      dataSource: input.provenance.designOrigin === "REAL_FIGMA" ? "REAL" : "SYNTHETIC",
      provenance: input.provenance,
      exporterCommitSha: commitSha,
      canonicalTokenHash,
      contentHash: "", // To be computed
      resourceHashes,
      approval: {
        status: "PENDING", // Never auto-approve
        bindingContentHash: "",
        notes: "Pending human design review and binding approval",
      },
    };

    const computedHash = calculateContentHash(manifestDraft as unknown as Record<string, unknown>);
    manifestDraft.contentHash = computedHash;
    manifestDraft.approval.bindingContentHash = computedHash;

    writeFileSync(join(stagingDir, "manifest.json"), JSON.stringify(manifestDraft, null, 2));

    // 10. Verify disk integrity in staging immediately before promoting
    const integrity = verifyPackageDiskIntegrity(stagingDir, manifestDraft);
    if (!integrity.valid) {
      throw new Error(`Package disk integrity check failed in staging: ${JSON.stringify(integrity.diagnostics)}`);
    }

    // 11. Atomic promotion from staging to pkgDir
    if (existsSync(pkgDir)) {
      rmSync(pkgDir, { recursive: true, force: true });
    }
    mkdirSync(resolve(baseDir, input.screenId), { recursive: true });

    try {
      renameSync(stagingDir, pkgDir);
    } catch {
      // Fallback across cross-device or permission boundary
      cpSync(stagingDir, pkgDir, { recursive: true });
      rmSync(stagingDir, { recursive: true, force: true });
    }

    return {
      packagePath: pkgDir,
      manifest: manifestDraft,
      contentHash: computedHash,
    };
  } catch (err) {
    // Clean up staging directory on any failure so no corrupt package remains
    try {
      rmSync(stagingDir, { recursive: true, force: true });
    } catch {}
    throw err;
  }
}
