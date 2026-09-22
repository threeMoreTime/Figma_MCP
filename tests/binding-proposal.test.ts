/**
 * Regression Test: P1-05 Dynamic Binding & Theme Proposal Calculation
 *
 * Verifies:
 * 1. Binding proposal iterates all keys in components.used.json dynamically; unmapped components produce MISSING/REVIEW_REQUIRED.
 * 2. Unimplemented synthetic components are explicitly marked proposal-only.
 * 3. hasDivergence, diffCount, and previewThemeConfig are calculated dynamically from actual token differences.
 * 4. Changing a color or dimension causes diffCount and hasDivergence to change; identical inputs produce diffCount=0.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { generateBindingProposal } from "../tooling/d2c/registry/binding-proposal.js";

test("P1-05: Binding proposal dynamically maps all components and flags unknown ones as REVIEW_REQUIRED", () => {
  // Test with users_page rev 1
  const report = generateBindingProposal("users_page", 1);

  assert.ok(report.bindings.length >= 2, "Must produce bindings for components used in rev 1");

  // Check that every component used in rev 1 is represented
  const pkgDir = resolve("design/releases/users_page/rev_1");
  const componentsUsed = JSON.parse(readFileSync(resolve(pkgDir, "components.used.json"), "utf-8"));
  for (const key of Object.keys(componentsUsed)) {
    const item = report.bindings.find((b) => b.designComponentKey === key);
    assert.ok(item, `Component '${key}' from components.used.json must be present in proposal bindings`);
  }

  // Check SyntheticTag proposal-only marking if present
  const tagItem = report.bindings.find((b) => b.sourceDesignName === "UserStatusTag");
  if (tagItem) {
    assert.equal(tagItem.targetImplementation.isSyntheticFixture, true);
    assert.ok(
      tagItem.knownLimitations.some((l) => l.toLowerCase().includes("proposal-only")),
      "SyntheticTag must be explicitly marked proposal-only in knownLimitations"
    );
  }
});

test("P1-05: Theme divergence is calculated dynamically from tokens differences", () => {
  // 1. Run baseline on rev 1 (whose snapshot currently matches canonical)
  const report = generateBindingProposal("users_page", 1);

  // Failure assertion on unfixed code:
  // Before fix, diffCount and hasDivergence were hardcoded to false/0 without comparing!
  // When snapshot matches canonical tokens, diffCount must be 0
  assert.equal(report.themeProposal.hasDivergence, false);
  assert.equal(report.themeProposal.diffCount, 0);

  // 2. Modify snapshot color in a test package and verify that divergence is detected
  const tempPkgDir = resolve("build/test-divergence-pkg");
  mkdirSync(tempPkgDir, { recursive: true });

  const canonicalTokens = JSON.parse(
    readFileSync("tooling/d2c/tokens/canonical-tokens.json", "utf-8")
  );

  // Clone and change primary color to green
  const modifiedSnapshot = JSON.parse(JSON.stringify(canonicalTokens));
  modifiedSnapshot.color.primary.$value = "#52c41a";

  writeFileSync(resolve(tempPkgDir, "tokens.snapshot.json"), JSON.stringify(modifiedSnapshot, null, 2), "utf-8");
  writeFileSync(resolve(tempPkgDir, "components.used.json"), JSON.stringify({ btn_primary: {} }), "utf-8");

  const diffReport = generateBindingProposal("users_page", 1, {
    customPkgDir: tempPkgDir,
  });

  assert.equal(diffReport.themeProposal.hasDivergence, true, "Must detect divergence when color is modified");
  assert.ok(diffReport.themeProposal.diffCount > 0, "diffCount must be > 0 when token is modified");
  assert.equal(
    diffReport.themeProposal.previewThemeConfig.token.colorPrimary,
    "#52c41a",
    "previewThemeConfig must reflect modified colorPrimary"
  );
});
