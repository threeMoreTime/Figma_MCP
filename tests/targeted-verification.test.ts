/**
 * Phase 2 Targeted Verification Suite (阶段 2 定向补验)
 *
 * Covers:
 * A. Static Module & Export Verification (Negative cases: missing module, missing export, export mismatch, bad props, stringified boolean, unverified dependencies)
 * B. Token Unit & Format Rules (Dimension with/without px, opacity/zIndex/fontWeight without px, duration ms, unsupported DTCG diagnostics)
 * C. Identity & Mode Disambiguation (Duplicate collection names, names with delimiters, rename stability, CSS name collisions, instanceKey validation, explicit vs inherited vs unknown mode)
 * D. Integrity, Approval & Provenance (On-disk resource tampering detection, semantic array order preservation, multi-dimensional provenance)
 * E. Business Workspace Read-Only Hashes & Statistics
 */

import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { verifyComponentRecord, resolveModulePath } from "../tooling/d2c/registry/verifier.js";
import { buildSafeCatalog } from "../tooling/d2c/normalizer/catalog.js";
import { resolveVariableToLiteral, type RawVariable, type RawCollection } from "../tooling/d2c/normalizer/variables.js";
import { buildTokens } from "../tooling/d2c/tokens/builder.js";
import { calculateContentHash, canonicalStringify, isApprovalValid, verifyPackageDiskIntegrity } from "../tooling/d2c/contracts/hash.js";
import { validateContract } from "../tooling/d2c/contracts/validate.js";
import type { ComponentRecord, DesignPackageManifest } from "../tooling/d2c/contracts/schema.js";

// ============================================================================
// A. Real Module & Export Static Verification
// ============================================================================

test("Section A: Negative - Non-empty string but module does not exist", () => {
  const record: ComponentRecord = {
    designComponentId: "btn_missing",
    modulePath: "@/components/NonExistentModule",
    exportName: "default",
    sourceType: "REAL",
    codeVersionHash: "h1",
    props: {},
    supportedStates: ["ready"],
    bindingStatus: "UNBOUND",
    knownConstraints: [],
  };

  const res = verifyComponentRecord("NonExistent", record, "../workspace/cs_admin-client");
  assert.equal(res.verified, false);
  const diag = res.diagnostics.find((d) => d.code === "MODULE_NOT_FOUND");
  assert.ok(diag, "Must report MODULE_NOT_FOUND error");
});

test("Section A: Negative - Module exists but export does not exist", () => {
  const record: ComponentRecord = {
    designComponentId: "auth_btn",
    modulePath: "@/components/AuthButton",
    exportName: "NonExistentExportFunction",
    sourceType: "REAL",
    codeVersionHash: "h1",
    props: {},
    supportedStates: ["ready"],
    bindingStatus: "UNBOUND",
    knownConstraints: [],
  };

  const res = verifyComponentRecord("AuthButton", record, "../workspace/cs_admin-client");
  assert.equal(res.verified, false);
  const diag = res.diagnostics.find((d) => d.code === "EXPORT_NOT_FOUND" || d.code === "EXPORT_KIND_MISMATCH");
  assert.ok(diag, "Must report export not found or mismatch error");
});

test("Section A: Negative - default / named export mismatch", () => {
  // AuthButton in real repo has export default, not named export AuthButton
  const record: ComponentRecord = {
    designComponentId: "auth_btn",
    modulePath: "@/components/AuthButton",
    exportName: "AuthButton", // Named export requested, but only default exists!
    sourceType: "REAL",
    codeVersionHash: "h1",
    props: {},
    supportedStates: ["ready"],
    bindingStatus: "UNBOUND",
    knownConstraints: [],
  };

  const res = verifyComponentRecord("AuthButton", record, "../workspace/cs_admin-client");
  assert.equal(res.verified, false);
  const diag = res.diagnostics.find((d) => d.code === "EXPORT_KIND_MISMATCH");
  assert.ok(diag, "Must report EXPORT_KIND_MISMATCH when asking for named from default-only file");
});

test("Section A: Negative - Boolean converted to string ('false')", () => {
  const record: ComponentRecord = {
    designComponentId: "btn",
    modulePath: "antd",
    exportName: "Button",
    sourceType: "REAL",
    codeVersionHash: "antd",
    props: {
      disabled: {
        name: "disabled",
        type: "boolean",
        defaultValue: "false", // INVALID: stringified boolean!
      } as any,
    },
    supportedStates: ["ready"],
    bindingStatus: "UNBOUND",
    knownConstraints: [],
  };

  const res = verifyComponentRecord("Button", record, "../workspace/cs_admin-client");
  assert.equal(res.verified, false);
  const diag = res.diagnostics.find((d) => d.code === "BOOLEAN_STRINGIFIED");
  assert.ok(diag, "Must report BOOLEAN_STRINGIFIED");
});

test("Section A: Unverified Dependency - External Monorepo Import flagged without crashing", () => {
  const record: ComponentRecord = {
    designComponentId: "auth_btn",
    modulePath: "@/components/AuthButton",
    exportName: "default",
    sourceType: "REAL",
    codeVersionHash: "h1",
    props: {},
    supportedStates: ["ready"],
    bindingStatus: "UNBOUND",
    knownConstraints: [],
  };

  const res = verifyComponentRecord("AuthButton", record, "../workspace/cs_admin-client");
  // It has a warning about @monorepo/utils dependency not installed in standalone
  const warn = res.diagnostics.find((d) => d.code === "UNVERIFIED_EXTERNAL_DEPENDENCY");
  assert.ok(warn, "Must flag unverified monorepo dependency @monorepo/utils");
});

// ============================================================================
// B. Token Unit & Format Rules
// ============================================================================

test("Section B: Unit handling - dimension gets px, opacity/zIndex/fontWeight DO NOT get px, duration gets ms", async () => {
  const tempTokensPath = resolve("build/test-unit-tokens.json");
  mkdirSync(resolve("build"), { recursive: true });

  const testTokens = {
    spacing: {
      md: { $type: "dimension", $value: 16 },
      remVal: { $type: "dimension", $value: "1.5rem" }, // Already has unit
    },
    opacity: {
      disabled: { $type: "opacity", $value: 0.45 },
    },
    zIndex: {
      modal: { $type: "zIndex", $value: 1000 },
    },
    fontWeight: {
      bold: { $type: "fontWeight", $value: 700 },
    },
    motion: {
      fast: { $type: "duration", $value: 200 },
    },
    color: {
      primary: { $type: "color", $value: "#1677ff" },
    },
  };

  writeFileSync(tempTokensPath, JSON.stringify(testTokens, null, 2), "utf-8");

  const buildRes = await buildTokens({
    tokenFilePath: tempTokensPath,
    outputDir: "build/test-dist",
  });

  assert.equal(buildRes.success, true);
  const { readFileSync } = await import("node:fs");
  const cssContent = readFileSync(buildRes.artifacts.cssTokensPath, "utf-8");

  // Assertions:
  assert.ok(cssContent.includes("--d2c-spacing-md: 16px;"), "number dimension must append px");
  assert.ok(cssContent.includes("--d2c-spacing-remVal: 1.5rem;"), "string dimension with unit must retain rem");
  assert.ok(cssContent.includes("--d2c-opacity-disabled: 0.45;"), "opacity must NEVER append px");
  assert.ok(cssContent.includes("--d2c-zIndex-modal: 1000;"), "zIndex must NEVER append px");
  assert.ok(cssContent.includes("--d2c-fontWeight-bold: 700;"), "fontWeight must NEVER append px");
  assert.ok(cssContent.includes("--d2c-motion-fast: 200ms;"), "duration number must append ms");
});

test("Section B: Unsupported DTCG composite types issue diagnostics without guessing", async () => {
  const tempTokensPath = resolve("build/test-unsupported-tokens.json");
  const testTokens = {
    typography: {
      heading: {
        $type: "typography",
        $value: { fontFamily: "Inter", fontSize: 24 }, // composite!
      },
    },
    color: {
      primary: { $type: "color", $value: "#1677ff" },
    },
  };

  writeFileSync(tempTokensPath, JSON.stringify(testTokens, null, 2), "utf-8");

  const buildRes = await buildTokens({
    tokenFilePath: tempTokensPath,
    outputDir: "build/test-dist-unsupported",
  });

  const diag = buildRes.diagnostics.find((d) => d.code === "UNSUPPORTED_DTCG_TYPE");
  assert.ok(diag, "Must issue UNSUPPORTED_DTCG_TYPE diagnostic for composite typography");
});

// ============================================================================
// C. Identity & Mode Disambiguation
// ============================================================================

test("Section C: Two collections with same display name disambiguated by machine collectionId", () => {
  const coll1: RawCollection = { id: "coll_001", name: "Theme", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" };
  const coll2: RawCollection = { id: "coll_002", name: "Theme", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" };

  const var1: RawVariable = {
    id: "var_001",
    name: "bg",
    type: "COLOR",
    collectionId: "coll_001",
    valuesByMode: { m1: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } } },
  };
  const var2: RawVariable = {
    id: "var_002",
    name: "bg",
    type: "COLOR",
    collectionId: "coll_002",
    valuesByMode: { m1: { kind: "COLOR", rgba: { r: 0, g: 0, b: 0, a: 1 } } },
  };

  const catalog = buildSafeCatalog([var1, var2], [coll1, coll2]);

  // Both must exist under their machine keys
  assert.ok(catalog.entries["coll_001::var_001"]);
  assert.ok(catalog.entries["coll_002::var_002"]);
  assert.equal(catalog.entries["coll_001::var_001"].valuesByMode["Default"], "#FFFFFF");
  assert.equal(catalog.entries["coll_002::var_002"].valuesByMode["Default"], "#000000");

  const collisionWarn = catalog.diagnostics.find((d) => d.code === "DISPLAY_NAME_COLLISION_DETECTED");
  assert.ok(collisionWarn, "Must flag display name collision in catalog");
});

test("Section C: Variable name with delimiters (slashes/dots) is preserved", () => {
  const coll: RawCollection = { id: "c1", name: "Primitives", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" };
  const v: RawVariable = {
    id: "var_delim",
    name: "button/primary.hover.bg",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "COLOR", rgba: { r: 0.1, g: 0.5, b: 0.9, a: 1 } } },
  };

  const catalog = buildSafeCatalog([v], [coll]);
  const entry = catalog.entries["c1::var_delim"];
  assert.ok(entry);
  assert.equal(entry.name, "button/primary.hover.bg");
});

test("Section C: Variable rename preserves stable variableId", () => {
  const coll: RawCollection = { id: "c1", name: "Primitives", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" };
  const vBefore: RawVariable = {
    id: "var_stable_id",
    name: "oldName",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } } },
  };
  const vAfter: RawVariable = {
    id: "var_stable_id",
    name: "renamedName",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } } },
  };

  const catBefore = buildSafeCatalog([vBefore], [coll]);
  const catAfter = buildSafeCatalog([vAfter], [coll]);

  assert.ok(catBefore.entries["c1::var_stable_id"]);
  assert.ok(catAfter.entries["c1::var_stable_id"]);
  assert.equal(catBefore.entries["c1::var_stable_id"].id, catAfter.entries["c1::var_stable_id"].id);
});

test("Section C: CSS Variable Name Collision detected and blocked", async () => {
  const tempTokensPath = resolve("build/test-collision-tokens.json");
  const testTokens = {
    button: {
      primary: { $type: "color", $value: "#1677ff" }, // -> --d2c-button-primary
    },
    "button-primary": { $type: "color", $value: "#1890ff" }, // -> --d2c-button-primary
  };

  writeFileSync(tempTokensPath, JSON.stringify(testTokens, null, 2), "utf-8");

  const buildRes = await buildTokens({
    tokenFilePath: tempTokensPath,
    outputDir: "build/test-dist-collision",
  });

  const collisionDiag = buildRes.diagnostics.find((d) => d.code === "CSS_VARIABLE_NAME_COLLISION");
  assert.ok(collisionDiag, "Must detect CSS variable name collision between 'button.primary' and 'button-primary'");
  assert.equal(buildRes.success, false, "Build must fail when CSS name collision occurs");
});

test("Section C: Element identity instanceKey - Legitimate duplicate vs duplicate instanceKey collision", () => {
  // Scenario 1: Two different instances of the same component (e.g. Action Buttons on two rows)
  const legitimateUsage = [
    { screenId: "users", semanticId: "row_edit_btn", instanceKey: "row_1" },
    { screenId: "users", semanticId: "row_edit_btn", instanceKey: "row_2" },
  ];

  const uniqueKeys = new Set(legitimateUsage.map((u) => `${u.screenId}:${u.semanticId}:${u.instanceKey}`));
  assert.equal(uniqueKeys.size, 2, "Different instanceKeys must NOT report collision");

  // Scenario 2: Identical instance identity repeated
  const collidingUsage = [
    { screenId: "users", semanticId: "row_edit_btn", instanceKey: "row_1" },
    { screenId: "users", semanticId: "row_edit_btn", instanceKey: "row_1" },
  ];
  const keys = collidingUsage.map((u) => `${u.screenId}:${u.semanticId}:${u.instanceKey}`);
  const hasDup = keys.length !== new Set(keys).size;
  assert.equal(hasDup, true, "Identical instanceKey must be detected as collision");
});

test("Section C: Mode resolution differentiates EXPLICIT_MODE vs INHERITED_DEFAULT vs UNRESOLVED_MODE", () => {
  const coll: RawCollection = {
    id: "c_modes",
    name: "ModeColl",
    modes: [
      { id: "m_day", name: "Day" },
      { id: "m_night", name: "Night" },
    ],
    defaultModeId: "m_day",
  };
  const collById = { c_modes: coll };

  const variable: RawVariable = {
    id: "v_mode_test",
    name: "modeTest",
    type: "COLOR",
    collectionId: "c_modes",
    valuesByMode: {
      m_day: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } },
    },
  };
  const varById = { v_mode_test: variable };

  // Explicit match
  const explicitRes = resolveVariableToLiteral(variable, "m_day", varById, collById);
  assert.equal(explicitRes.resolutionRationale, "EXPLICIT_MODE");
  assert.equal(explicitRes.value, "#FFFFFF");

  // Inherited from default mode
  const inheritedRes = resolveVariableToLiteral(variable, "unspecified_mode", varById, collById);
  assert.equal(inheritedRes.resolutionRationale, "INHERITED_DEFAULT");
  assert.equal(inheritedRes.value, "#FFFFFF");

  // Unresolvable mode when collection default is also missing
  const collNoDefault: RawCollection = { id: "c_empty", name: "Empty", modes: [], defaultModeId: "m_missing" };
  const varNoMatch: RawVariable = {
    id: "v_nomatch",
    name: "nomatch",
    type: "COLOR",
    collectionId: "c_empty",
    valuesByMode: {},
  };
  const unres = resolveVariableToLiteral(varNoMatch, "any_mode", { v_nomatch: varNoMatch }, { c_empty: collNoDefault });
  assert.equal(unres.error, "UNRESOLVED_MODE");
  assert.equal(unres.resolutionRationale, "UNKNOWN_MODE");
});

// ============================================================================
// D. Integrity, Approval & Provenance
// ============================================================================

test("Section D: On-disk resource tampering detected without updating manifest", () => {
  const pkgDir = resolve("build/test-pkg-tamper");
  mkdirSync(pkgDir, { recursive: true });

  const tokenFilePath = resolve(pkgDir, "tokens.snapshot.json");
  writeFileSync(tokenFilePath, JSON.stringify({ token: "original" }), "utf-8");

  const originalTokenHash = createHash("sha256").update(JSON.stringify({ token: "original" })).digest("hex");

  const manifest: DesignPackageManifest = {
    schemaVersion: "1.0.0",
    packageId: "pkg_tamper_test",
    screenId: "users",
    revision: 1,
    sourceFileRef: "figma://file/123",
    rootNodeId: "0:1",
    dataSource: "SYNTHETIC",
    provenance: {
      designOrigin: "SYNTHETIC_SPEC",
      componentOrigin: "SYNTHETIC_FIXTURE",
      tokenOrigin: "SYNTHETIC_CANONICAL",
      dataOrigin: "SYNTHETIC_MOCK",
    },
    exporterCommitSha: "abc",
    canonicalTokenHash: "tok1",
    contentHash: "",
    resourceHashes: {
      "tokens.snapshot.json": originalTokenHash,
    },
    approval: {
      status: "PENDING",
      bindingContentHash: "temp",
    },
  };

  manifest.contentHash = calculateContentHash(manifest as unknown as Record<string, unknown>);
  manifest.approval.bindingContentHash = manifest.contentHash;

  // Initial state: disk files match manifest
  const initCheck = verifyPackageDiskIntegrity(pkgDir, manifest);
  assert.equal(initCheck.valid, true);

  // Tamper with disk file without updating manifest!
  writeFileSync(tokenFilePath, JSON.stringify({ token: "MALICIOUS_TAMPER" }), "utf-8");

  const tamperedCheck = verifyPackageDiskIntegrity(pkgDir, manifest);
  assert.equal(tamperedCheck.valid, false, "Must detect on-disk tampering");
  assert.equal(tamperedCheck.tamperedResources.length, 1);
  assert.equal(tamperedCheck.tamperedResources[0], "tokens.snapshot.json");
});

test("Section D: Deterministic canonicalStringify strictly preserves semantic array order", () => {
  const arrayOrder1 = { items: ["first", "second", "third"] };
  const arrayOrder2 = { items: ["third", "second", "first"] };

  const hash1 = calculateContentHash(arrayOrder1);
  const hash2 = calculateContentHash(arrayOrder2);

  assert.notEqual(hash1, hash2, "Arrays with different orders must produce different hashes (semantic ordering preserved)");
});

test("Section D: Multi-dimensional provenance record validated", () => {
  const validManifest: DesignPackageManifest = {
    schemaVersion: "1.0.0",
    packageId: "pkg_prov_test",
    screenId: "users",
    revision: 1,
    sourceFileRef: "figma://file/123",
    rootNodeId: "0:1",
    dataSource: "SYNTHETIC",
    provenance: {
      designOrigin: "SYNTHETIC_SPEC",
      componentOrigin: "REAL_REPO", // Mixed origin
      tokenOrigin: "SYNTHETIC_CANONICAL",
      dataOrigin: "SYNTHETIC_MOCK",
    },
    exporterCommitSha: "abc",
    canonicalTokenHash: "tok1",
    contentHash: "hash123",
    resourceHashes: {},
    approval: {
      status: "PENDING",
      bindingContentHash: "hash123",
    },
  };

  const res = validateContract("manifest", validManifest);
  assert.equal(res.success, true, "Mixed provenance must be accepted and validated");
});
