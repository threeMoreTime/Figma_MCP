# 阶段 4B：UI Blueprint → GPT Image 视觉探索 → Native Figma Generator 交付报告 (Phase 4B Report)

**执行日期**：2026-09-22  
**状态**：**PASS (UNIT_VERIFIED & SIMULATED)**  
**阶段边界遵从度**：
- [x] 零 Figma MCP 使用
- [x] 使用官方原生 Figma Plugin API
- [x] 目标业务仓库（`cs_admin-client`）保持绝对只读，零修改
- [x] 零 React 业务代码生成（未进入阶段 5 或代码生成阶段）
- [x] 不覆盖已有 Figma 文件（基于 `semanticId` 与 `blueprintHash` 靶向比对）
- [x] 严禁自动发布 Design Library（组件映射保留 `status: "PROPOSAL"`, `autoPublish: false`）
- [x] 严禁直接执行任意 JavaScript（Blueprint -> Operation Plan -> Schema Validate -> Plugin Execute）

---

## 1. 架构总览与生成管线

阶段 4B 在阶段 4A（UI Blueprint 结构化语义层）基础上，完成了向可编辑原生 Figma 设计的编译与闭环生成：

```
UI Blueprint + Design Brief + Design System
      │
      ├── 1. GPT Image Prompt Generator ──> visual-prompts.json (仅供视觉探索，绝非 Figma 数据源)
      │
      ├── 2. Token Binding Engine ──> 禁止裸硬编码 (#1677ff, 16px)，全面对齐 Figma Variables
      │
      ├── 3. Component Mapping Proposal ──> mapping-proposal.json (PROPOSAL，人工确认门禁)
      │
      ▼
4. Figma Operation Plan Generator ──> figma-operation-plan.json (声明式有序操作，Zod 全量强校验)
      │
      ▼
5. Plugin Execution & Scene Graph Simulator ──> 原生 Frame / Auto Layout / Draft Component 降级 / 幂等防线 / 冲突拦截
```

---

## 2. 核心模块交付详情

### 2.1 Schema 扩展 (`tooling/d2c/blueprint/schema.ts`)
- `LayoutConstraintSchema`：容器宽度（如 1440px）、间距阶梯系统（4/8/16/24/32px）、密度（high/medium/low）、响应式行为。
- `VisualIntentSchema`：色彩策略、排版方向、表面质感风格、交互形式。
- `ComponentCandidateSchema`：`semanticId`, `intent`, `candidate`, `status` (`"PROPOSAL" | "UNRESOLVED" | "CONFIRMED"`), `fallbackDraft`。
- `FigmaOperationPlanSchema`：声明式操作集合（`CREATE_FRAME`, `SET_AUTO_LAYOUT`, `CREATE_INSTANCE`, `CREATE_DRAFT_COMPONENT`, `BIND_VARIABLE`, `UPDATE_NODE`, `ATTACH_METADATA`）。
- `VisualPromptsDocumentSchema`：视觉探索专属 schema。
- `MappingProposalDocumentSchema`：组件映射提案专属 schema。

### 2.2 GPT Image 视觉探索生成器 (`tooling/d2c/figma-generator/image-prompts.ts`)
- 提取 Design Brief 的设计风格与密度，并结合 Blueprint 的四态矩阵（`ready`, `loading`, `empty`, `error`）生成结构化 Prompts。
- 注入严格负向约束（`avoid: ["glassmorphism", "gradient", "neon glows", "3D claymorphism", "hallucinated buttons", "unaligned layouts"]`）。
- **红线约束声明**：文档元数据硬性标记 `role: "VISUAL_EXPLORATION_ONLY"`，附带法律级说明：仅供视觉探索与情绪板参考，绝不作 Figma 结构输入。

### 2.3 Token Variable 绑定引擎 (`tooling/d2c/figma-generator/token-binding.ts`)
- 遍历并解析 `canonical-tokens.json`，自动展开别名引用（`{color.brand.blue.600}` -> `#1677ff`），映射为 Color, Spacing, Radius, Typography 四大集合的 Figma Variables。
- 建立组件语义属性与 Token 变量路径的标准映射（如 `Button.Primary.background` -> `color.primary`）。
- **硬编码零容忍**：提供 `validateVariableBinding` 检查，任何未绑定 Token 变量的裸色值（`#1677ff`）或裸间距（`16px`）直接阻断并报错 `HARDCODED_VALUE_FORBIDDEN`；引用不存在 Token 报错 `MISSING_TOKEN_VARIABLE`。

### 2.4 组件映射提案生成器 (`tooling/d2c/figma-generator/component-mapper.ts`)
- 读取 `component-intent-catalog.json`，将 Blueprint 的每个语义组件映射为 Design System 候选组件（如 `primary-action` -> `DS/Button.Primary`）。
- 状态默认为 `PROPOSAL`，无法识别时标记 `UNRESOLVED`。
- **发布门禁防护**：显式设置 `requiresHumanConfirmation: true`, `autoPublish: false`。若企图将 `autoPublish` 设为 `true`，校验器抛出 `AUTO_PUBLISH_FORBIDDEN` 强制阻断。

### 2.5 Figma 操作规划器 (`tooling/d2c/figma-generator/plan-generator.ts`)
- 组合 Blueprint、Brief、Tokens 与组件映射，生成结构化、有序的 `figma-operation-plan.json`。
- 为 Blueprint 整体计算 SHA256 `blueprintHash`，用于节点版本追踪与幂等比较。
- 输出 Page Root Frame、各 Region Section Frames 以及挂载在各 Region 内的组件实例操作。

### 2.6 Figma 插件与场景图仿真引擎
- **原生插件产物**：[`tooling/d2c/figma-generator/plugin/`](file:///c:/Users/Administrator/Desktop/Antigravity_No_Figma_MCP_Prompts/tooling/d2c/figma-generator/plugin/)
  - `code.ts`：纯官方 Figma Plugin API 交互，包含 Frame 创建、Auto Layout（direction, padding, gap, alignment）、组件实例挂载与文本节点。
  - `manifest.json`：符合 Figma 规范，`networkAccess.allowedDomains: ["none"]`。
  - `ui.html`：安全 DOM 操作面板，支持加载与执行 Plan。
- **自动化仿真器 (`simulator.ts`)**：
  - 在 Node 运行期模拟真实 Figma 场景图树。
  - **幂等防线验证**：初次运行创建 11 个节点；二次运行相同 Plan 时，通过 `semanticId` 与 `blueprintHash` 命中已有节点，创建 0 个节点，跳过 11 个节点，实现绝对幂等。
  - **冲突检测防线**：若检测到节点被人工手动修改（`manualEdited === "true"`），发出 `MANUAL_CONFLICT_DETECTED` 警报并阻止覆盖。
  - **组件降级防线**：未发布或不存在的组件自动降级为带语义外框、内边距和文本标签的 `Draft Component`，严禁使用裸矩形糊弄。

---

## 3. CLI 工具与交付产物

### 3.1 命令行能力
- 执行完整 Phase 4B 管道与自动化防线验证：
  ```bash
  pnpm d2c:blueprint --demo-4b
  ```
- 针对指定 Blueprint 生成 Plan：
  ```bash
  pnpm d2c:blueprint --figma-plan examples/output/ui-blueprint.json
  ```

### 3.2 产物清单 (`examples/output/`)
1. [`visual-prompts.json`](file:///c:/Users/Administrator/Desktop/Antigravity_No_Figma_MCP_Prompts/examples/output/visual-prompts.json)：4 态视觉探索提示词。
2. [`figma-operation-plan.json`](file:///c:/Users/Administrator/Desktop/Antigravity_No_Figma_MCP_Prompts/examples/output/figma-operation-plan.json)：11 项经过 Zod 强类型校验的原生 Figma 操作指令。
3. [`mapping-proposal.json`](file:///c:/Users/Administrator/Desktop/Antigravity_No_Figma_MCP_Prompts/examples/output/mapping-proposal.json)：6 个标准组件候选映射方案。
4. [`figma-release-package.json`](file:///c:/Users/Administrator/Desktop/Antigravity_No_Figma_MCP_Prompts/examples/output/figma-release-package.json)：包含幂等与冲突验证标识的发布包清单。

---

## 4. 验证与回归测试结果

```text
TAP version 13
# Subtest: Phase 4B: Token Registry maps canonical tokens and detects missing tokens (ok)
# Subtest: Phase 4B: Token Binding strictly forbids unmapped hardcoded values (ok)
# Subtest: Phase 4B: Component Mapping Proposal defaults to PROPOSAL and forbids autoPublish (ok)
# Subtest: Phase 4B: Figma Operation Plan compiles blueprint deterministically (ok)
# Subtest: Phase 4B: Non-existent component falls back to structured Draft Component (ok)
# Subtest: Phase 4B: Repeat generation is strictly idempotent (0 duplicate nodes) (ok)
# Subtest: Phase 4B: Simulator detects manual conflicts and blocks destructive overwrite (ok)
# Subtest: Phase 4B: Blueprint modifications trigger selective updates without recreating nodes (ok)
# Subtest: Phase 4B: GPT Image Prompts conform to schema with strict visual-only notice (ok)
# Subtest: Phase 4B: Operation plan generator detects duplicate semanticId in blueprint (ok)
# Subtest: Phase 4B: Release package manifest exists and contains verified summary (ok)

1..83
# tests 83
# suites 0
# pass 83
# fail 0
```

- **测试通过率**：83/83 全部通过（4B 专项用例 11 项全过）。
- **类型检查**：`pnpm run typecheck` (`tsc --noEmit`) 0 错误。
- **业务代码影响**：`..\workspace\cs_admin-client` 0 改动，绝对只读。

---

## 5. 阶段状态看板标志总结

- `BLUEPRINT_TO_FIGMA`: **PASS**
- `GPT_IMAGE_PROMPT`: **PASS**
- `NATIVE_FIGMA_GENERATION`: **PASS**
- `CODE_GENERATION`: **NOT_RUN**

执行已严格停在阶段 4B 结束点。未收到阶段 5（本地桥接或受控回写）明确授权前，不进入下游操作，不生成 React 代码。
