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
  | { kind: "ALIAS"; id: string; name?: string }
  | { type: "VARIABLE_ALIAS"; id: string }
  | number
  | boolean
  | string
  | Rgba;

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

  if (rawVal === undefined && coll && coll.defaultModeId) {
    rawVal = variable.valuesByMode[coll.defaultModeId];
    if (rawVal !== undefined) {
      rationale = "INHERITED_DEFAULT";
    }
  }

  if (rawVal === undefined || rawVal === null) {
    return {
      value: null,
      resolvedPath: currentPath,
      isAlias: false,
      resolutionRationale: "UNKNOWN_MODE",
      error: "UNRESOLVED_MODE",
    };
  }

  // Primitive direct types (from Figma API raw VariableValue)
  if (typeof rawVal === "number" || typeof rawVal === "boolean" || typeof rawVal === "string") {
    return { value: rawVal, resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
  }

  // Object-wrapped types
  if (typeof rawVal === "object") {
    // Wrapped DTCG/custom kind
    if ("kind" in rawVal) {
      if (rawVal.kind === "COLOR") {
        return { value: rgbaToHex(rawVal.rgba), resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
      }
      if (rawVal.kind === "FLOAT" || rawVal.kind === "STRING" || rawVal.kind === "BOOLEAN") {
        return { value: rawVal.value, resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
      }
    }

    // Direct RGBA object { r, g, b, a? }
    if ("r" in rawVal && "g" in rawVal && "b" in rawVal) {
      return { value: rgbaToHex(rawVal as any), resolvedPath: currentPath, isAlias: false, resolutionRationale: rationale };
    }

    // ALIAS (kind: "ALIAS" or type: "VARIABLE_ALIAS")
    const isAlias =
      ("kind" in rawVal && rawVal.kind === "ALIAS") ||
      ("type" in rawVal && (rawVal as any).type === "VARIABLE_ALIAS");

    if (isAlias && "id" in rawVal && typeof (rawVal as any).id === "string") {
      const targetId = (rawVal as any).id;
      const targetVar = varById[targetId];
      if (!targetVar) {
        return {
          value: null,
          resolvedPath: [...currentPath, `alias:${targetId}`],
          isAlias: true,
          resolutionRationale: rationale,
          error: "TARGET_NOT_FOUND",
        };
      }

      // Cross-collection mode resolution:
      // When alias points to another collection, resolve mode using target collection's matching mode name or defaultModeId
      let targetModeId = modeId;
      if (targetVar.collectionId !== variable.collectionId) {
        const targetColl = collById[targetVar.collectionId];
        const currentModeName = coll?.modes?.find((m) => m.id === modeId)?.name;
        const matchingTargetMode = targetColl?.modes?.find(
          (m) => currentModeName && m.name.toLowerCase() === currentModeName.toLowerCase()
        );

        if (matchingTargetMode) {
          targetModeId = matchingTargetMode.id;
        } else if (targetColl?.defaultModeId) {
          targetModeId = targetColl.defaultModeId;
        } else if (targetVar.valuesByMode) {
          targetModeId = Object.keys(targetVar.valuesByMode)[0] || modeId;
        }
      }

      const sub = resolveVariableToLiteral(
        targetVar,
        targetModeId,
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
  }

  return {
    value: null,
    resolvedPath: currentPath,
    isAlias: false,
    resolutionRationale: "UNKNOWN_MODE",
    error: "UNRESOLVED_MODE",
  };
}

