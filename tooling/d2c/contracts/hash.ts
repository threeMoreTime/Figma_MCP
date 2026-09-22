/**
 * Deterministic Content Hashing & Approval Verification
 */

import { createHash } from "node:crypto";
import type { DesignPackageManifest } from "./schema.js";

/**
 * Recursively sort object keys while strictly preserving array orders.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map((item) => canonicalStringify(item)).join(",") + "]";
  }

  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(obj[k])}`);
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes deterministic SHA-256 content hash over an object,
 * stripping volatile fields (e.g. exportedAt, runId, contentHash itself).
 */
export function calculateContentHash(payload: Record<string, unknown>): string {
  const stripped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "contentHash" || k === "exportedAt" || k === "runId" || k === "approval") {
      continue;
    }
    stripped[k] = v;
  }

  const canonicalJson = canonicalStringify(stripped);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Checks content binding and approval invalidation.
 * NOTE: This is a content hash binding check (内容绑定与审批失效检查).
 * It is NOT cryptographic user identity authentication or digital signature.
 *
 * An approval is valid iff:
 * 1. Status is "APPROVED"
 * 2. bindingContentHash exactly matches the current contentHash
 */
export function isApprovalValid(manifest: DesignPackageManifest): boolean {
  if (manifest.approval.status !== "APPROVED") {
    return false;
  }
  return manifest.approval.bindingContentHash === manifest.contentHash;
}

/**
 * Validates actual disk files against manifest.resourceHashes and validates contentHash.
 * Detects if on-disk files are tampered with or desynchronized without updating manifest.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Diagnostic } from "./schema.js";

export interface PackageIntegrityResult {
  valid: boolean;
  tamperedResources: string[];
  missingResources: string[];
  contentHashMatches: boolean;
  diagnostics: Diagnostic[];
}

export const REQUIRED_PACKAGE_RESOURCES = [
  "figma.raw.json",
  "context.json",
  "source-map.json",
  "tokens.snapshot.json",
  "components.used.json",
  "interactions.json",
  "diagnostics.json",
] as const;

export function verifyPackageDiskIntegrity(
  packageDir: string,
  manifest: DesignPackageManifest
): PackageIntegrityResult {
  const diagnostics: Diagnostic[] = [];
  const tamperedResources: string[] = [];
  const missingResources: string[] = [];

  const resourceEntries = Object.entries(manifest.resourceHashes || {});
  if (resourceEntries.length === 0) {
    diagnostics.push({
      code: "EMPTY_RESOURCE_HASHES",
      message: "Package manifest has an empty resourceHashes map; design package must declare resources.",
      severity: "ERROR",
    });
  }

  // Check required resources
  for (const req of REQUIRED_PACKAGE_RESOURCES) {
    if (!manifest.resourceHashes || !manifest.resourceHashes[req]) {
      diagnostics.push({
        code: "REQUIRED_RESOURCE_MISSING",
        message: `Package manifest is missing required resource '${req}' in resourceHashes.`,
        severity: "ERROR",
        path: req,
      });
    }
  }

  for (const [relPath, expectedHash] of resourceEntries) {
    // Path traversal and escaping guards
    if (
      relPath.includes("..") ||
      relPath.startsWith("/") ||
      relPath.startsWith("\\") ||
      /^[a-zA-Z]:/.test(relPath) ||
      relPath.startsWith("\\\\")
    ) {
      diagnostics.push({
        code: "PATH_TRAVERSAL_DETECTED",
        message: `Resource path '${relPath}' contains illegal path traversal or absolute prefixes.`,
        severity: "ERROR",
        path: relPath,
      });
      continue;
    }

    const fullPath = resolve(packageDir, relPath);
    // Ensure resolved path does not escape packageDir
    const normalizedPkgDir = resolve(packageDir);
    if (!fullPath.startsWith(normalizedPkgDir)) {
      diagnostics.push({
        code: "DIRECTORY_ESCAPE_DETECTED",
        message: `Resource path '${relPath}' escapes package directory '${packageDir}'.`,
        severity: "ERROR",
        path: relPath,
      });
      continue;
    }

    if (!existsSync(fullPath)) {
      missingResources.push(relPath);
      diagnostics.push({
        code: "DISK_RESOURCE_MISSING",
        message: `Package resource file missing on disk: ${relPath}`,
        severity: "ERROR",
        path: relPath,
      });
      continue;
    }

    const content = readFileSync(fullPath);
    const actualHash = createHash("sha256").update(content).digest("hex");
    if (actualHash !== expectedHash) {
      tamperedResources.push(relPath);
      diagnostics.push({
        code: "DISK_RESOURCE_HASH_MISMATCH",
        message: `Resource file '${relPath}' on disk has hash ${actualHash}, expected ${expectedHash}. File has been modified without manifest update!`,
        severity: "ERROR",
        path: relPath,
        details: { expectedHash, actualHash },
      });
    }
  }

  // Recalculate contentHash over manifest payload
  const recalculatedHash = calculateContentHash(manifest as unknown as Record<string, unknown>);
  const contentHashMatches = recalculatedHash === manifest.contentHash;
  if (!contentHashMatches) {
    diagnostics.push({
      code: "MANIFEST_CONTENT_HASH_MISMATCH",
      message: `Manifest self-reported contentHash (${manifest.contentHash}) does not match recalculated hash (${recalculatedHash})`,
      severity: "ERROR",
    });
  }

  const valid =
    tamperedResources.length === 0 &&
    missingResources.length === 0 &&
    contentHashMatches &&
    diagnostics.filter((d) => d.severity === "ERROR").length === 0;

  return {
    valid,
    tamperedResources,
    missingResources,
    contentHashMatches,
    diagnostics,
  };
}
