/**
 * Catalog Validator for Component Intents
 *
 * Enforces that all design component intents originate from design system standards.
 * Strictly forbids hallucinating components (e.g. SmartButton, AIButton, FancyTable).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentIntent, ComponentIntentCatalog } from "./schema.js";
import type { Diagnostic } from "../contracts/schema.js";
import defaultCatalogJson from "./component-intent-catalog.json" with { type: "json" };

export function loadDefaultCatalog(): ComponentIntentCatalog {
  return defaultCatalogJson as ComponentIntentCatalog;
}

/**
 * Validates a single component intent against the design system catalog.
 */
export function validateComponentIntent(
  intent: ComponentIntent,
  catalog: ComponentIntentCatalog = loadDefaultCatalog()
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const intentDef = catalog[intent.intent];
  if (!intentDef) {
    diagnostics.push({
      code: "UNKNOWN_COMPONENT_INTENT",
      message: `Unknown component intent '${intent.intent}'. Custom or hallucinated intent names are strictly forbidden; select from standard design system catalog.`,
      severity: "ERROR",
      path: intent.semanticId,
      details: { intent: intent.intent },
    });
    return diagnostics;
  }

  // Component name check
  if (!intentDef.allowedComponents.includes(intent.component)) {
    diagnostics.push({
      code: "DISALLOWED_COMPONENT_FOR_INTENT",
      message: `Component '${intent.component}' is disallowed for intent '${intent.intent}'. Allowed components are: [${intentDef.allowedComponents.join(
        ", "
      )}]. Hallucinated component names (e.g. SmartButton, AIButton, FancyTable) are forbidden.`,
      severity: "ERROR",
      path: intent.semanticId,
      details: { component: intent.component, allowedComponents: intentDef.allowedComponents },
    });
  }

  // Variant check
  if (intent.variant && intent.variant !== "default" && intentDef.allowedVariants) {
    if (!intentDef.allowedVariants.includes(intent.variant)) {
      diagnostics.push({
        code: "INVALID_COMPONENT_VARIANT",
        message: `Variant '${intent.variant}' is not recognized for intent '${intent.intent}'. Allowed: [${intentDef.allowedVariants.join(
          ", "
        )}].`,
        severity: "WARNING",
        path: intent.semanticId,
      });
    }
  }

  return diagnostics;
}

/**
 * Validates a list of component intents for uniqueness and catalog compliance.
 */
export function validateBlueprintComponents(
  components: ComponentIntent[],
  catalog: ComponentIntentCatalog = loadDefaultCatalog()
): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const seenIds = new Set<string>();

  for (const comp of components) {
    // 1. Semantic ID uniqueness check
    if (seenIds.has(comp.semanticId)) {
      diagnostics.push({
        code: "DUPLICATE_SEMANTIC_ID",
        message: `Duplicate semanticId '${comp.semanticId}' found in blueprint. Semantic IDs must be unique across the screen.`,
        severity: "ERROR",
        path: comp.semanticId,
      });
    } else {
      seenIds.add(comp.semanticId);
    }

    // 2. Catalog compliance check
    const compDiags = validateComponentIntent(comp, catalog);
    diagnostics.push(...compDiags);
  }

  const valid = diagnostics.every((d) => d.severity !== "ERROR");
  return { valid, diagnostics };
}
