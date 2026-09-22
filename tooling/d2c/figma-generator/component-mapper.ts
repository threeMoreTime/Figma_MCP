/**
 * Component Mapping Proposal Generator
 *
 * Maps Screen Blueprint component intents to Figma Design System component candidates.
 * Enforces mandatory human confirmation and strictly forbids automatic publishing.
 */

import { SCHEMA_VERSION, type Diagnostic } from "../contracts/schema.js";
import {
  MappingProposalDocumentSchema,
  type MappingProposalDocument,
  type MappingProposalItem,
  type ScreenBlueprint,
  type ComponentIntentCatalog,
} from "../blueprint/schema.js";

const DEFAULT_INTENT_FIGMA_MAP: Record<string, string> = {
  "primary-action": "DS/Button.Primary",
  "secondary-action": "DS/Button.Default",
  "destructive-action": "DS/Button.Danger",
  "data-table": "DS/Table.DataTable",
  "filter-search": "DS/Input.Search",
  "status-indicator": "DS/Tag.Status",
  "modal-dialog": "DS/Modal.Standard",
  "form-container": "DS/Form.VerticalContainer",
  "form-field": "DS/Input.Text",
  "page-header": "DS/Header.PageHeader",
  "alert-notice": "DS/Alert.Notice",
  "empty-placeholder": "DS/Empty.Placeholder",
};

export function generateMappingProposal(
  blueprint: ScreenBlueprint,
  catalog: ComponentIntentCatalog
): MappingProposalDocument {
  const diagnostics: Diagnostic[] = [];

  const mappings: MappingProposalItem[] = blueprint.components.map((comp) => {
    const intentDef = catalog[comp.intent];

    if (!intentDef) {
      diagnostics.push({
        code: "UNRESOLVED_COMPONENT_INTENT",
        message: `Component '${comp.semanticId}' uses unknown intent '${comp.intent}'.`,
        severity: "WARNING",
        details: { semanticId: comp.semanticId, intent: comp.intent },
      });

      return {
        semanticId: comp.semanticId,
        intent: comp.intent,
        candidate: {
          figmaComponent: "UNRESOLVED",
          status: "UNRESOLVED" as const,
          reason: `Intent '${comp.intent}' is not registered in component-intent-catalog.`,
        },
      };
    }

    const figmaTarget = DEFAULT_INTENT_FIGMA_MAP[comp.intent];

    if (!figmaTarget) {
      diagnostics.push({
        code: "UNRESOLVED_FIGMA_COMPONENT_MAPPING",
        message: `No approved Figma component mapping exists for intent '${comp.intent}'.`,
        severity: "WARNING",
        details: { semanticId: comp.semanticId, intent: comp.intent },
      });
      return {
        semanticId: comp.semanticId,
        intent: comp.intent,
        candidate: {
          figmaComponent: "UNRESOLVED",
          status: "UNRESOLVED" as const,
          reason: "No approved mapping exists; human review required.",
        },
      };
    }

    return {
      semanticId: comp.semanticId,
      intent: comp.intent,
      candidate: {
        figmaComponent: figmaTarget,
        status: "PROPOSAL" as const,
        reason: `Matched intent '${comp.intent}' to standard design system component '${figmaTarget}'.`,
      },
    };
  });

  const doc = {
    schemaVersion: SCHEMA_VERSION,
    screenId: blueprint.screenId,
    requiresHumanConfirmation: true as const,
    autoPublish: false as const, // Strictly forbid auto publish
    mappings,
    diagnostics,
  };

  return MappingProposalDocumentSchema.parse(doc);
}

export function validateMappingProposal(
  doc: MappingProposalDocument
): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [...doc.diagnostics];

  if ((doc.autoPublish as boolean) === true) {
    diagnostics.push({
      code: "AUTO_PUBLISH_FORBIDDEN",
      message: "Automatic publishing of component mapping proposals is strictly forbidden.",
      severity: "ERROR",
    });
  }

  const unresolvedCount = doc.mappings.filter((m) => m.candidate.status === "UNRESOLVED").length;
  if (unresolvedCount > 0) {
    diagnostics.push({
      code: "UNRESOLVED_MAPPINGS_PRESENT",
      message: `${unresolvedCount} component(s) remain UNRESOLVED and require human confirmation.`,
      severity: "WARNING",
    });
  }

  return {
    valid: !diagnostics.some((d) => d.severity === "ERROR"),
    diagnostics,
  };
}
