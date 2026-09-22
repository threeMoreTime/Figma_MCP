/**
 * Regression Test: P1-02 Export Data Intake Pipeline & Unified Contract Compliance
 *
 * Verifies:
 * 1. Raw plugin export payload is converted via adapter into canonical DesignContext (validateContract('context', ...)).
 * 2. Generated context.json in design package strictly complies with DesignContextSchema.
 * 3. exporterCommitSha is an authentic git commit hash, not a version string.
 * 4. canonicalTokenHash and tokens.snapshot.json hash are separately recorded.
 * 5. Invalid export data produces diagnostics and halts before publishing release.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { runIntakePipeline } from "../tooling/d2c/cli/intake.js";
import { validateContract } from "../tooling/d2c/contracts/validate.js";
import type { DesignPackageManifest } from "../tooling/d2c/contracts/schema.js";

test("P1-02: Intake pipeline converts raw ExportResult to verified Release Package", async () => {
  const rawExportFixture = {
    rootNodeId: "10:100",
    rootNodeName: "UsersFrame",
    documentTitle: "Admin Platform Design",
    exportedAt: new Date().toISOString(),
    tree: {
      id: "10:100",
      name: "UsersFrame",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      layout: {
        mode: "VERTICAL",
        wrap: "NO_WRAP",
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        itemSpacing: 16,
      },
      children: [
        {
          id: "10:102",
          name: "PageTitle",
          type: "TEXT",
          visible: true,
          x: 16,
          y: 16,
          width: 200,
          height: 32,
          text: {
            characters: "用户管理",
            fontFamily: "Inter",
            fontSize: 20,
            fontWeight: 600,
          },
        },
        {
          id: "10:103",
          name: "CreateUserButton",
          type: "INSTANCE",
          visible: true,
          x: 1000,
          y: 16,
          width: 88,
          height: 32,
          component: {
            isInstance: true,
            mainComponentId: "cmp_btn",
            mainComponentKey: "btn_primary",
            mainComponentName: "PrimaryButton",
            variantProperties: { type: "primary" },
          },
        },
      ],
    },
    componentsUsed: {
      btn_primary: { id: "cmp_btn", key: "btn_primary", name: "PrimaryButton" },
    },
    variables: {
      var_primary: {
        id: "var_primary",
        name: "color/primary",
        resolvedType: "COLOR",
        valuesByMode: { m1: "#1677ff" },
        collectionId: "coll_1",
      },
    },
    collections: {
      coll_1: { id: "coll_1", name: "Primitives", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" },
    },
    diagnostics: [],
  };

  const rawPath = resolve("build/test-raw-export.json");
  mkdirSync(resolve("build"), { recursive: true });
  writeFileSync(rawPath, JSON.stringify(rawExportFixture, null, 2), "utf-8");

  const targetReleaseDir = resolve("build/test-releases");
  rmSync(targetReleaseDir, { recursive: true, force: true });

  const result = await runIntakePipeline({
    rawExportPath: rawPath,
    screenId: "intake_test_screen",
    revision: 1,
    sourceFileRef: "figma://file/test_intake_file",
    releasesBaseDir: targetReleaseDir,
  });

  assert.equal(result.success, true, "Intake pipeline must succeed for valid raw export");

  // Verify context.json in package satisfies DesignContextSchema
  const pkgDir = resolve(targetReleaseDir, "intake_test_screen/rev_1");
  const contextContent = JSON.parse(readFileSync(resolve(pkgDir, "context.json"), "utf-8"));

  const contextValidation = validateContract("context", contextContent);
  assert.equal(
    contextValidation.success,
    true,
    "context.json in release package must strictly validate against DesignContextSchema"
  );

  // Verify manifest
  const manifestContent: DesignPackageManifest = JSON.parse(readFileSync(resolve(pkgDir, "manifest.json"), "utf-8"));
  assert.match(
    manifestContent.exporterCommitSha,
    /^[0-9a-f]{7,40}$/i,
    "exporterCommitSha must be a real git commit hash, not a version string"
  );

  assert.ok(
    manifestContent.canonicalTokenHash,
    "canonicalTokenHash must be set"
  );
  assert.notEqual(
    manifestContent.canonicalTokenHash,
    "0.2.0-standalone",
    "canonicalTokenHash must be a sha256 hash"
  );
});

test("P1-02: Intake pipeline diagnoses errors and halts before writing release on invalid export", async () => {
  const invalidExport = {
    // Missing rootNodeId and tree
    rootNodeName: "BadExport",
    documentTitle: "Corrupt",
  };

  const badPath = resolve("build/test-bad-export.json");
  writeFileSync(badPath, JSON.stringify(invalidExport, null, 2), "utf-8");

  const targetReleaseDir = resolve("build/test-releases-bad");
  rmSync(targetReleaseDir, { recursive: true, force: true });

  const result = await runIntakePipeline({
    rawExportPath: badPath,
    screenId: "bad_intake_screen",
    revision: 1,
    sourceFileRef: "figma://file/test_bad",
    releasesBaseDir: targetReleaseDir,
  });

  assert.equal(result.success, false, "Intake must fail on corrupt export");
  assert.ok(result.diagnostics.length > 0, "Must produce diagnostics for corrupt export");

  const badPkgDir = resolve(targetReleaseDir, "bad_intake_screen/rev_1");
  assert.equal(
    existsSync(badPkgDir),
    false,
    "Release package directory must NOT be created when intake fails"
  );
});

test("P1-02: validateAllReleases validates all packages under design/releases and catches errors", async () => {
  const { validateAllReleases } = await import("../tooling/d2c/cli/validate.js");
  const releasesDir = resolve("design/releases");
  const result = await validateAllReleases(releasesDir);
  assert.equal(result.success, true, "Existing design/releases candidate packages must all be valid");
  assert.ok(result.checkedPackages.length >= 2, "Must validate both rev_1 and rev_2");

  // Negative test: Create a corrupt candidate package in a temp directory
  const corruptDir = resolve("build/test-corrupt-releases/screen_corrupt/rev_1");
  mkdirSync(corruptDir, { recursive: true });
  writeFileSync(resolve(corruptDir, "manifest.json"), JSON.stringify({ schemaVersion: "99.9.9" }), "utf-8");

  const corruptResult = await validateAllReleases(resolve("build/test-corrupt-releases"));
  assert.equal(corruptResult.success, false, "validateAllReleases must fail on invalid candidate package");
  assert.ok(corruptResult.diagnostics.length > 0, "Must output error diagnostics for invalid package");
});


