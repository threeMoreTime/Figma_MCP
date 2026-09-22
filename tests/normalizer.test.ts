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
