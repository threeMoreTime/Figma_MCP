/**
 * Regression Test: P1-09 Security Boundary, Safe DOM & Staging Verification
 *
 * Verifies:
 * 1. UI HTML uses textContent / safe DOM construction and NO raw innerHTML interpolation of dynamic node/diagnostic data.
 * 2. Package creation blocks path traversal (../, absolute paths, drive letters, UNC).
 * 3. Empty resourceHashes fails validation.
 * 4. Token builder does not overwrite existing good artifacts when build encounters an ERROR.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createDesignPackage } from "../tooling/d2c/cli/package.js";
import { buildTokens } from "../tooling/d2c/tokens/builder.js";
import { verifyPackageDiskIntegrity } from "../tooling/d2c/contracts/hash.js";
import type { DesignPackageManifest } from "../tooling/d2c/contracts/schema.js";

test("P1-09: UI HTML avoids raw innerHTML interpolation of untrusted node and diagnostic strings", () => {
  const uiPath = resolve("tooling/d2c/figma-plugin/exporter/src/ui.html");
  const content = readFileSync(uiPath, "utf-8");

  // Failure assertion on unfixed code:
  // Must NOT interpolate rootNodeName or d.message inside innerHTML template strings
  const unsafeNodeName = content.includes("${p.rootNodeName}");
  const unsafeNodeId = content.includes("${p.rootNodeId}");
  const unsafeDiagMsg = content.includes("${d.message}");

  assert.equal(
    unsafeNodeName,
    false,
    "ui.html must NOT interpolate ${p.rootNodeName} directly into innerHTML"
  );
  assert.equal(
    unsafeNodeId,
    false,
    "ui.html must NOT interpolate ${p.rootNodeId} directly into innerHTML"
  );
  assert.equal(
    unsafeDiagMsg,
    false,
    "ui.html must NOT interpolate ${d.message} directly into innerHTML"
  );
});

test("P1-09: Package creation strictly blocks path traversal attacks", () => {
  const maliciousInput = {
    screenId: "../malicious_traversal",
    revision: 1,
    sourceFileRef: "figma://file/attack",
    rootNodeId: "0:1",
    rawFigmaTree: {},
    contextTree: {},
    sourceMap: {},
    tokensSnapshot: {},
    componentsUsed: {},
    interactions: [],
    diagnostics: [],
    provenance: {
      designOrigin: "SYNTHETIC_SPEC" as const,
      componentOrigin: "SYNTHETIC_FIXTURE" as const,
      tokenOrigin: "SYNTHETIC_CANONICAL" as const,
      dataOrigin: "SYNTHETIC_MOCK" as const,
    },
  };

  assert.throws(
    () => {
      createDesignPackage(maliciousInput, "build/test-pkg-traversal");
    },
    /Path traversal|invalid screenId/i,
    "createDesignPackage must throw on '../' in screenId"
  );
});

test("P1-09: Empty resourceHashes is rejected by package integrity check", () => {
  const emptyManifest: DesignPackageManifest = {
    schemaVersion: "1.0.0",
    packageId: "pkg_empty_hashes",
    screenId: "users",
    revision: 1,
    sourceFileRef: "figma://file/1",
    rootNodeId: "0:1",
    dataSource: "SYNTHETIC",
    exporterCommitSha: "abc",
    canonicalTokenHash: "tok1",
    contentHash: "hash1",
    resourceHashes: {}, // EMPTY: Invalid!
    approval: {
      status: "PENDING",
      bindingContentHash: "hash1",
    },
  };

  const integrity = verifyPackageDiskIntegrity("build", emptyManifest);
  assert.equal(
    integrity.valid,
    false,
    "Package with empty resourceHashes must be rejected as invalid"
  );
  const diag = integrity.diagnostics.find((d) => d.code === "EMPTY_RESOURCE_HASHES" || d.code === "REQUIRED_RESOURCE_MISSING");
  assert.ok(diag, "Must report diagnostic for empty or missing required resources");
});

test("P1-09: Token builder does not overwrite existing good artifacts on build error", async () => {
  const outDir = resolve("build/test-token-staging-protect");
  mkdirSync(outDir, { recursive: true });

  const goodCssPath = resolve(outDir, "tokens.css");
  const goodContent = "/* GOOD TOKENS CSS */\n:root { --d2c-primary: #1677ff; }";
  writeFileSync(goodCssPath, goodContent, "utf-8");

  // Invalid token file that causes CSS name collision ERROR
  const badTokenFile = resolve("build/bad-collision-tokens.json");
  writeFileSync(
    badTokenFile,
    JSON.stringify({
      btn: { primary: { $type: "color", $value: "#111" } },
      "btn-primary": { $type: "color", $value: "#222" },
    }),
    "utf-8"
  );

  const res = await buildTokens({
    tokenFilePath: badTokenFile,
    outputDir: outDir,
  });

  assert.equal(res.success, false, "Build must fail on collision");

  // The existing good file MUST remain untouched!
  const currentContent = readFileSync(goodCssPath, "utf-8");
  assert.equal(
    currentContent,
    goodContent,
    "Existing valid tokens.css must NOT be overwritten by failed build!"
  );
});
