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

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
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
}

export function createDesignPackage(input: PackageInput, baseDir: string = "design/releases"): {
  packagePath: string;
  manifest: DesignPackageManifest;
  contentHash: string;
} {
  const pkgDir = resolve(baseDir, input.screenId, `rev_${input.revision}`);
  const screenshotsDir = join(pkgDir, "screenshots");
  const assetsDir = join(pkgDir, "assets");

  mkdirSync(pkgDir, { recursive: true });
  mkdirSync(screenshotsDir, { recursive: true });
  mkdirSync(assetsDir, { recursive: true });

  const resourceHashes: Record<string, string> = {};

  function writeAndHash(relPath: string, content: string | Buffer): void {
    const fullPath = join(pkgDir, relPath);
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

  // Canonical token hash
  const canonicalTokenHash = resourceHashes["tokens.snapshot.json"];

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
    exporterCommitSha: "0.2.0-standalone",
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

  writeFileSync(join(pkgDir, "manifest.json"), JSON.stringify(manifestDraft, null, 2));

  // Verify disk integrity immediately
  const integrity = verifyPackageDiskIntegrity(pkgDir, manifestDraft);
  if (!integrity.valid) {
    throw new Error(`Package disk integrity check failed: ${JSON.stringify(integrity.diagnostics)}`);
  }

  return {
    packagePath: pkgDir,
    manifest: manifestDraft,
    contentHash: computedHash,
  };
}
