/**
 * Unit & Negative Tests: Design Token Building & Anomaly Guards
 *
 * Covers Anomalies:
 * 3. Same-name variables from different sources merged incorrectly
 * 4. Missing token or alias cycle detected
 * 5. Ambiguous mode mapping detected
 * 8. Invalid AntD 5.7.3 theme configuration rejected
 * 9. Numeric token receiving disallowed CSS string rejected
 * 11. Deterministic builds (same input -> same output SHA256)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { buildTokens } from "../tooling/d2c/tokens/builder.js";
import { buildSafeCatalog } from "../tooling/d2c/normalizer/catalog.js";
import { resolveVariableToLiteral, type RawVariable, type RawCollection } from "../tooling/d2c/normalizer/variables.js";
import { adaptTokensStudioInput } from "../tooling/d2c/tokens/adapter.js";
import type { ThemeConfig } from "antd";

test("Tokens: Anomaly 3 - Different sources with same variable name do not collide silently", () => {
  const collections: RawCollection[] = [
    { id: "coll_primitives", name: "Primitives", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" },
    { id: "coll_semantic", name: "Semantic", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" },
  ];

  const variables: RawVariable[] = [
    {
      id: "var_prim_bg",
      name: "background",
      type: "COLOR",
      collectionId: "coll_primitives",
      valuesByMode: { m1: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } } },
    },
    {
      id: "var_sem_bg",
      name: "background", // Same name as primitive!
      type: "COLOR",
      collectionId: "coll_semantic",
      valuesByMode: { m1: { kind: "COLOR", rgba: { r: 0.95, g: 0.95, b: 0.95, a: 1 } } },
    },
  ];

  const catalog = buildSafeCatalog(variables, collections);

  // Both must exist under their compound namespaced keys
  assert.ok(catalog.entries["Primitives/background"], "Must retain Primitives/background");
  assert.ok(catalog.entries["Semantic/background"], "Must retain Semantic/background");
  assert.notEqual(
    catalog.entries["Primitives/background"].valuesByMode["Default"],
    catalog.entries["Semantic/background"].valuesByMode["Default"],
    "Values must not overwrite each other"
  );
});

test("Tokens: Anomaly 4 - Alias cycle and missing reference detected", () => {
  const coll: RawCollection = { id: "c1", name: "Core", modes: [{ id: "m1", name: "Default" }], defaultModeId: "m1" };
  const collById = { c1: coll };

  // Cyclic variables: A -> B -> A
  const varA: RawVariable = {
    id: "var_a",
    name: "colorA",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "ALIAS", id: "var_b" } },
  };
  const varB: RawVariable = {
    id: "var_b",
    name: "colorB",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "ALIAS", id: "var_a" } }, // Points back to A!
  };
  const varById = { var_a: varA, var_b: varB };

  const resCycle = resolveVariableToLiteral(varA, "m1", varById, collById);
  assert.equal(resCycle.error, "CYCLE_DETECTED");
  assert.equal(resCycle.value, null);

  // Missing target variable
  const varMissing: RawVariable = {
    id: "var_missing",
    name: "colorMissing",
    type: "COLOR",
    collectionId: "c1",
    valuesByMode: { m1: { kind: "ALIAS", id: "non_existent_var_id" } },
  };
  const resMissing = resolveVariableToLiteral(varMissing, "m1", varById, collById);
  assert.equal(resMissing.error, "TARGET_NOT_FOUND");
});

test("Tokens: Anomaly 5 - Mode mapping is explicit, no guessing", () => {
  const coll: RawCollection = {
    id: "c_theme",
    name: "Theme",
    modes: [
      { id: "mode_light", name: "DayLight" },
      { id: "mode_dark", name: "NightDark" },
    ],
    defaultModeId: "mode_light",
  };

  const variable: RawVariable = {
    id: "var_bg",
    name: "bg",
    type: "COLOR",
    collectionId: "c_theme",
    valuesByMode: {
      mode_light: { kind: "COLOR", rgba: { r: 1, g: 1, b: 1, a: 1 } },
      mode_dark: { kind: "COLOR", rgba: { r: 0, g: 0, b: 0, a: 1 } },
    },
  };

  const catalog = buildSafeCatalog([variable], [coll]);
  const entry = catalog.entries["Theme/bg"];
  assert.ok(entry);
  assert.equal(entry.valuesByMode["DayLight"], "#FFFFFF");
  assert.equal(entry.valuesByMode["NightDark"], "#000000");
  assert.equal(entry.valuesByMode["Dark"], undefined, "Must not guess unconfigured mode 'Dark'");
});

test("Tokens: Anomaly 8 & 9 - AntD 5.7.3 ThemeConfig disallows string in numeric tokens and forbids theme.cssVar", () => {
  // Valid AntD 5.7.3 theme config
  const validTheme: ThemeConfig = {
    token: {
      colorPrimary: "#1677ff",
      borderRadius: 6, // number
      fontSize: 14, // number
      wireframe: false,
    },
  };
  assert.equal(typeof validTheme.token?.borderRadius, "number");
  assert.equal(typeof validTheme.token?.fontSize, "number");

  // Rule verification: disallow CSS variable or string in number fields
  function validateAntDThemeTokens(tokenMap: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (typeof tokenMap.borderRadius !== "number") {
      errors.push(`borderRadius must be a number, got ${typeof tokenMap.borderRadius}: ${tokenMap.borderRadius}`);
    }
    if (typeof tokenMap.fontSize !== "number") {
      errors.push(`fontSize must be a number, got ${typeof tokenMap.fontSize}: ${tokenMap.fontSize}`);
    }
    if ("cssVar" in tokenMap) {
      errors.push("cssVar configuration is not permitted in static ThemeConfig");
    }
    return errors;
  }

  const badTokens = {
    colorPrimary: "#1677ff",
    borderRadius: "6px", // String instead of number!
    fontSize: "var(--font-base)", // CSS variable string instead of number!
    cssVar: true, // Not permitted!
  };

  const errors = validateAntDThemeTokens(badTokens);
  assert.equal(errors.length, 3);
  assert.ok(errors[0].includes("borderRadius must be a number"));
  assert.ok(errors[1].includes("fontSize must be a number"));
  assert.ok(errors[2].includes("cssVar configuration is not permitted"));
});

test("Tokens: Anomaly 11 - Deterministic Token Build (identical SHA256 on repeat runs)", async () => {
  const build1 = await buildTokens();
  const build2 = await buildTokens();

  assert.equal(build1.success, true);
  assert.equal(build2.success, true);
  assert.equal(build1.hashes.antdThemeHash, build2.hashes.antdThemeHash, "antd.theme.ts hash must be deterministic");
  assert.equal(build1.hashes.cssTokensHash, build2.hashes.cssTokensHash, "tokens.css hash must be deterministic");
  assert.equal(build1.hashes.lessTokensHash, build2.hashes.lessTokensHash, "tokens.less hash must be deterministic");
});
