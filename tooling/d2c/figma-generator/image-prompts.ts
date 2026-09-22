/**
 * GPT Image Prompt Generator (Visual Reference Exploration)
 *
 * Translates Design Brief and Screen Blueprint into structured GPT Image Prompts.
 *
 * NOTE: GPT Image prompts are strictly for visual exploration and mood inspiration.
 * They are NEVER used as data source for Native Figma Generation.
 */

import { SCHEMA_VERSION } from "../contracts/schema.js";
import {
  VisualPromptsDocumentSchema,
  type VisualPromptsDocument,
  type DesignBrief,
  type ScreenBlueprint,
  type GPTImagePromptItem,
} from "../blueprint/schema.js";

export function generateVisualPrompts(
  brief: DesignBrief,
  blueprint: ScreenBlueprint
): VisualPromptsDocument {
  const directionKey = blueprint.selectedDirection || brief.selectedDirection;
  if (!directionKey) {
    throw new Error("HUMAN_GATE_REQUIRED: select design direction A/B/C before generating GPT Image prompts.");
  }
  const direction = brief.visualDirections[directionKey];

  const componentNames = blueprint.components.map((c) => {
    if (c.intent === "primary-action") return "PrimaryButton";
    if (c.intent === "data-table") return "DataTable";
    if (c.intent === "filter-search") return "FilterBar";
    if (c.intent === "modal-dialog") return "ModalDialog";
    if (c.intent === "form-container") return "DataForm";
    if (c.intent === "page-header") return "PageHeader";
    return c.component;
  });

  const uniqueComponentNames = Array.from(new Set(componentNames));

  const standardAvoidList = [
    "glassmorphism",
    "gradient",
    "neon glows",
    "3D claymorphism",
    "hallucinated buttons",
    "unaligned layouts",
    "decorative 3D illustrations in functional tables",
  ];

  const prompts: GPTImagePromptItem[] = blueprint.states.map((state) => {
    let stateStyle = `${direction.name} enterprise SaaS UI`;
    if (state === "loading") stateStyle += " with skeleton loading indicators";
    if (state === "empty") stateStyle += " with clean empty-state vector placeholder";
    if (state === "error") stateStyle += " with inline error banner notice";

    return {
      screen: blueprint.screenId,
      state,
      prompt: {
        style: stateStyle,
        density: direction.density,
        components: uniqueComponentNames,
        avoid: standardAvoidList,
      },
    };
  });

  const doc = {
    schemaVersion: SCHEMA_VERSION,
    screenId: blueprint.screenId,
    role: "VISUAL_EXPLORATION_ONLY" as const,
    prompts,
    notice:
      "GPT Image prompts are strictly for visual exploration and mood board inspiration. They are NEVER used as data source for Native Figma Generation.",
  };

  return VisualPromptsDocumentSchema.parse(doc);
}
