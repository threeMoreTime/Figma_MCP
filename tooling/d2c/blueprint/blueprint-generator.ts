/**
 * UI Blueprint Generator
 *
 * Synthesizes validated ScreenBlueprints from requirement analysis and selected visual direction.
 * Guarantees zero hallucinated components by validating against the component intent catalog.
 */

import { SCHEMA_VERSION, type Diagnostic } from "../contracts/schema.js";
import {
  ScreenBlueprintSchema,
  type ScreenBlueprint,
  type RequirementAnalysis,
  type ComponentIntent,
  type RegionBlueprint,
} from "./schema.js";
import { validateBlueprintComponents } from "./catalog-validator.js";

export interface GenerateUIBlueprintOptions {
  analysis: RequirementAnalysis;
  selectedDirection?: "A" | "B" | "C";
  screenId?: string;
}

export interface GenerateUIBlueprintResult {
  success: boolean;
  blueprint?: ScreenBlueprint;
  diagnostics: Diagnostic[];
}

export function generateUIBlueprint(
  options: GenerateUIBlueprintOptions
): GenerateUIBlueprintResult {
  const { analysis, selectedDirection = "B", screenId: requestedScreenId } = options;

  const targetScreen =
    (requestedScreenId && analysis.screenMap.find((s) => s.screenId === requestedScreenId)) ||
    analysis.screenMap[0] || {
      screenId: "users.management",
      route: "/users",
      purpose: "企业用户管理控制台",
      layout: "admin-crud",
    };

  const screenId = targetScreen.screenId;
  const screenStates =
    analysis.stateMatrix[screenId]?.map((s) => s.state) || [
      "ready",
      "loading",
      "empty",
      "error",
    ];

  // 1. Header Region
  const headerComponent: ComponentIntent = {
    semanticId: `${screenId}.page_header`,
    intent: "page-header",
    component: "PageHeader",
    variant: selectedDirection === "A" ? "compact" : "standard",
    importance: "high",
    regionId: "region-header",
    label: targetScreen.purpose || analysis.productName,
    boundStates: ["default"],
    props: {
      title: targetScreen.purpose || analysis.productName,
      subtitle: analysis.confirmedFacts[0] || "",
    },
  };

  const headerRegion: RegionBlueprint = {
    id: "region-header",
    intent: "page-header",
    layout: {
      type: "horizontal",
      spacing: selectedDirection === "A" ? 8 : 16,
      align: "center",
    },
    components: [headerComponent],
  };

  // 2. Toolbar Region
  const searchComponent: ComponentIntent = {
    semanticId: `${screenId}.search_input`,
    intent: "filter-search",
    component: "Input.Search",
    variant: "search",
    importance: "medium",
    regionId: "region-toolbar",
    boundStates: ["default", "focused", "disabled"],
    props: {
      placeholder: "按姓名或角色搜索...",
      allowClear: true,
    },
  };

  const createBtnComponent: ComponentIntent = {
    semanticId: `${screenId}.create_btn`,
    intent: "primary-action",
    component: "Button",
    variant: "primary",
    importance: "high",
    regionId: "region-toolbar",
    label: "新建用户",
    boundStates: ["default", "loading", "disabled"],
    props: {
      type: "primary",
      text: "新建用户",
    },
  };

  const toolbarRegion: RegionBlueprint = {
    id: "region-toolbar",
    intent: "filter-search",
    layout: {
      type: "horizontal",
      spacing: selectedDirection === "A" ? 8 : 12,
      align: "space-between",
    },
    components: [searchComponent, createBtnComponent],
  };

  // 3. Content Region
  const tableComponent: ComponentIntent = {
    semanticId: `${screenId}.table`,
    intent: "data-table",
    component: "Table",
    variant: selectedDirection === "A" ? "striped" : "default",
    importance: "high",
    regionId: "region-content",
    boundStates: screenStates,
    props: {
      rowKey: "id",
      size: selectedDirection === "A" ? "small" : "middle",
      pagination: { pageSize: 10, showSizeChanger: true },
    },
  };

  const contentRegion: RegionBlueprint = {
    id: "region-content",
    intent: "data-table",
    layout: {
      type: "vertical",
      spacing: selectedDirection === "A" ? 8 : 16,
    },
    components: [tableComponent],
  };

  // 4. Modal Container Region
  const modalComponent: ComponentIntent = {
    semanticId: `${screenId}.create_modal`,
    intent: "modal-dialog",
    component: "Modal",
    variant: "default",
    importance: "medium",
    regionId: "region-modal",
    boundStates: ["closed", "open", "submitting"],
    props: {
      title: "新建用户",
      destroyOnClose: true,
    },
  };

  const formComponent: ComponentIntent = {
    semanticId: `${screenId}.create_form`,
    intent: "form-container",
    component: "Form",
    variant: "vertical",
    importance: "medium",
    regionId: "region-modal",
    boundStates: ["default", "validating", "submitting"],
    props: {
      layout: "vertical",
    },
  };

  const modalRegion: RegionBlueprint = {
    id: "region-modal",
    intent: "modal-dialog",
    layout: {
      type: "vertical",
      spacing: 12,
    },
    components: [modalComponent, formComponent],
  };

  const allComponents = [
    headerComponent,
    searchComponent,
    createBtnComponent,
    tableComponent,
    modalComponent,
    formComponent,
  ];

  const regions: RegionBlueprint[] = [
    headerRegion,
    toolbarRegion,
    contentRegion,
    modalRegion,
  ];

  // Validate all components against catalog and uniqueness
  const validation = validateBlueprintComponents(allComponents);
  if (!validation.valid) {
    return {
      success: false,
      diagnostics: validation.diagnostics,
    };
  }

  const layoutConstraint = {
    containerWidth: 1440,
    spacingSystem: {
      baseUnit: 8,
      steps: [4, 8, 16, 24, 32],
    },
    density: selectedDirection === "A" ? ("high" as const) : selectedDirection === "C" ? ("low" as const) : ("medium" as const),
    responsiveBehavior: "fluid" as const,
  };

  const visualIntent = {
    colorStrategy:
      selectedDirection === "C"
        ? "Monochrome Minimalist High Contrast"
        : "AntD 5.7.3 Brand Blue (#1677ff) with Neutral Grayscale",
    typographyDirection:
      selectedDirection === "A"
        ? "Compact Data Typography (12px base, 1.2 heading scale)"
        : "Clean SaaS Typography (14px base, 1.25 heading scale)",
    surfaceStyle:
      selectedDirection === "A"
        ? "Bordered High Contrast pure white container"
        : selectedDirection === "C"
        ? "Borderless Plain minimalist surface"
        : "Card surface with subtle elevation (#f5f7fa background)",
    interactionStyle:
      selectedDirection === "A"
        ? "Inline quick action, keyboard priority"
        : selectedDirection === "C"
        ? "Command palette driven, zero friction"
        : "Modal dialog and drawer flow with status transitions",
  };

  const candidates = allComponents.map((c) => {
    let candidateName = "UNRESOLVED";
    if (c.intent === "primary-action") candidateName = "DS/Button.Primary";
    else if (c.intent === "page-header") candidateName = "DS/PageHeader.Standard";
    else if (c.intent === "filter-search") candidateName = "DS/Input.Search";
    else if (c.intent === "data-table") candidateName = "DS/Table.DataTable";
    else if (c.intent === "modal-dialog") candidateName = "DS/Modal.Standard";
    else if (c.intent === "form-container") candidateName = "DS/Form.VerticalContainer";
    else candidateName = `DS/${c.component}`;

    return {
      semanticId: c.semanticId,
      intent: c.intent,
      candidate: candidateName,
      status: "PROPOSAL" as const,
      fallbackDraft: true,
    };
  });

  const rawBlueprint = {
    schemaVersion: SCHEMA_VERSION,
    screenId,
    route: targetScreen.route,
    purpose: targetScreen.purpose,
    layout: {
      type: targetScreen.layout || "admin-crud",
      breakpoints: ["desktop", "mobile"],
    },
    states: screenStates,
    regions,
    components: allComponents,
    selectedDirection,
    layoutConstraint,
    visualIntent,
    candidates,
    diagnostics: [],
  };

  const parsedBlueprint = ScreenBlueprintSchema.parse(rawBlueprint);

  return {
    success: true,
    blueprint: parsedBlueprint,
    diagnostics: [],
  };
}
