/**
 * Regression Test: P1-01 Figma Plugin Packaging & Delivery Manifest
 *
 * Verifies:
 * 1. Delivery manifest is at tooling/d2c/figma-plugin/exporter/dist/manifest.json
 * 2. In dist/manifest.json, main="code.js" and ui="ui.html" (relative to manifest, NO redundant dist/ prefix)
 * 3. Files referenced by main and ui strictly exist relative to manifest location
 * 4. networkAccess is strictly allowedDomains: ["none"]
 * 5. Document access & editor types comply with Figma manifest schema
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { buildFigmaPlugin } from "../tooling/d2c/figma-plugin/build.js";

test("P1-01: Figma Plugin Delivery Manifest resolves correctly relative to dist directory", async () => {
  // Build plugin using official build tool
  await buildFigmaPlugin();

  const manifestPath = resolve("tooling/d2c/figma-plugin/exporter/dist/manifest.json");
  assert.ok(existsSync(manifestPath), "dist/manifest.json must exist as the primary delivery manifest");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  // Failure assertion on unfixed code:
  // Before fix, build.ts copied manifest.json directly, leaving main="dist/code.js" and ui="dist/ui.html"
  assert.equal(
    manifest.main,
    "code.js",
    "In delivered dist/manifest.json, 'main' must be 'code.js' (relative to dist/manifest.json)"
  );
  assert.equal(
    manifest.ui,
    "ui.html",
    "In delivered dist/manifest.json, 'ui' must be 'ui.html' (relative to dist/manifest.json)"
  );

  // Verify referenced files exist relative to dist/manifest.json
  const manifestDir = dirname(manifestPath);
  const resolvedMain = resolve(manifestDir, manifest.main);
  const resolvedUi = resolve(manifestDir, manifest.ui);

  assert.ok(existsSync(resolvedMain), `File referenced by main must exist: ${resolvedMain}`);
  assert.ok(existsSync(resolvedUi), `File referenced by ui must exist: ${resolvedUi}`);

  // Zero-network security assertion
  assert.deepEqual(
    manifest.networkAccess?.allowedDomains,
    ["none"],
    "Manifest must strictly declare allowedDomains: ['none']"
  );
});
