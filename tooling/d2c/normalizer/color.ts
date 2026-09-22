/**
 * Color conversion utility.
 *
 * Sourced from:
 * https://github.com/arifinbardansyah/design-to-code-json
 * Commit: 0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94
 * File: src/transform.ts (lines 57-60)
 * License: MIT (Copyright 2026 Arifin Bardansyah)
 *
 * Modified: Self-contained ESM export with strict typing.
 */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const hex2 = (v: number) =>
  Math.max(0, Math.min(255, Math.round(v * 255)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();

/**
 * Converts `{ r, g, b, a }` (0..1) to `#RRGGBB` (if opaque) or `#RRGGBBAA` (if translucent).
 */
export function rgbaToHex(c: Rgba): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
  return c.a >= 1 ? base : `${base}${hex2(c.a)}`;
}
