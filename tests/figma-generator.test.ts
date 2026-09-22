/**
 * Test Suite for Phase 4B: Native Figma Generator & Pipeline Guardrails
 *
 * Covers:
 * 1. semanticId duplicate detection
 * 2. Non-existent component -> Draft Component fallback (NOT plain rectangle)
 * 3. Missing Token detection
 * 4. Invalid/Hardcoded Variable detection
 * 5. Idempotent repeat generation (0 duplicate nodes)
 * 6. Manual conflict modification detection
 * 7. Selective update on modified Blueprint
 * 8. Visual prompts schema validation
 * 9. Component mapping proposal & auto-publish guard
 */

import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

import {
  buildTokenRegistry,
  validateVariableBinding,
} from "../tooling/d2c/figma-generator/token-binding.js";
import {
  generateMappingProposal,
  validateMappingProposal,
} from "../tooling/d2c/figma-generator/component-mapper.js";
import { generateFigmaOperationPlan } from "../tooling/d2c/figma-generator/plan-generator.js";
import {
  createSimulatorContext,
  executePlanInSimulator,
} from "../tooling/d2c/figma-generator/simulator.js";
import { generateVisualPrompts } from "../tooling/d2c/figma-generator/image-prompts.js";
import {
  FigmaOperationPlanSchema,
  VisualPromptsDocumentSchema,
  MappingProposalDocumentSchema,
  type ScreenBlueprint,
  type DesignBrief,
} from "../tooling/d2c/blueprint/schema.js";

const tokensPath = resolve(process.cwd(), "tooling/d2c/tokens/canonical-tokens.json");
const canonicalTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));

const catalogPath = resolve(process.cwd(), "tooling/d2c/blueprint/component-intent-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

const mockBlueprint: ScreenBlueprint = {
  schemaVersion: "1.0.0",
  screenId: "users.management",
  route: "/users",
  purpose: "企业用户管理控制台",
  layout: {
    type: "admin-crud",
    breakpoints: ["desktop", "mobile"],
  },
  states: ["ready", "loading", "empty", "error"],
  regions: [
    {
      id: "region-header",
      intent: "page-header",
      layout: { type: "horizontal", spacing: 16, align: "center" },
      components: [
        {
          semanticId: "users.management.page_header",
          intent: "page-header",
          component: "PageHeader",
          variant: "standard",
          importance: "high",
          props: { title: "用户管理" },
          boundStates: ["default"],
        },
      ],
    },
    {
      id: "region-toolbar",
      intent: "filter-search",
      layout: { type: "horizontal", spacing: 12, align: "space-between" },
      components: [
        {
          semanticId: "users.management.search_input",
          intent: "filter-search",
          component: "Input.Search",
          variant: "search",
          importance: "medium",
          props: { placeholder: "搜索..." },
          boundStates: ["default"],
        },
        {
          semanticId: "users.management.create_btn",
          intent: "primary-action",
          component: "Button",
          variant: "primary",
          importance: "high",
          props: { text: "新建用户" },
          boundStates: ["default"],
        },
      ],
    },
  ],
  components: [
    {
      semanticId: "users.management.page_header",
      intent: "page-header",
      component: "PageHeader",
      variant: "standard",
      importance: "high",
      props: { title: "用户管理" },
      boundStates: ["default"],
    },
    {
      semanticId: "users.management.search_input",
      intent: "filter-search",
      component: "Input.Search",
      variant: "search",
      importance: "medium",
      props: { placeholder: "搜索..." },
      boundStates: ["default"],
    },
    {
      semanticId: "users.management.create_btn",
      intent: "primary-action",
      component: "Button",
      variant: "primary",
      importance: "high",
      props: { text: "新建用户" },
      boundStates: ["default"],
    },
  ],
  diagnostics: [],
};

const mockBrief: DesignBrief = {
  schemaVersion: "1.0.0",
  productType: "Enterprise SaaS",
  visualDirections: {
    A: {
      key: "A",
      name: "Enterprise Dense",
      brandTone: "密集",
      layoutStyle: "紧凑网格",
      density: "high",
      typography: { fontFamily: "Inter", baseFontSize: 12, headingScale: "1.2" },
      colorStrategy: { primaryColor: "#1677ff", surfaceStyle: "纯白", contrastRatio: "4.5:1" },
      interactionStyle: "行内",
      referenceProducts: ["AWS"],
      risk: "信息密集",
    },
    B: {
      key: "B",
      name: "Modern SaaS",
      brandTone: "现代",
      layoutStyle: "卡片网格",
      density: "medium",
      typography: { fontFamily: "Inter", baseFontSize: 14, headingScale: "1.25" },
      colorStrategy: { primaryColor: "#1677ff", surfaceStyle: "微投影", contrastRatio: "4.5:1" },
      interactionStyle: "模态弹窗",
      referenceProducts: ["Linear"],
      risk: "单屏行数适中",
    },
    C: {
      key: "C",
      name: "Minimal",
      brandTone: "极简",
      layoutStyle: "单列",
      density: "low",
      typography: { fontFamily: "Inter", baseFontSize: 14, headingScale: "1.33" },
      colorStrategy: { primaryColor: "#000", surfaceStyle: "平铺", contrastRatio: "7:1" },
      interactionStyle: "命令面板",
      referenceProducts: ["Notion"],
      risk: "极简习惯",
    },
  },
  selectedDirection: "B",
  selectionRationale: "Modern SaaS chosen",
  diagnostics: [],
};

// ============================================================================
// 1. Token Binding & Hardcoded Value Guards
// ============================================================================

test("Phase 4B: Token Registry maps canonical tokens and detects missing tokens", () => {
  const registry = buildTokenRegistry(canonicalTokens);
  assert.ok(registry.variables.has("color.primary"), "Must resolve color.primary");
  assert.ok(registry.variables.has("spacing.md"), "Must resolve spacing.md");

  // Valid binding
  const validRes = validateVariableBinding(
    { property: "fills", variableToken: "color.primary", fallbackValue: "#1677ff" },
    registry
  );
  assert.equal(validRes.valid, true);

  // Missing token
  const missingRes = validateVariableBinding(
    { property: "fills", variableToken: "color.ghost.unknown", fallbackValue: "#123456" },
    registry
  );
  assert.equal(missingRes.valid, false);
  assert.equal(missingRes.diagnostic?.code, "MISSING_TOKEN_VARIABLE");
});

test("Phase 4B: Token Binding strictly forbids unmapped hardcoded values", () => {
  const registry = buildTokenRegistry(canonicalTokens);
  const hardcodedRes = validateVariableBinding(
    { property: "fills", variableToken: "HARDCODED", fallbackValue: "#1677ff" },
    registry
  );
  assert.equal(hardcodedRes.valid, false);
  assert.equal(hardcodedRes.diagnostic?.code, "HARDCODED_VALUE_FORBIDDEN");
});

// ============================================================================
// 2. Component Mapping Proposal & Human Gate
// ============================================================================

test("Phase 4B: Component Mapping Proposal defaults to PROPOSAL and forbids autoPublish", () => {
  const proposal = generateMappingProposal(mockBlueprint, catalog);
  assert.equal(proposal.requiresHumanConfirmation, true);
  assert.equal(proposal.autoPublish, false);
  assert.ok(proposal.mappings.every((m) => m.candidate.status === "PROPOSAL"));

  // Check validation rejects autoPublish
  // @ts-ignore
  proposal.autoPublish = true;
  const validation = validateMappingProposal(proposal);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.some((d) => d.code === "AUTO_PUBLISH_FORBIDDEN"));
});

// ============================================================================
// 3. Figma Operation Plan Generation & Schema Validation
// ============================================================================

test("Phase 4B: Figma Operation Plan compiles blueprint deterministically", () => {
  const { plan, diagnostics } = generateFigmaOperationPlan({
    blueprint: mockBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  assert.equal(diagnostics.length, 0);
  assert.ok(plan.blueprintHash.length > 0);
  assert.ok(plan.operations.length >= 4);

  // Verify schema parse
  const parsed = FigmaOperationPlanSchema.parse(plan);
  assert.equal(parsed.screenId, "users.management");
  assert.ok(parsed.operations.some((op) => op.type === "CREATE_FRAME" && op.frameType === "PAGE"));
  assert.ok(parsed.operations.some((op) => op.type === "CREATE_FRAME" && op.frameType === "SECTION"));
  assert.ok(parsed.operations.some((op) => op.type === "CREATE_INSTANCE" || op.type === "CREATE_DRAFT_COMPONENT"));
});

// ============================================================================
// 4. Non-existent Component Fallback: Draft Component (NOT Plain Rectangle)
// ============================================================================

test("Phase 4B: Non-existent component falls back to structured Draft Component", () => {
  const { plan } = generateFigmaOperationPlan({
    blueprint: mockBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  const simContext = createSimulatorContext();
  // Ensure library does NOT have the component
  simContext.libraryComponents.clear();

  const res = executePlanInSimulator(plan, simContext);
  assert.equal(res.success, true);

  const btnNode = simContext.nodesBySemanticId.get("users.management.create_btn");
  assert.ok(btnNode, "Node must be created");
  assert.equal(btnNode.type, "COMPONENT", "Non-existent component must fall back to COMPONENT");
  assert.equal(btnNode.isDraftComponent, true, "Must be tagged as isDraftComponent");
  assert.ok(
    res.diagnostics.some((d) => d.code === "DRAFT_COMPONENT_FALLBACK"),
    "Must report DRAFT_COMPONENT_FALLBACK diagnostic"
  );
});

// ============================================================================
// 5. Idempotent Repeat Generation (0 Duplicate Nodes)
// ============================================================================

test("Phase 4B: Repeat generation is strictly idempotent (0 duplicate nodes)", () => {
  const { plan } = generateFigmaOperationPlan({
    blueprint: mockBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  const simContext = createSimulatorContext();

  // Run 1: Initial creation
  const run1 = executePlanInSimulator(plan, simContext);
  const initialCreated = run1.createdNodes;
  assert.ok(initialCreated > 0, "Initial run must create nodes");
  assert.equal(run1.skippedNodes, 0);

  // Run 2: Exact same plan
  const run2 = executePlanInSimulator(plan, simContext);
  assert.equal(run2.createdNodes, 0, "Second run must NOT create duplicate nodes");
  assert.equal(run2.skippedNodes, initialCreated, "Second run must skip all existing matching nodes");
  assert.equal(run2.conflicts, 0);
});

// ============================================================================
// 6. Conflict Modification Detection (Blocks Overwrite on Manual Edit)
// ============================================================================

test("Phase 4B: Simulator detects manual conflicts and blocks destructive overwrite", () => {
  const { plan } = generateFigmaOperationPlan({
    blueprint: mockBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  const simContext = createSimulatorContext();

  // Run 1: Create
  executePlanInSimulator(plan, simContext);

  // User manually edits a node in Figma
  const editedNode = simContext.nodesBySemanticId.get("users.management.create_btn");
  assert.ok(editedNode);
  editedNode.pluginData.set("manualEdited", "true");

  // Run 2: Re-run plan
  const run2 = executePlanInSimulator(plan, simContext);
  assert.equal(run2.conflicts, 1, "Must detect 1 conflict");
  assert.ok(
    run2.diagnostics.some((d) => d.code === "MANUAL_CONFLICT_DETECTED"),
    "Must report MANUAL_CONFLICT_DETECTED"
  );
});

// ============================================================================
// 7. Selective Update on Blueprint Change
// ============================================================================

test("Phase 4B: Blueprint modifications trigger selective updates without recreating nodes", () => {
  const { plan: plan1 } = generateFigmaOperationPlan({
    blueprint: mockBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  const simContext = createSimulatorContext();
  executePlanInSimulator(plan1, simContext);

  const originalHeaderNode = simContext.nodesBySemanticId.get("users.management.page_header");
  const originalNodeId = originalHeaderNode?.id;

  // Modify blueprint: update spacing
  const modifiedBlueprint: ScreenBlueprint = {
    ...mockBlueprint,
    regions: [
      {
        ...mockBlueprint.regions[0],
        layout: { type: "horizontal", spacing: 32, align: "center" },
      },
      mockBlueprint.regions[1],
    ],
  };

  const { plan: plan2 } = generateFigmaOperationPlan({
    blueprint: modifiedBlueprint,
    brief: mockBrief,
    canonicalTokens,
    catalog,
  });

  const updateRun = executePlanInSimulator(plan2, simContext);
  assert.ok(updateRun.updatedNodes > 0, "Must selectively update nodes");

  const updatedHeaderNode = simContext.nodesBySemanticId.get("users.management.page_header");
  assert.equal(updatedHeaderNode?.id, originalNodeId, "Node identity must be preserved across updates");
});

// ============================================================================
// 8. GPT Image Prompts Schema Validation
// ============================================================================

test("Phase 4B: GPT Image Prompts conform to schema with strict visual-only notice", () => {
  const visualPrompts = generateVisualPrompts(mockBrief, mockBlueprint);
  const parsed = VisualPromptsDocumentSchema.parse(visualPrompts);
  assert.equal(parsed.screenId, "users.management");
  assert.equal(parsed.role, "VISUAL_EXPLORATION_ONLY");
  assert.ok(parsed.prompts.length >= 4);
  assert.ok(parsed.prompts[0].prompt.avoid.includes("glassmorphism"));
  assert.ok(parsed.notice.includes("NEVER used as data source"));
});

// ============================================================================
// 9. Duplicate SemanticId Detection in Operation Plan
// ============================================================================

test("Phase 4B: Operation plan generator detects duplicate semanticId in blueprint", async () => {
  const badBlueprint: ScreenBlueprint = {
    ...mockBlueprint,
    components: [
      ...mockBlueprint.components,
      {
        semanticId: "users.management.create_btn", // DUPLICATE!
        intent: "secondary-action",
        component: "Button",
        variant: "default",
        importance: "medium",
        boundStates: [],
        props: {},
      },
    ],
  };

  // catalog validator must catch duplicate semanticId
  const { validateBlueprintComponents } = await import("../tooling/d2c/blueprint/catalog-validator.js");
  const validation = validateBlueprintComponents(badBlueprint.components);
  assert.equal(validation.valid, false);
  assert.ok(validation.diagnostics.some((d: any) => d.code === "DUPLICATE_SEMANTIC_ID"));
});

// ============================================================================
// 10. Release Package Artifact Integrity
// ============================================================================

test("Phase 4B: Release package manifest exists and contains verified summary", () => {
  const packagePath = resolve(process.cwd(), "examples/output/figma-release-package.json");
  assert.ok(existsSync(packagePath), "figma-release-package.json must exist");
  const pkg = JSON.parse(readFileSync(packagePath, "utf-8"));
  assert.equal(pkg.screenId, "users.management");
  assert.equal(pkg.status, "READY_FOR_FIGMA_IMPORT");
  assert.ok(pkg.summary.totalOperations > 0);
  assert.equal(pkg.summary.idempotencyVerified, true);
  assert.equal(pkg.summary.conflictDetectionVerified, true);
});

