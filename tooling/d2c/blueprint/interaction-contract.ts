/**
 * Interaction Contract Generator & Validator
 *
 * Models state transitions, actions (click, submit, validation, success, error),
 * and target references, ensuring all sources and targets map to real blueprint components.
 */

import { SCHEMA_VERSION, type Diagnostic } from "../contracts/schema.js";
import {
  InteractionContractSchema,
  type InteractionContract,
  type ScreenBlueprint,
  type InteractionStep,
} from "./schema.js";

export function generateInteractionContract(blueprint: {
  screenId: string;
  components: Array<{ semanticId: string; intent?: string; component?: string }>;
}): InteractionContract {
  const { screenId, components } = blueprint;

  const btn =
    components.find((c) => c.intent === "primary-action") ||
    components.find((c) => c.component === "Button") ||
    components[0];

  const modal =
    components.find((c) => c.intent === "modal-dialog") ||
    components.find((c) => c.component === "Modal");

  const form =
    components.find((c) => c.intent === "form-container") ||
    components.find((c) => c.component === "Form");

  const table =
    components.find((c) => c.intent === "data-table") ||
    components.find((c) => c.component === "Table");

  const interactions: InteractionStep[] = [];

  const sourceBtnId = btn?.semanticId || `${screenId}.create_btn`;
  const targetModalId = modal?.semanticId || sourceBtnId;
  const formId = form?.semanticId || sourceBtnId;
  const tableId = table?.semanticId || sourceBtnId;

  // 1. Click open modal
  interactions.push({
    id: "int-click-create",
    event: `click:${sourceBtnId}`,
    source: sourceBtnId,
    action: "open-modal",
    target: targetModalId,
  });

  // 2. Form field validation
  interactions.push({
    id: "int-validate-form",
    event: `validation:${formId}`,
    source: formId,
    action: "validate-fields",
    target: formId,
    validationRules: [
      { field: "username", rule: "required" },
      { field: "role", rule: "required" },
    ],
  });

  // 3. Form submit
  interactions.push({
    id: "int-submit-form",
    event: `submit:${formId}`,
    source: formId,
    action: "submit-form",
    target: targetModalId,
  });

  // 4. Success feedback & refresh
  interactions.push({
    id: "int-success-form",
    event: `success:${formId}`,
    source: formId,
    action: "show-notification",
    target: tableId,
    onSuccess: {
      action: "refresh-table",
      feedback: "保存成功",
      target: tableId,
    },
  });

  // 5. Error feedback
  interactions.push({
    id: "int-error-form",
    event: `error:${formId}`,
    source: formId,
    action: "show-notification",
    target: formId,
    onError: {
      action: "show-error-message",
      feedback: "提交失败，请检查填写内容",
      target: formId,
    },
  });

  return InteractionContractSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    screenId,
    interactions,
    diagnostics: [],
  });
}

export function validateInteractionContract(
  contract: InteractionContract,
  blueprint: {
    screenId: string;
    components: Array<{ semanticId: string }>;
  }
): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const componentIds = new Set(blueprint.components.map((c) => c.semanticId));

  for (const interaction of contract.interactions) {
    if (!componentIds.has(interaction.source)) {
      diagnostics.push({
        code: "INVALID_INTERACTION_SOURCE",
        message: `Interaction '${interaction.id}' specifies source '${interaction.source}' which does not exist in blueprint components.`,
        severity: "ERROR",
        path: `interactions.${interaction.id}.source`,
        details: { source: interaction.source },
      });
    }

    if (!componentIds.has(interaction.target)) {
      diagnostics.push({
        code: "INVALID_INTERACTION_TARGET",
        message: `Interaction '${interaction.id}' specifies target '${interaction.target}' which does not exist in blueprint components.`,
        severity: "ERROR",
        path: `interactions.${interaction.id}.target`,
        details: { target: interaction.target },
      });
    }
  }

  return {
    valid: diagnostics.length === 0,
    diagnostics,
  };
}
