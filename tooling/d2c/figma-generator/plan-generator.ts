/**
 * Figma Operation Plan Generator
 *
 * Compiles ScreenBlueprint + DesignBrief + CanonicalTokens + ComponentCatalog
 * into a strictly validated, deterministic FigmaOperationPlan.
 *
 * Directly executing arbitrary JavaScript is forbidden.
 * Pipeline: Blueprint -> Operation Plan -> Schema Validate -> Plugin Execute
 */

import { createHash } from "node:crypto";
import { SCHEMA_VERSION, type Diagnostic } from "../contracts/schema.js";
import {
  FigmaOperationPlanSchema,
  type FigmaOperationPlan,
  type FigmaOperation,
  type ScreenBlueprint,
  type DesignBrief,
  type ComponentIntentCatalog,
  type MappingProposalDocument,
} from "../blueprint/schema.js";
import { buildTokenRegistry, validateVariableBinding } from "./token-binding.js";

export interface GeneratePlanOptions {
  blueprint: ScreenBlueprint;
  brief: DesignBrief;
  canonicalTokens: any;
  catalog: ComponentIntentCatalog;
  mappingProposal?: MappingProposalDocument;
}

export function generateFigmaOperationPlan(options: GeneratePlanOptions): {
  plan: FigmaOperationPlan;
  diagnostics: Diagnostic[];
} {
  const { blueprint, canonicalTokens, mappingProposal } = options;
  const diagnostics: Diagnostic[] = [];

  const tokenRegistry = buildTokenRegistry(canonicalTokens);

  // Compute blueprint content hash for idempotency and conflict tracking
  const blueprintHash = createHash("sha256")
    .update(
      JSON.stringify({
        screenId: blueprint.screenId,
        regions: blueprint.regions,
        components: blueprint.components,
      })
    )
    .digest("hex");

  const operations: FigmaOperation[] = [];

  const rootSemanticId = `${blueprint.screenId}.page`;

  // 1. Root Page Frame
  const rootPageOp: FigmaOperation = {
    id: "op-root-page",
    type: "CREATE_FRAME",
    semanticId: rootSemanticId,
    name: `${blueprint.screenId} [Page]`,
    frameType: "PAGE",
    layout: {
      layoutMode: "VERTICAL",
      padding: { top: 24, right: 24, bottom: 24, left: 24 },
      itemSpacing: 24,
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
    },
    variableBinding: {
      property: "fills",
      variableToken: "color.bg.layout",
      fallbackValue: "#f5f5f5",
    },
    metadata: {
      semanticId: rootSemanticId,
      blueprintHash,
      nodeType: "PAGE_ROOT",
    },
  };

  const rootBindingCheck = validateVariableBinding(rootPageOp.variableBinding!, tokenRegistry);
  if (!rootBindingCheck.valid && rootBindingCheck.diagnostic) {
    diagnostics.push(rootBindingCheck.diagnostic);
  }

  operations.push(rootPageOp);

  let opIndex = 1;

  // 2. Regions & Components
  for (const region of blueprint.regions) {
    const regionSemanticId = `${blueprint.screenId}.${region.id}`;
    const isHorizontal = region.layout.type === "horizontal";

    const regionOp: FigmaOperation = {
      id: `op-${String(opIndex++).padStart(2, "0")}-region-${region.id}`,
      type: "CREATE_FRAME",
      semanticId: regionSemanticId,
      parentSemanticId: rootSemanticId,
      name: `${region.intent} [${region.id}]`,
      frameType: "SECTION",
      layout: {
        layoutMode: isHorizontal ? "HORIZONTAL" : "VERTICAL",
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        itemSpacing: region.layout.spacing ?? 16,
        primaryAxisAlignItems: region.layout.align === "space-between" ? "SPACE_BETWEEN" : "MIN",
        counterAxisAlignItems: "CENTER",
      },
      variableBinding: {
        property: "fills",
        variableToken: "color.bg.container",
        fallbackValue: "#ffffff",
      },
      metadata: {
        semanticId: regionSemanticId,
        blueprintHash,
        regionId: region.id,
      },
    };

    const regionBindingCheck = validateVariableBinding(regionOp.variableBinding!, tokenRegistry);
    if (!regionBindingCheck.valid && regionBindingCheck.diagnostic) {
      diagnostics.push(regionBindingCheck.diagnostic);
    }

    operations.push(regionOp);

    // 3. Components within Region
    for (const comp of region.components) {
      const mapping = mappingProposal?.mappings.find((m) => m.semanticId === comp.semanticId);
      const targetComponent = mapping?.candidate.figmaComponent || `DS/${comp.component}`;
      const isUnresolved = mapping?.candidate.status === "UNRESOLVED";

      let compBindingToken = "color.primary";
      let compProperty: "fills" | "strokes" = "fills";

      if (comp.intent === "data-table" || comp.intent === "filter-search") {
        compBindingToken = "color.border";
        compProperty = "strokes";
      } else if (comp.intent === "page-header") {
        compBindingToken = "color.bg.container";
        compProperty = "fills";
      }

      const compOp: FigmaOperation = {
        id: `op-${String(opIndex++).padStart(2, "0")}-comp-${comp.semanticId.replace(/\./g, "_")}`,
        type: isUnresolved ? "CREATE_DRAFT_COMPONENT" : "CREATE_INSTANCE",
        semanticId: comp.semanticId,
        parentSemanticId: regionSemanticId,
        name: `${comp.intent}: ${comp.semanticId}`,
        component: targetComponent,
        fallbackDraft: isUnresolved || true,
        variableBinding: {
          property: compProperty,
          variableToken: compBindingToken,
          fallbackValue: compProperty === "fills" ? "#1677ff" : "#d9d9d9",
        },
        properties: {
          variant: comp.variant,
          importance: comp.importance,
          label: comp.label,
          boundStates: comp.boundStates,
        },
        metadata: {
          semanticId: comp.semanticId,
          intent: comp.intent,
          blueprintHash,
        },
      };

      const compBindingCheck = validateVariableBinding(compOp.variableBinding!, tokenRegistry);
      if (!compBindingCheck.valid && compBindingCheck.diagnostic) {
        diagnostics.push(compBindingCheck.diagnostic);
      }

      operations.push(compOp);
    }
  }

  const rawPlan = {
    schemaVersion: SCHEMA_VERSION,
    screenId: blueprint.screenId,
    blueprintHash,
    operations,
    diagnostics,
  };

  const parsedPlan = FigmaOperationPlanSchema.parse(rawPlan);

  return { plan: parsedPlan, diagnostics };
}
