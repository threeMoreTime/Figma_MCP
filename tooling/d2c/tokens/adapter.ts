/**
 * Tokens Studio Format Adapter
 *
 * Distinguishes Legacy Tokens Studio JSON format (value, type)
 * from W3C DTCG standard format ($value, $type).
 * Normalizes inputs into deterministic DTCG tokens for Style Dictionary.
 */

import type { Diagnostic } from "../contracts/schema.js";

export interface AdaptedTokensResult {
  tokens: Record<string, unknown>;
  detectedFormat: "DTCG" | "LEGACY_TOKENS_STUDIO" | "MIXED";
  diagnostics: Diagnostic[];
}

export function adaptTokensStudioInput(
  rawTokens: Record<string, unknown>
): AdaptedTokensResult {
  const diagnostics: Diagnostic[] = [];
  let dtcgCount = 0;
  let legacyCount = 0;

  function traverse(node: unknown, path: string[]): unknown {
    if (node === null || typeof node !== "object") {
      return node;
    }

    if (Array.isArray(node)) {
      return node.map((item, idx) => traverse(item, [...path, String(idx)]));
    }

    const obj = node as Record<string, unknown>;

    // Check for DTCG standard token ($value)
    if ("$value" in obj) {
      dtcgCount++;
      const res: Record<string, unknown> = {
        $value: obj.$value,
        $type: obj.$type || "custom",
      };
      if (obj.$description) res.$description = obj.$description;
      return res;
    }

    // Check for Legacy Tokens Studio token (value)
    if ("value" in obj && ("type" in obj || typeof obj.value === "string" || typeof obj.value === "number")) {
      legacyCount++;
      const val = obj.value;
      const type = (obj.type as string) || "custom";

      // Detect unsupported composite types (e.g. typography composite objects)
      if (typeof val === "object" && val !== null) {
        diagnostics.push({
          code: "COMPOSITE_TOKEN_DETECTED",
          message: `Composite token at ${path.join(".")} of type '${type}' detected. Requires explicit decomposition.`,
          severity: "WARNING",
          path: path.join("."),
          details: { compositeValue: val },
        });
      }

      const res: Record<string, unknown> = {
        $value: val,
        $type: type,
      };
      if (obj.description) res.$description = obj.description;
      return res;
    }

    // Nested branch
    const normalized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      normalized[k] = traverse(v, [...path, k]);
    }
    return normalized;
  }

  const tokens = traverse(rawTokens, []) as Record<string, unknown>;

  let detectedFormat: "DTCG" | "LEGACY_TOKENS_STUDIO" | "MIXED" = "DTCG";
  if (legacyCount > 0 && dtcgCount === 0) {
    detectedFormat = "LEGACY_TOKENS_STUDIO";
  } else if (legacyCount > 0 && dtcgCount > 0) {
    detectedFormat = "MIXED";
    diagnostics.push({
      code: "MIXED_TOKEN_FORMATS",
      message: `Mixed token properties found: ${dtcgCount} DTCG tokens ($value) and ${legacyCount} Legacy tokens (value).`,
      severity: "INFO",
    });
  }

  return {
    tokens,
    detectedFormat,
    diagnostics,
  };
}
