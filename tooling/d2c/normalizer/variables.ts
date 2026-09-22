/**
 * Variable & Alias Resolution Engine
 *
 * Concepts adapted from:
 * https://github.com/arifinbardansyah/design-to-code-json
 * Commit: 0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94
 * File: src/transform.ts (lines 101-119)
 * License: MIT (Copyright 2026 Arifin Bardansyah)
 *
 * Refactored to:
 * 1. Output full resolution paths and retain semantic alias metadata.
 * 2. Prevent infinite loops on cyclic aliases.
 * 3. Return explicit structured diagnostics rather than silent nulls.
 */

import { rgbaToHex, type Rgba } from "./color.js";

export type RawValue =
  | { kind: "COLOR"; rgba: Rgba }
  | { kind: "FLOAT"; value: number }
  | { kind: "STRING"; value: string }
  | { kind: "BOOLEAN"; value: boolean }
  | { kind: "ALIAS"; id: string; name?: string };

export interface RawVariable {
  id: string;
  name: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  collectionId: string;
  valuesByMode: Record<string, RawValue>;
}

export interface RawCollection {
  id: string;
  name: string;
  modes: Array<{ id: string; name: string }>;
  defaultModeId: string;
}

export interface ResolutionResult {
  value: string | number | boolean | null;
  resolvedPath: string[];
  isAlias: boolean;
  resolutionRationale: "EXPLICIT_MODE" | "INHERITED_DEFAULT" | "API_RESOLVED" | "UNKNOWN_MODE";
  error?: "CYCLE_DETECTED" | "TARGET_NOT_FOUND" | "UNRESOLVED_MODE";
}

export function resolveVariableToLiteral(
  variable: RawVariable,
  modeId: string,
  varById: Record<string, RawVariable>,
  collById: Record<string, RawCollection>,
  seenIds: Set<string> = new Set(),
  pathAcc: string[] = []
): ResolutionResult {
  const coll = collById[variable.collectionId];
  const collName = coll ? coll.name : variable.collectionId;
  const currentPath = [...pathAcc, `${collName}:${variable.name}`];

  if (seenIds.has(variable.id)) {
    return {
      value: null,
      resolvedPath: currentPath,
      isAlias: true,
      resolutionRationale: "UNKNOWN_MODE",
      error: "CYCLE_DETECTED",
    };
  }
  seenIds.add(variable.id);

  let rawVal: RawValue | undefined = variable.valuesByMode[modeId];
  let rationale: ResolutionResult["resolutionRationale"] = "EXPLICIT_MODE";

  if (!rawVal && coll && coll.defaultModeId) {
    rawVal = variable.valuesByMode[coll.defaultModeId];
    if (rawVal) {
      rationale = "INHERITED_DEFAULT";
    }
  }

  if (!rawVal) {
    return {
      value: null,
      resolvedPath: currentPath,
      isAlias: false,
      resolutionRationale: "UNKNOWN_MODE",
      error: "UNRESOLVED_MODE",
    };
  }

  if (rawVal.kind === "COLOR") {
    return { value: rgbaToHex(rawVal.rgba), resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
  }
  if (rawVal.kind === "FLOAT" || rawVal.kind === "STRING" || rawVal.kind === "BOOLEAN") {
    return { value: rawVal.value, resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
  }

  // Handle ALIAS
  const targetVar = varById[rawVal.id];
  if (!targetVar) {
    return {
      value: null,
      resolvedPath: [...currentPath, `alias:${rawVal.id}`],
      isAlias: true,
      resolutionRationale: rationale,
      error: "TARGET_NOT_FOUND",
    };
  }

  const sub = resolveVariableToLiteral(
    targetVar,
    modeId,
    varById,
    collById,
    new Set(seenIds),
    currentPath
  );
  return {
    ...sub,
    isAlias: true,
    resolutionRationale: rationale,
  };
}
