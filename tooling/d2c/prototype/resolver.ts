/**
 * Component Resolution Engine (Phase 5A)
 *
 * Implements: Design Component -> Mapping Proposal -> Code Component
 *
 * Enforces strict anti-hallucination gates:
 * - Emits MISSING_COMPONENT if mapping is missing or unresolved.
 * - Strictly forbids hallucinated components (SmartButton, CustomButton, NewTable, etc.).
 * - Only resolves to verified Ant Design 5.7.3 design system primitives.
 */

import type { MappingProposalDocument } from "../blueprint/schema.js";

export interface ResolvedComponent {
  component: string;
  props: Record<string, any>;
  sourceFigmaComponent: string;
  semanticId: string;
}

export interface ComponentResolutionResult {
  success: boolean;
  resolved?: ResolvedComponent;
  error?: {
    code: "MISSING_COMPONENT" | "FORBIDDEN_HALLUCINATED_COMPONENT" | "UNRESOLVED_MAPPING";
    message: string;
    details?: Record<string, any>;
  };
}

// Canonical design system components allowed in prototype
const CANONICAL_ANTD_COMPONENTS = new Set([
  "Button",
  "Table",
  "Input",
  "Input.Search",
  "Modal",
  "Form",
  "Form.Item",
  "Tag",
  "Badge",
  "Alert",
  "Empty",
  "Card",
  "Space",
  "Typography",
  "Spin",
  "PageHeader",
]);

// Known prohibited hallucinated names
const FORBIDDEN_HALLUCINATED_NAMES = new Set([
  "SmartButton",
  "CustomButton",
  "NewTable",
  "AIButton",
  "FancyTable",
  "SuperModal",
  "MagicForm",
]);

/**
 * Resolves a Figma design component to an executable React code component using the Mapping Proposal.
 */
export function resolveCodeComponent(
  semanticId: string,
  mappingProposal: MappingProposalDocument
): ComponentResolutionResult {
  const mapping = mappingProposal.mappings.find((m) => m.semanticId === semanticId);

  if (!mapping) {
    return {
      success: false,
      error: {
        code: "MISSING_COMPONENT",
        message: `No component mapping proposal found for semanticId '${semanticId}'.`,
        details: { semanticId },
      },
    };
  }

  const figmaComp = mapping.candidate.figmaComponent;

  // Check unresolved
  if (mapping.candidate.status === "UNRESOLVED" || figmaComp === "UNRESOLVED") {
    return {
      success: false,
      error: {
        code: "UNRESOLVED_MAPPING",
        message: `Component '${semanticId}' is marked as UNRESOLVED in mapping proposal. Cannot proceed without human confirmation.`,
        details: { semanticId, figmaComp },
      },
    };
  }

  // Check anti-hallucination forbidden names
  for (const forbidden of FORBIDDEN_HALLUCINATED_NAMES) {
    if (figmaComp.includes(forbidden)) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN_HALLUCINATED_COMPONENT",
          message: `Prohibited hallucinated component name detected: '${figmaComp}'. Automatic creation of '${forbidden}' is strictly forbidden.`,
          details: { semanticId, figmaComp, forbidden },
        },
      };
    }
  }

  // Map to canonical code component & props
  let codeComponent = "";
  let codeProps: Record<string, any> = {};

  if (figmaComp === "DS/Button.Primary" || mapping.intent === "primary-action") {
    codeComponent = "Button";
    codeProps = { type: "primary" };
  } else if (figmaComp === "DS/Button.Default" || mapping.intent === "secondary-action") {
    codeComponent = "Button";
    codeProps = { type: "default" };
  } else if (figmaComp === "DS/Button.Danger" || mapping.intent === "destructive-action") {
    codeComponent = "Button";
    codeProps = { danger: true };
  } else if (figmaComp === "DS/Table.DataTable" || mapping.intent === "data-table") {
    codeComponent = "Table";
    codeProps = { rowKey: "id", size: "middle", pagination: { pageSize: 10 } };
  } else if (figmaComp === "DS/Input.Search" || mapping.intent === "filter-search") {
    codeComponent = "Input.Search";
    codeProps = { allowClear: true };
  } else if (figmaComp === "DS/Modal.Standard" || mapping.intent === "modal-dialog") {
    codeComponent = "Modal";
    codeProps = { destroyOnClose: true };
  } else if (figmaComp === "DS/Form.VerticalContainer" || mapping.intent === "form-container") {
    codeComponent = "Form";
    codeProps = { layout: "vertical" };
  } else if (figmaComp === "DS/Header.PageHeader" || mapping.intent === "page-header") {
    codeComponent = "PageHeader";
    codeProps = {};
  } else {
    // Attempt fallback from DS/...
    const stripped = figmaComp.replace(/^DS\//, "").split(".")[0];
    if (CANONICAL_ANTD_COMPONENTS.has(stripped)) {
      codeComponent = stripped;
    } else {
      return {
        success: false,
        error: {
          code: "MISSING_COMPONENT",
          message: `Target component '${figmaComp}' does not map to any canonical design system primitive.`,
          details: { semanticId, figmaComp },
        },
      };
    }
  }

  return {
    success: true,
    resolved: {
      component: codeComponent,
      props: codeProps,
      sourceFigmaComponent: figmaComp,
      semanticId,
    },
  };
}
