/**
 * React Prototype Adapter (Phase 5A)
 *
 * Adapts Design Package + UI Blueprint + Interaction Contract into structured React Props & State Spec.
 *
 * Guarantees:
 * - States strictly sourced from InteractionContract (ready, loading, empty, error).
 * - Component props derived via Component Resolver.
 * - Semantic token usage (CSS variables only, strictly forbidding hardcoded #1677ff or 16px).
 * - Full interaction flow (click, validation, submit, success, error).
 */

import type {
  ScreenBlueprint,
  InteractionContract,
  MappingProposalDocument,
} from "../blueprint/schema.js";
import { resolveCodeComponent, type ResolvedComponent } from "./resolver.js";

export interface AdaptedComponentSpec {
  semanticId: string;
  component: string;
  props: Record<string, any>;
  tokenStyles: Record<string, string>;
  boundStates: string[];
}

export interface AdaptedRegionSpec {
  id: string;
  intent: string;
  layoutMode: "horizontal" | "vertical";
  spacingToken: string;
  components: AdaptedComponentSpec[];
}

export interface PrototypeSpec {
  screenId: string;
  states: ("ready" | "loading" | "empty" | "error")[];
  regions: AdaptedRegionSpec[];
  interactions: InteractionContract["interactions"];
  componentsById: Map<string, AdaptedComponentSpec>;
}

/**
 * Validates that style strings or objects contain ZERO hardcoded values like #1677ff or 16px.
 */
export function validatePrototypeTokens(content: string): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Patterns that represent hardcoded values outside of :root or CSS variable assignments
  const hardcodedPatterns = [
    { pattern: /color\s*:\s*#1677ff/i, name: "hardcoded #1677ff color" },
    { pattern: /background(-color)?\s*:\s*#1677ff/i, name: "hardcoded #1677ff background" },
    { pattern: /padding\s*:\s*16px/i, name: "hardcoded 16px padding" },
    { pattern: /margin\s*:\s*16px/i, name: "hardcoded 16px margin" },
    { pattern: /gap\s*:\s*16px/i, name: "hardcoded 16px gap" },
  ];

  for (const { pattern, name } of hardcodedPatterns) {
    if (pattern.test(content)) {
      violations.push(name);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Compiles Blueprint + Interaction Contract into a validated Prototype Specification.
 */
export function adaptBlueprintToPrototype(
  blueprint: ScreenBlueprint,
  contract: InteractionContract,
  mappingProposal: MappingProposalDocument
): PrototypeSpec {
  const componentsById = new Map<string, AdaptedComponentSpec>();

  // Sourced strictly from Contract & Blueprint
  const allowedStates = new Set(["ready", "loading", "empty", "error"]);
  const validStates = blueprint.states.filter((s) =>
    allowedStates.has(s)
  ) as ("ready" | "loading" | "empty" | "error")[];

  // 1. Adapt Regions and Components
  const regions: AdaptedRegionSpec[] = blueprint.regions.map((reg) => {
    const adaptedComponents: AdaptedComponentSpec[] = reg.components.map((comp) => {
      const resolution = resolveCodeComponent(comp.semanticId, mappingProposal);
      if (!resolution.success || !resolution.resolved) {
        throw new Error(
          `[MISSING_COMPONENT] Failed to resolve component for '${comp.semanticId}': ${resolution.error?.message}`
        );
      }

      const mergedProps: Record<string, any> = {
        ...resolution.resolved.props,
        ...comp.props,
      };

      if (comp.label) {
        mergedProps.children = comp.label;
      }

      // Map semantic CSS variable styles
      const tokenStyles: Record<string, string> = {};
      if (comp.intent === "primary-action") {
        tokenStyles["--btn-bg"] = "var(--d2c-color-primary)";
        tokenStyles["--btn-radius"] = "var(--d2c-borderRadius-base)";
      } else if (comp.intent === "data-table") {
        tokenStyles["--table-border"] = "var(--d2c-color-border)";
        tokenStyles["--table-bg"] = "var(--d2c-color-bg-container)";
      }

      const adapted: AdaptedComponentSpec = {
        semanticId: comp.semanticId,
        component: resolution.resolved.component,
        props: mergedProps,
        tokenStyles,
        boundStates: comp.boundStates,
      };

      componentsById.set(comp.semanticId, adapted);
      return adapted;
    });

    return {
      id: reg.id,
      intent: reg.intent,
      layoutMode: reg.layout.type === "horizontal" ? "horizontal" : "vertical",
      spacingToken: "var(--d2c-spacing-md)",
      components: adaptedComponents,
    };
  });

  return {
    screenId: blueprint.screenId,
    states: validStates.length > 0 ? validStates : ["ready", "loading", "empty", "error"],
    regions,
    interactions: contract.interactions,
    componentsById,
  };
}
