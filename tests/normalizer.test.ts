/**
 * Unit Tests for Normalizer Modules (Color & Variable Extraction)
 */

import test from "node:test";
import assert from "node:assert/strict";
import { rgbaToHex } from "../tooling/d2c/normalizer/color.js";

test("Normalizer: rgbaToHex conversions", () => {
  // Test cases matching upstream design-to-code-json tests
  assert.equal(rgbaToHex({ r: 0.0667, g: 0.6745, b: 0.2902, a: 1 }), "#11AC4A");
  assert.equal(rgbaToHex({ r: 0, g: 0, b: 0, a: 0.15 }), "#00000026");
  assert.equal(rgbaToHex({ r: 1, g: 1, b: 1, a: 1 }), "#FFFFFF");
  assert.equal(rgbaToHex({ r: 0, g: 0, b: 0, a: 1 }), "#000000");
  assert.equal(rgbaToHex({ r: 0.0863, g: 0.4667, b: 1, a: 1 }), "#1677FF");
});

test("P1-08: Cross-collection variable alias resolves to matching mode name across collections", async () => {
  const { resolveVariableToLiteral } = await import("../tooling/d2c/normalizer/variables.js");

  const collSemantic = {
    id: "coll_semantic",
    name: "Semantic",
    modes: [
      { id: "mode_s_light", name: "Light" },
      { id: "mode_s_dark", name: "Dark" },
    ],
    defaultModeId: "mode_s_light",
  };

  const collPrimitive = {
    id: "coll_primitive",
    name: "Primitive",
    modes: [
      { id: "mode_p_light", name: "Light" },
      { id: "mode_p_dark", name: "Dark" },
    ],
    defaultModeId: "mode_p_light",
  };

  const varTarget = {
    id: "var_color_neutral",
    name: "color/neutral",
    type: "COLOR" as const,
    collectionId: "coll_primitive",
    valuesByMode: {
      mode_p_light: { kind: "COLOR" as const, rgba: { r: 1, g: 1, b: 1, a: 1 } },
      mode_p_dark: { kind: "COLOR" as const, rgba: { r: 0, g: 0, b: 0, a: 1 } },
    },
  };

  const varAlias = {
    id: "var_bg_surface",
    name: "bg/surface",
    type: "COLOR" as const,
    collectionId: "coll_semantic",
    valuesByMode: {
      mode_s_light: { kind: "ALIAS" as const, id: "var_color_neutral" },
      mode_s_dark: { kind: "ALIAS" as const, id: "var_color_neutral" },
    },
  };

  const varById = {
    [varTarget.id]: varTarget,
    [varAlias.id]: varAlias,
  };

  const collById = {
    [collSemantic.id]: collSemantic,
    [collPrimitive.id]: collPrimitive,
  };

  // Resolving in 'Dark' mode of Semantic collection should resolve to 'Dark' mode of Primitive collection
  const darkRes = resolveVariableToLiteral(varAlias, "mode_s_dark", varById, collById);
  assert.equal(darkRes.error, undefined, "Resolution must not error");
  assert.equal(darkRes.value, "#000000", "Dark mode in Semantic must resolve to Dark mode value in Primitive (#000000), not default light");
  assert.equal(darkRes.isAlias, true);
});

test("P1-08: Cross-collection alias falls back to defaultModeId when target collection lacks matching mode", async () => {
  const { resolveVariableToLiteral } = await import("../tooling/d2c/normalizer/variables.js");

  const collSemantic = {
    id: "coll_semantic",
    name: "Semantic",
    modes: [
      { id: "mode_s_special", name: "HighContrast" },
    ],
    defaultModeId: "mode_s_special",
  };

  const collPrimitive = {
    id: "coll_primitive",
    name: "Primitive",
    modes: [
      { id: "mode_p_default", name: "Default" },
    ],
    defaultModeId: "mode_p_default",
  };

  const varTarget = {
    id: "var_target_val",
    name: "spacing/base",
    type: "FLOAT" as const,
    collectionId: "coll_primitive",
    valuesByMode: {
      mode_p_default: { kind: "FLOAT" as const, value: 16 },
    },
  };

  const varAlias = {
    id: "var_alias_spacing",
    name: "layout/gap",
    type: "FLOAT" as const,
    collectionId: "coll_semantic",
    valuesByMode: {
      mode_s_special: { kind: "ALIAS" as const, id: "var_target_val" },
    },
  };

  const res = resolveVariableToLiteral(varAlias, "mode_s_special", { [varTarget.id]: varTarget, [varAlias.id]: varAlias }, { [collSemantic.id]: collSemantic, [collPrimitive.id]: collPrimitive });
  assert.equal(res.error, undefined);
  assert.equal(res.value, 16, "Must fall back to target collection defaultModeId value 16");
});

test("P1-08: Boolean false and numeric 0 are preserved faithfully without falsy drops", async () => {
  const { resolveVariableToLiteral } = await import("../tooling/d2c/normalizer/variables.js");

  const coll = {
    id: "coll_1",
    name: "Configs",
    modes: [{ id: "m1", name: "Default" }],
    defaultModeId: "m1",
  };

  const varZero = {
    id: "var_zero",
    name: "border/width/none",
    type: "FLOAT" as const,
    collectionId: "coll_1",
    valuesByMode: {
      // Both kind wrapped and raw Figma number
      m1: { kind: "FLOAT" as const, value: 0 },
    },
  };

  const varFalse = {
    id: "var_false",
    name: "feature/enabled",
    type: "BOOLEAN" as const,
    collectionId: "coll_1",
    valuesByMode: {
      // Both kind wrapped and raw Figma boolean
      m1: { kind: "BOOLEAN" as const, value: false },
    },
  };

  const zeroRes = resolveVariableToLiteral(varZero, "m1", { [varZero.id]: varZero }, { [coll.id]: coll });
  assert.equal(zeroRes.value, 0, "Numeric 0 must be preserved");

  const falseRes = resolveVariableToLiteral(varFalse, "m1", { [varFalse.id]: varFalse }, { [coll.id]: coll });
  assert.equal(falseRes.value, false, "Boolean false must be preserved");
});

test("P1-08: Raw Figma API VariableValue forms (number, boolean, string, alias object) are supported", async () => {
  const { resolveVariableToLiteral } = await import("../tooling/d2c/normalizer/variables.js");

  const coll = {
    id: "coll_figma",
    name: "FigmaNative",
    modes: [{ id: "m1", name: "Default" }],
    defaultModeId: "m1",
  };

  const targetVar: any = {
    id: "raw_target",
    name: "spacing/pad",
    type: "FLOAT",
    collectionId: "coll_figma",
    valuesByMode: {
      m1: 0, // raw number 0 from Figma API
    },
  };

  const aliasVar: any = {
    id: "raw_alias",
    name: "padding/none",
    type: "FLOAT",
    collectionId: "coll_figma",
    valuesByMode: {
      m1: { type: "VARIABLE_ALIAS", id: "raw_target" }, // raw Figma alias
    },
  };

  const rawBool: any = {
    id: "raw_bool",
    name: "visible",
    type: "BOOLEAN",
    collectionId: "coll_figma",
    valuesByMode: {
      m1: false, // raw boolean false from Figma API
    },
  };

  const varById = { [targetVar.id]: targetVar, [aliasVar.id]: aliasVar, [rawBool.id]: rawBool };
  const collById = { [coll.id]: coll };

  const resAlias = resolveVariableToLiteral(aliasVar, "m1", varById, collById);
  assert.equal(resAlias.error, undefined);
  assert.equal(resAlias.value, 0, "Raw Figma alias to numeric 0 must resolve to 0");

  const resBool = resolveVariableToLiteral(rawBool, "m1", varById, collById);
  assert.equal(resBool.error, undefined);
  assert.equal(resBool.value, false, "Raw Figma boolean false must resolve to false");
});

