/**
 * Token Variable Binding Engine
 *
 * Maps canonical tokens to Figma Variables across Color, Spacing, Radius, and Typography.
 * Strictly forbids unmapped hardcoded values (e.g. #1677ff, 16px).
 */

import { type Diagnostic } from "../contracts/schema.js";

export interface TokenVariableDef {
  tokenPath: string;
  figmaVariableName: string;
  type: "COLOR" | "FLOAT" | "STRING";
  resolvedValue: string | number;
  collection: "Colors" | "Spacing" | "Radius" | "Typography";
}

export interface VariableBindingTarget {
  property: "fills" | "strokes" | "itemSpacing" | "padding" | "cornerRadius" | "fontSize";
  variableToken: string;
  fallbackValue: string | number;
}

export interface TokenRegistry {
  variables: Map<string, TokenVariableDef>;
  componentBindings: Map<string, string>; // propertyKey -> variableToken
}

/**
 * Flattens DTCG canonical token hierarchy into Figma Variable definitions.
 */
export function buildTokenRegistry(canonicalTokens: any): TokenRegistry {
  const variables = new Map<string, TokenVariableDef>();
  const componentBindings = new Map<string, string>();

  function resolveValue(val: any): string | number {
    if (typeof val !== "string") return val;
    if (val.startsWith("{") && val.endsWith("}")) {
      const refPath = val.slice(1, -1).trim();
      const parts = refPath.split(".");
      let curr: any = canonicalTokens;
      for (const p of parts) {
        if (!curr || typeof curr !== "object") return val;
        curr = curr[p];
      }
      if (curr && typeof curr === "object" && "$value" in curr) {
        return resolveValue(curr.$value);
      }
    }
    return val;
  }

  function traverse(obj: any, path: string[]) {
    if (!obj || typeof obj !== "object") return;

    if ("$value" in obj) {
      const tokenPath = path.join(".");
      const rawVal = obj.$value;
      const resolved = resolveValue(rawVal);
      const tokenType = obj.$type || "string";

      let collection: "Colors" | "Spacing" | "Radius" | "Typography" = "Colors";
      let figmaType: "COLOR" | "FLOAT" | "STRING" = "STRING";

      if (tokenType === "color" || path[0] === "color") {
        collection = "Colors";
        figmaType = "COLOR";
      } else if (path[0] === "spacing") {
        collection = "Spacing";
        figmaType = "FLOAT";
      } else if (path[0] === "borderRadius") {
        collection = "Radius";
        figmaType = "FLOAT";
      } else if (path[0] === "fontSize") {
        collection = "Typography";
        figmaType = "FLOAT";
      }

      const figmaVariableName = path.join("/");
      variables.set(tokenPath, {
        tokenPath,
        figmaVariableName,
        type: figmaType,
        resolvedValue: resolved,
        collection,
      });
      return;
    }

    for (const key of Object.keys(obj)) {
      if (key.startsWith("$") || key === "metadata") continue;
      traverse(obj[key], [...path, key]);
    }
  }

  traverse(canonicalTokens, []);

  // Standard component semantic binding references
  componentBindings.set("Button.Primary.background", "color.primary");
  componentBindings.set("Button.Primary.color", "color.neutral.white");
  componentBindings.set("Button.Primary.cornerRadius", "borderRadius.base");
  componentBindings.set("Frame.Page.fills", "color.bg.container");
  componentBindings.set("Frame.Page.padding", "spacing.lg");
  componentBindings.set("Frame.Toolbar.gap", "spacing.sm");
  componentBindings.set("Table.border", "color.border");
  componentBindings.set("Table.background", "color.bg.container");
  componentBindings.set("Input.border", "color.border");
  componentBindings.set("Input.cornerRadius", "borderRadius.base");

  return { variables, componentBindings };
}

/**
 * Validates whether a variable binding maps to a known canonical token.
 * Forbids unmapped hardcoded values.
 */
export function validateVariableBinding(
  binding: VariableBindingTarget,
  registry: TokenRegistry
): { valid: boolean; diagnostic?: Diagnostic } {
  const { variableToken, fallbackValue, property } = binding;

  if (!variableToken || variableToken === "HARDCODED") {
    return {
      valid: false,
      diagnostic: {
        code: "HARDCODED_VALUE_FORBIDDEN",
        message: `Property '${property}' has hardcoded value '${fallbackValue}' without a valid Figma Variable token.`,
        severity: "ERROR",
        details: { property, fallbackValue },
      },
    };
  }

  const def = registry.variables.get(variableToken);
  if (!def) {
    return {
      valid: false,
      diagnostic: {
        code: "MISSING_TOKEN_VARIABLE",
        message: `Variable token '${variableToken}' is not defined in canonical tokens registry.`,
        severity: "ERROR",
        details: { variableToken, property },
      },
    };
  }

  return { valid: true };
}
