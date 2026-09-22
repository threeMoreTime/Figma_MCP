/**
 * Safe Variable Catalog Builder
 *
 * Replaces the lossy buildFlatCatalog from design-to-code-json.
 * Key enhancements:
 * 1. Indexes by Compound Key `${collectionName}/${variableName}` to prevent silent collisions.
 * 2. Retains explicit mode objects even when only a single mode is emitted (prevents polymorphic collapsing).
 * 3. Records diagnostics for unresolvable variables or cycles.
 */

import {
  resolveVariableToLiteral,
  type RawVariable,
  type RawCollection,
  type ResolutionResult,
} from "./variables.js";
import type { Diagnostic } from "../contracts/schema.js";

export interface SafeCatalogEntry {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  type: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode: Record<string, string | number | boolean>;
  modeResolutionRationale: Record<string, "EXPLICIT_MODE" | "INHERITED_DEFAULT" | "API_RESOLVED" | "UNKNOWN_MODE">;
  resolvedPathsByMode: Record<string, string[]>;
  diagnostics: Diagnostic[];
}

export interface SafeCatalog {
  entries: Record<string, SafeCatalogEntry>;
  displayIndex: Record<string, string>;
  collections: string[];
  diagnostics: Diagnostic[];
}

export function buildSafeCatalog(
  variables: RawVariable[],
  collections: RawCollection[]
): SafeCatalog {
  const collById: Record<string, RawCollection> = {};
  for (const c of collections) {
    collById[c.id] = c;
  }

  const varById: Record<string, RawVariable> = {};
  for (const v of variables) {
    varById[v.id] = v;
  }

  const catalog: SafeCatalog = {
    entries: {},
    displayIndex: {},
    collections: collections.map((c) => c.name),
    diagnostics: [],
  };

  for (const v of variables) {
    const coll = collById[v.collectionId];
    const collName = coll ? coll.name : "UnknownCollection";
    const machineKey = `${v.collectionId}::${v.id}`;
    const displayName = `${collName}/${v.name}`;

    // Machine identity separation: Check display name collision
    if (catalog.displayIndex[displayName]) {
      catalog.diagnostics.push({
        code: "DISPLAY_NAME_COLLISION_DETECTED",
        message: `Two variables share display name '${displayName}'. Disambiguated by machine IDs: '${catalog.displayIndex[displayName]}' vs '${machineKey}'`,
        severity: "WARNING",
        details: { existingKey: catalog.displayIndex[displayName], newKey: machineKey },
      });
    } else {
      catalog.displayIndex[displayName] = machineKey;
    }

    const entry: SafeCatalogEntry = {
      id: v.id,
      name: v.name,
      collectionId: v.collectionId,
      collectionName: collName,
      type: v.type,
      valuesByMode: {},
      modeResolutionRationale: {},
      resolvedPathsByMode: {},
      diagnostics: [],
    };

    const modesToProcess = coll ? coll.modes : [{ id: "default", name: "default" }];
    for (const m of modesToProcess) {
      const res: ResolutionResult = resolveVariableToLiteral(
        v,
        m.id,
        varById,
        collById
      );

      if (res.error) {
        entry.diagnostics.push({
          code: res.error,
          message: `Variable ${v.name} mode ${m.name} failed resolution: ${res.error}`,
          severity: "ERROR",
          path: res.resolvedPath.join(" -> "),
        });
        catalog.diagnostics.push({
          code: res.error,
          message: `Variable ${machineKey} [mode ${m.name}] resolution failure: ${res.error}`,
          severity: "ERROR",
        });
      } else if (res.value !== null) {
        entry.valuesByMode[m.name] = res.value;
        entry.modeResolutionRationale[m.name] = res.resolutionRationale;
        entry.resolvedPathsByMode[m.name] = res.resolvedPath;
      }
    }

    catalog.entries[machineKey] = entry;
    // Backward compatibility: also index under compound display name if not yet claimed
    if (!catalog.entries[displayName]) {
      catalog.entries[displayName] = entry;
    }
  }

  return catalog;
}
