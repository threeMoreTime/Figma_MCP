/**
 * Test Suite for Phase 4A: PRD → UI Blueprint Engine
 */

import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";

// Schemas & Validators
import {
  validateComponentIntent,
  validateBlueprintComponents,
} from "../tooling/d2c/blueprint/catalog-validator.js";
import type { ComponentIntent } from "../tooling/d2c/blueprint/schema.js";

// ============================================================================
// 1. Component Intent Catalog & Anti-Hallucination Guards
// ============================================================================

test("Phase 4A: Catalog validator approves standard design system component intents", () => {
  const validButton: ComponentIntent = {
    semanticId: "users.create",
    intent: "primary-action",
    component: "Button",
    variant: "primary",
    importance: "high",
    boundStates: ["default", "loading", "disabled"],
    props: {},
  };

  const diags = validateComponentIntent(validButton);
  assert.equal(diags.length, 0, "Standard primary-action Button must produce 0 diagnostics");
});

test("Phase 4A: Catalog validator rejects hallucinated component names (SmartButton, AIButton, FancyTable)", () => {
  const badButton1: ComponentIntent = {
    semanticId: "users.smart_create",
    intent: "primary-action",
    component: "SmartButton", // HALLUCINATED!
    variant: "primary",
    importance: "high",
    boundStates: [],
    props: {},
  };

  const diags1 = validateComponentIntent(badButton1);
  assert.ok(diags1.length > 0, "Must emit diagnostic for SmartButton");
  assert.equal(diags1[0].code, "DISALLOWED_COMPONENT_FOR_INTENT");

  const badTable: ComponentIntent = {
    semanticId: "users.fancy_list",
    intent: "data-table",
    component: "FancyTable", // HALLUCINATED!
    variant: "default",
    importance: "high",
    boundStates: [],
    props: {},
  };

  const diags2 = validateComponentIntent(badTable);
  assert.ok(diags2.length > 0, "Must emit diagnostic for FancyTable");
  assert.equal(diags2[0].code, "DISALLOWED_COMPONENT_FOR_INTENT");
});

test("Phase 4A: Catalog validator rejects unknown/invented intent names", () => {
  const unknownIntent: ComponentIntent = {
    semanticId: "users.magic_action",
    intent: "magic-ai-action", // UNKNOWN INTENT!
    component: "Button",
    variant: "default",
    importance: "medium",
    boundStates: [],
    props: {},
  };

  const diags = validateComponentIntent(unknownIntent);
  assert.ok(diags.length > 0, "Must emit diagnostic for unknown intent");
  assert.equal(diags[0].code, "UNKNOWN_COMPONENT_INTENT");
});

test("Phase 4A: Duplicate semanticId within blueprint is strictly rejected", () => {
  const components: ComponentIntent[] = [
    {
      semanticId: "users.create_btn",
      intent: "primary-action",
      component: "Button",
      variant: "primary",
      importance: "high",
      boundStates: [],
      props: {},
    },
    {
      semanticId: "users.create_btn", // DUPLICATE!
      intent: "secondary-action",
      component: "Button",
      variant: "default",
      importance: "medium",
      boundStates: [],
      props: {},
    },
  ];

  const res = validateBlueprintComponents(components);
  assert.equal(res.valid, false, "Blueprint with duplicate semanticId must fail validation");
  assert.ok(
    res.diagnostics.some((d) => d.code === "DUPLICATE_SEMANTIC_ID"),
    "Must emit DUPLICATE_SEMANTIC_ID error"
  );
});

// ============================================================================
// 2. Requirement Analyzer: Input Diagnostics & Fact Partitioning
// ============================================================================

test("Phase 4A: Requirement Analyzer detects missing user goals in flawed PRD", async () => {
  // @ts-ignore
  const { analyzeRequirement } = await import("../tooling/d2c/blueprint/analyzer.js");

  const incompletePrd = `
# 用户管理需求
## 页面描述
需要一个管理用户的后台页面。
## 状态
- loading: 加载中
- ready: 正常显示
- empty: 空列表
- error: 加载失败
  `;

  const result = analyzeRequirement(incompletePrd);
  assert.ok(result.diagnostics.length > 0, "Incomplete PRD without user roles/goals must yield diagnostics");
  assert.ok(
    result.diagnostics.some((d) => d.code === "MISSING_USER_GOALS"),
    "Must report MISSING_USER_GOALS diagnostic"
  );
});

test("Phase 4A: Requirement Analyzer detects missing screen goals and missing states", async () => {
  // @ts-ignore
  const { analyzeRequirement } = await import("../tooling/d2c/blueprint/analyzer.js");

  const incompletePrd = `
# 用户管理需求
## 用户角色
- 运营管理员：需要查看用户并导出数据
## 核心任务
- 查看用户列表
  `;

  const result = analyzeRequirement(incompletePrd);
  assert.ok(
    result.diagnostics.some((d) => d.code === "MISSING_SCREEN_GOALS"),
    "Must report MISSING_SCREEN_GOALS when no screen goals are specified"
  );
  assert.ok(
    result.diagnostics.some((d) => d.code === "MISSING_ESSENTIAL_STATES"),
    "Must report MISSING_ESSENTIAL_STATES when core states (ready, loading, empty, error) are absent"
  );
});

test("Phase 4A: Requirement Analyzer accurately partitions confirmed facts, assumptions, decisions, and state matrix", async () => {
  // @ts-ignore
  const { analyzeRequirement } = await import("../tooling/d2c/blueprint/analyzer.js");

  const canonicalPrd = `
# 企业用户权限管理系统 (PRD)

## 产品目标
为运营团队和安全审计人员提供高可靠的企业用户账户管理与审计后台。

## 用户角色
- 超级管理员 (Admin)：拥有全量用户启停与新建权限。
- 审计人员 (Auditor)：只读查看用户列表与安全日志。

## 用户任务 (Jobs)
- JOB-01: 超级管理员新建企业用户并指派角色。
- JOB-02: 审计人员按姓名或角色搜索过滤用户。

## 页面列表
- 页面ID: users.management, 路由: /users, 目标: 展示企业全量用户列表并提供新建与查询操作, 布局: admin-crud

## 状态矩阵 (State Matrix)
- loading: 正在从后端拉取用户分页列表
- ready: 成功加载用户数据，表格呈现数据
- empty: 暂无符合筛选条件的用户
- error: 后端接口响应超时或无访问权限

## 业务约束与决策
- 必须支持至少 10000+ 用户分页查询（单页 10-50 条）。
- [DECISION_REQUIRED] 密码分发方式是短信下发还是邮件邀请？
- [ASSUMPTION] 列表默认每页展示 10 条数据。
  `;

  const result = analyzeRequirement(canonicalPrd);
  assert.equal(result.diagnostics.filter((d: any) => d.severity === "ERROR").length, 0, "Valid PRD must have zero error diagnostics");
  assert.ok(result.confirmedFacts.length >= 2, "Must extract confirmed facts");
  assert.ok(result.assumptions.length >= 1, "Must extract assumptions");
  assert.ok(result.decisionsRequired.length >= 1, "Must extract decisions requiring review");
  assert.equal(result.userJobs.length, 2, "Must extract 2 user jobs");
  assert.ok(result.screenMap.some((s: any) => s.screenId === "users.management"));
  assert.ok(result.stateMatrix["users.management"]);
  assert.equal(result.stateMatrix["users.management"].length, 4, "Must contain all 4 states");
});

// ============================================================================
// 3. Design Brief Generator: 3 Directions & No Auto-Selection
// ============================================================================

test("Phase 4A: Design Brief Generator produces 3 distinct visual directions and halts without auto-selection", async () => {
  // @ts-ignore
  const { generateDesignBrief } = await import("../tooling/d2c/blueprint/design-brief.js");

  const mockAnalysis: any = {
    productName: "企业用户管理系统",
    confirmedFacts: ["企业后台", "支持审计"],
    assumptions: [],
    decisionsRequired: [],
    userJobs: [],
    screenMap: [{ screenId: "users.management", route: "/users", purpose: "用户管理", layout: "admin-crud" }],
    stateMatrix: {},
    diagnostics: [],
  };

  const brief = generateDesignBrief(mockAnalysis);

  assert.equal(brief.productType, "Enterprise SaaS");
  assert.ok(brief.visualDirections.A, "Must output Direction A: Enterprise Dense");
  assert.ok(brief.visualDirections.B, "Must output Direction B: Modern SaaS");
  assert.ok(brief.visualDirections.C, "Must output Direction C: Minimal Productivity");

  assert.equal(brief.visualDirections.A.name, "Enterprise Dense");
  assert.equal(brief.visualDirections.B.name, "Modern SaaS");
  assert.equal(brief.visualDirections.C.name, "Minimal Productivity");

  // Verify mandatory fields per direction
  for (const dir of [brief.visualDirections.A, brief.visualDirections.B, brief.visualDirections.C]) {
    assert.ok(dir.brandTone.length > 0);
    assert.ok(dir.layoutStyle.length > 0);
    assert.ok(dir.density);
    assert.ok(dir.typography.fontFamily);
    assert.ok(dir.colorStrategy.primaryColor);
    assert.ok(dir.interactionStyle.length > 0);
    assert.ok(dir.referenceProducts.length > 0);
    assert.ok(dir.risk.length > 0);
  }

  // Strictly assert NO auto-selection
  assert.equal(brief.selectedDirection, null, "Must halt after brief generation without auto-selecting direction");
  assert.equal(brief.selectionRationale, null);
});

// ============================================================================
// 4. UI Blueprint Generator
// ============================================================================

test("Phase 4A: UI Blueprint Generator generates validated ScreenBlueprint using chosen direction", async () => {
  // @ts-ignore
  const { generateUIBlueprint } = await import("../tooling/d2c/blueprint/blueprint-generator.js");

  const mockAnalysis: any = {
    productName: "企业用户管理系统",
    confirmedFacts: ["用户增查"],
    assumptions: [],
    decisionsRequired: [],
    userJobs: [{ id: "J1", role: "Admin", job: "新建用户", expectedOutcome: "新用户添加" }],
    screenMap: [{ screenId: "users.management", route: "/users", purpose: "用户管理", layout: "admin-crud" }],
    stateMatrix: {
      "users.management": [
        { state: "ready", description: "正常就绪" },
        { state: "loading", description: "加载中" },
        { state: "empty", description: "空数据" },
        { state: "error", description: "错误状态" },
      ],
    },
    diagnostics: [],
  };

  const blueprintResult = generateUIBlueprint({
    analysis: mockAnalysis,
    selectedDirection: "B",
  });

  assert.equal(blueprintResult.success, true, "Blueprint generation must succeed");
  assert.ok(blueprintResult.blueprint, "Must produce blueprint");

  const bp = blueprintResult.blueprint;
  assert.equal(bp.screenId, "users.management");
  assert.equal(bp.selectedDirection, "B");
  assert.ok(bp.regions.length >= 3, "Must have header, toolbar, content regions");

  // Assert components are catalog-compliant
  assert.ok(bp.components.some((c: any) => c.intent === "primary-action" && c.component === "Button"));
  assert.ok(bp.components.some((c: any) => c.intent === "data-table" && c.component === "Table"));
  assert.ok(bp.components.some((c: any) => c.intent === "filter-search" && (c.component === "Input.Search" || c.component === "Input")));

  // Assert no duplicate semanticId
  const ids = bp.components.map((c: any) => c.semanticId);
  const uniqueIds = new Set(ids);
  assert.equal(uniqueIds.size, ids.length, "All semanticIds in blueprint must be unique");
});

// ============================================================================
// 5. Interaction Contract Generator
// ============================================================================

test("Phase 4A: Interaction Contract Generator covers click, submit, validation, success, error", async () => {
  // @ts-ignore
  const { generateInteractionContract } = await import("../tooling/d2c/blueprint/interaction-contract.js");

  const mockBlueprint: any = {
    screenId: "users.management",
    components: [
      { semanticId: "users.create_btn", intent: "primary-action", component: "Button" },
      { semanticId: "users.create_modal", intent: "modal-dialog", component: "Modal" },
      { semanticId: "users.create_form", intent: "form-container", component: "Form" },
      { semanticId: "users.table", intent: "data-table", component: "Table" },
    ],
  };

  const contract = generateInteractionContract(mockBlueprint);

  assert.equal(contract.screenId, "users.management");
  assert.ok(contract.interactions.length >= 4, "Must cover click, submit, success, error");

  // Check event types
  const events = contract.interactions.map((i: any) => i.event);
  assert.ok(events.some((e: string) => e.startsWith("click:")));
  assert.ok(events.some((e: string) => e.startsWith("submit:")));
  assert.ok(events.some((e: string) => e.startsWith("validation:")));
  assert.ok(events.some((e: string) => e.startsWith("success:")));
  assert.ok(events.some((e: string) => e.startsWith("error:")));

  // All sources must exist in blueprint
  const compIdSet = new Set(mockBlueprint.components.map((c: any) => c.semanticId));
  for (const item of contract.interactions) {
    assert.ok(
      compIdSet.has(item.source),
      `Interaction source '${item.source}' must exist in blueprint components`
    );
  }
});

test("Phase 4A: Interaction Contract Generator catches dangling/invalid targets", async () => {
  // @ts-ignore
  const { validateInteractionContract } = await import("../tooling/d2c/blueprint/interaction-contract.js");

  const mockBlueprint: any = {
    screenId: "users.management",
    components: [
      { semanticId: "users.create_btn", intent: "primary-action", component: "Button" },
    ],
  };

  const badContract: any = {
    screenId: "users.management",
    interactions: [
      {
        id: "int_bad",
        event: "click:users.create_btn",
        source: "users.create_btn",
        action: "open-modal",
        target: "ghost_modal_that_does_not_exist", // DANGLING TARGET!
      },
    ],
  };

  const res = validateInteractionContract(badContract, mockBlueprint);
  assert.equal(res.valid, false, "Contract with dangling target must fail validation");
  assert.ok(res.diagnostics.some((d: any) => d.code === "INVALID_INTERACTION_TARGET"));
});

// ============================================================================
// 6. Schema Validation of Demo Output Artifacts
// ============================================================================

test("Phase 4A: All demo output artifacts strictly validate against canonical Zod schemas", async () => {
  const {
    RequirementAnalysisSchema,
    DesignBriefSchema,
    ScreenBlueprintSchema,
    InteractionContractSchema,
  } = await import("../tooling/d2c/blueprint/schema.js");

  const outputDir = resolve(process.cwd(), "examples/output");

  // 1. users-analysis.json
  const analysisPath = resolve(outputDir, "users-analysis.json");
  assert.ok(existsSync(analysisPath), "users-analysis.json must exist");
  const analysisData = JSON.parse(readFileSync(analysisPath, "utf-8"));
  const parsedAnalysis = RequirementAnalysisSchema.parse(analysisData);
  assert.equal(parsedAnalysis.productName, "企业用户权限管理系统");
  assert.equal(parsedAnalysis.diagnostics.length, 0);

  // 2. design-brief.json
  const briefPath = resolve(outputDir, "design-brief.json");
  assert.ok(existsSync(briefPath), "design-brief.json must exist");
  const briefData = JSON.parse(readFileSync(briefPath, "utf-8"));
  const parsedBrief = DesignBriefSchema.parse(briefData);
  assert.equal(parsedBrief.productType, "Enterprise SaaS");
  assert.ok(parsedBrief.visualDirections.A);
  assert.ok(parsedBrief.visualDirections.B);
  assert.ok(parsedBrief.visualDirections.C);

  // 3. ui-blueprint.json
  const blueprintPath = resolve(outputDir, "ui-blueprint.json");
  assert.ok(existsSync(blueprintPath), "ui-blueprint.json must exist");
  const blueprintData = JSON.parse(readFileSync(blueprintPath, "utf-8"));
  const parsedBlueprint = ScreenBlueprintSchema.parse(blueprintData);
  assert.equal(parsedBlueprint.screenId, "users.management");
  assert.equal(parsedBlueprint.selectedDirection, "B");
  assert.ok(parsedBlueprint.components.length >= 4);

  // 4. interaction-contract.json
  const contractPath = resolve(outputDir, "interaction-contract.json");
  assert.ok(existsSync(contractPath), "interaction-contract.json must exist");
  const contractData = JSON.parse(readFileSync(contractPath, "utf-8"));
  const parsedContract = InteractionContractSchema.parse(contractData);
  assert.equal(parsedContract.screenId, "users.management");
  assert.ok(parsedContract.interactions.length >= 4);
});

