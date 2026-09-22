# D2C 集成推进状态跟踪 (D2C Status Tracking)

最后更新：2026-09-22 15:45:00  
当前执行阶段：**阶段 5B-2：HTML Prototype → New React Application — 全部完成**

---

## 1. 总体进度仪表盘

| 阶段 | 阶段名称 | 状态 | 关键验证标准 | 产物与报告 |
| :--- | :--- | :--- | :--- | :--- |
| **阶段 1** | 八仓库源码审查与最小复用决策 | **PASS** | 全部八个仓库完成本地审查、固定 SHA 与许可证分析，修正复用分类与测试状态 | `docs/d2c/` 审计报告集 & `upstreams.lock.json` |
| **阶段 2** | 统一契约、Token 构建与真实组件注册表 | **PASS** (UNIT_VERIFIED) | 契约 Schema 100% 校验通过，Style Dictionary 构建 AntD 5 主题，只读扫描生成注册表，12 项异常防御全测通过 | `tooling/d2c/` 契约与适配代码，`docs/d2c/phase-2-report.md` |
| **阶段 2 补验** | 真实模块 AST 解析、Token 单位、Mode 解耦与来源哈希补验 | **PASS** (UNIT_VERIFIED) | AST 静态解析、类型检查范围覆盖、数值单位/无单位规则、机器 ID 与 Mode 来源证据、磁盘篡改检测全部通过 | `tooling/d2c/registry/verifier.ts`, `tests/targeted-verification.test.ts` |
| **阶段 3A 修复** | P1-01 至 P1-09 全量修复、契约归一、动态变更传导与浏览器加固 | **PASS** (UNIT_VERIFIED & BROWSER_VERIFIED) | 9 项核心问题全部先测后修；进件流归一；单页 page-adapter 动态传导；Playwright 真实浏览器双版本演进测试全通；60 项测试全过，tsc 0 错误 | `tooling/d2c/figma-plugin/exporter/dist/`, `examples/fixture-app/`, `docs/d2c/phase-3a-report.md` |
| **阶段 3B** | 真实业务接入与路由打通 | **NOT_RUN** | 遵循既定约束，不修改业务仓库，不接入业务路由 | 待后续阶段授权 |
| **阶段 4A** | PRD → UI Blueprint 引擎 (无 MCP 结构化语义层) | **PASS** (UNIT_VERIFIED) | 零 Figma MCP、零幻觉组件名；PRD 事实与决策切分、3 种视觉方向 Design Brief、人工 Gate 阻断、生成完整 UI Blueprint 与 Interaction Contract；全量测试通过 | `tooling/d2c/blueprint/`, `examples/output/` |
| **阶段 4B** | UI Blueprint → Native Figma Generator | **PASS** (UNIT_VERIFIED & SIMULATED) | 声明式 Figma 操作计划、Token Variable 绑定、Draft Component 降级、二次运行幂等与手动修改冲突防线，83 项测试通过 | `tooling/d2c/figma-generator/`, `examples/output/` |
| **阶段 5A** | Figma Design Package → React Prototype | **PASS** (UNIT_VERIFIED & BROWSER_VERIFIED) | 6/6 组件映射至 AntD 5.7.3，零硬编码 Token 校验，4 态契约覆盖，Playwright 真实浏览器 5 项 E2E 交互测试与 6 份截图存档，94 项单元回归全过，tsc 0 错误 | `examples/prototype/users/`, `docs/d2c/prototype-report.md` |
| **阶段 5B-1** | Figma Design → HTML Prototype Generator | **PASS** (UNIT_VERIFIED & BROWSER_VERIFIED) | Greenfield 纯原生 HTML/CSS/JS 原型；Design Element Resolver 语义映射，防幻觉守卫，Hardcoded Style Detector 静态审计通过；Playwright 4 项实机浏览器交互与 6 份截图存档，102 项单元回归全过，tsc 0 错误 | `examples/html-prototype/`, `docs/d2c/html-prototype-report.md` |
| **阶段 5B-2** | HTML Prototype → New React Application | **PASS** (UNIT_VERIFIED & BROWSER_VERIFIED) | 独立 Greenfield React + TypeScript + Vite 工程；Component Resolution 规范映射，4 态完备，Token 主题注入零硬编码；Playwright 4 项浏览器 E2E 测试全过，10 份截图存档；tsc 0 错误，vite build 成功 | `new-project/`, `docs/d2c/new-project-report.md` |
| **阶段 6** | 故障注入、复现验证与完整验收 | **NOT_RUN** | 统一 CLI 体验，CI 守护防线，真实验收闭查 | 验收报告与 CI 规则 |

---

## 2. 阶段 5B-1 原型状态评级标志 (HTML Prototype Status Flags)

| 评估维度 (Dimension) | 状态 (Status) | 说明 (Notes) |
| :--- | :---: | :--- |
| **FIGMA_TO_HTML** | **PASS** | 基于 `figma-release-package`、`ui-blueprint` 与 `canonical-tokens`，通过 `Design Element Resolver` 编译为 W3C 原生语义元素；100% 保留 `data-semantic-id` 与 `data-component`；防幻觉守卫 100% 拦截非法组件名 |
| **INTERACTION** | **PASS** | 原生 `<dialog>` 弹窗唤起、表单必填校验拦截、Mock API 异步提交、Toast 轻提示、表格动态增行、搜索实时过滤、四态切换全部经 Playwright 实机浏览器验证通过 |
| **VISUAL** | **PASS** | 经 Playwright 真实 Chromium 环境全量加载并验证；自动生成并归档 6 份高保真状态截图；100% 采用 `--d2c-*` Semantic CSS Variables，静态与动态检查均零裸色、零裸间距 |
| **REACT_GENERATION** | **NOT_RUN** | 严格遵守 Greenfield 阶段 5B-1 边界，本阶段不进入 React，不创建生产代码，业务仓库 `cs_admin-client` 保持绝对只读且零文件改动 |

---

## 3. 细分维度状态评级与严格分类

| 验证维度 | 当前状态 | 判定说明 | 交付物运行分类 |
| :--- | :---: | :--- | :--- |
| **UNIT_VERIFIED** | **PASS** | 包含契约、AST 模块校验、Token 暂存隔离、进件流、安全防线、变更传播、阶段 4A/4B Blueprint 与原生 Figma 生成防线在内的 83 项自动化测试全部通过（83 passed, 0 failed）。`pnpm run typecheck` (`tsc --noEmit`) 零类型错误。 | **Module Implemented** |
| **LIVE_FIGMA_EXPORT** | **BLOCKED** | 导出插件已构建就绪（`dist/manifest.json` 单一交付路径，`networkAccess: allowedDomains: ['none']`），因用户尚未在真实 Figma 中载入并点击导出，保持真实 BLOCKED，不伪造实时导出证据。 | **Waiting for Live User Action** |
| **DESIGN_TO_FIXTURE** | **PASS** | 独立 `fixture-app` 成功跑通用户管理页（Ready / Loading / Empty / Error 四状态、过滤搜索、新建弹窗表单校验、异常提交拦截与恢复）；Playwright 1.63.0 浏览器自动化测试 100% 通过。 | **Mock Integrated & Browser Captured** |
| **DESIGN_CHANGE_PROPAGATION** | **PASS** | 通过 `adapter/page-adapter.ts` 真实消费 Rev 1 与 Rev 2 设计包，DOM 渲染 `data-d2c-revision`, `data-d2c-spacing`, `data-d2c-content-hash`，Playwright 验证间距由 16px 变为 24px、标题变更、按钮样式变更，独立验证旧审批判定失效。 | **Module Implemented & Browser Verified** |
| **PRODUCTION_REPO_INTEGRATION** | **NOT_RUN** | 目标业务仓库 `cs_admin-client` 保持绝对只读，Git 状态前后无任何新增提交或分支推送，修改增量为 0。 | **Inspected (Read-Only)** |

---

## 4. 关键交付文件清单

1. **插件产物与交付路径 (P1-01)**：
   - `tooling/d2c/figma-plugin/exporter/dist/manifest.json`：单一交付清单，相对路径解析 `main: "code.js"`, `ui: "ui.html"`，安全审计 0 Node 依赖、0 eval、0 外网。
   - `tests/plugin-packaging.test.ts`：插件交付打包回归测试。
2. **进件流与契约归一 (P1-02)**：
   - `tooling/d2c/normalizer/export-adapter.ts`：将 raw export 结构转换为规范 `DesignContextSchema`。
   - `tooling/d2c/cli/intake.ts`：官方进件 CLI (`pnpm run d2c:intake`)，支持 raw export -> adapter -> 契约校验 -> 暂存隔离 -> 磁盘完整性发布。
   - `tooling/d2c/cli/validate.ts`：支持 `--all` 校验内置契约样本与 `design/releases/` 实际候选包。
   - `tests/intake-pipeline.test.ts`：进件管线与全量包校验测试。
3. **官方契约与身份校验 (P1-03)**：
   - `tooling/d2c/contracts/validate.ts`：内置复合业务身份碰撞（`screenId:state:breakpoint:semanticId:instanceKey`）与 Provenance 矛盾检测。
   - `tests/contracts.test.ts`：官方校验器防线测试。
4. **AST 组件静态校验与独立测试 Fixtures (P1-04 & P2)**：
   - `tests/fixtures/test-repo/`：独立测试工程（无需依赖外部业务仓库即可完成单测）。
   - `tooling/d2c/registry/verifier.ts`：支持外部包真实导出判定、过滤 Type/Interface、标记未安装依赖。
   - `tests/targeted-verification.test.ts`：定向补验专项用例（20 项测试）。
5. **动态绑定与主题提案 (P1-05)**：
   - `tooling/d2c/registry/binding-proposal.ts`：动态遍历 `components.used.json`，标记 `SyntheticTag` 为提案级，动态计算 Token 差异。
   - `tests/binding-proposal.test.ts`：动态映射与差异计算测试。
6. **跨边界变更传导 (P1-06)**：
   - `examples/fixture-app/src/adapter/page-adapter.ts`：单页级包适配器，动态解析标题、按钮变体、布局间距。
   - `examples/fixture-app/src/App.tsx` & `UsersPage.tsx`：消费设计包并在 DOM 渲染 `data-d2c-*` 标识。
   - `tests/change-propagation.test.ts`：真实 Playwright 浏览器双版本切换与旧审批失效断言。
7. **视觉一致性度量与稳健比对 (P1-07)**：
   - `tooling/d2c/contracts/measure.ts`：DOM 测量值与设计声明边界比对工具。
   - `tests/browser-verification.test.ts`：测试状态重置隔离、`.ant-spin-spinning` 激活检查、表单失败与恢复流、故意尺寸错配负向测试、草稿截图标记。
8. **数据保真度与边界修复 (P1-08)**：
   - `tooling/d2c/figma-plugin/exporter/src/code.ts`：提取 Auto Layout 尺寸模式 (`HUG`/`FILL`/`FIXED`)、文本分段、API null 诊断。
   - `tooling/d2c/normalizer/variables.ts`：跨集合 Mode 同名解析与默认回退，精确保持 `0` 与 `false`。
   - `tests/normalizer.test.ts`：跨集合别名与边界值测试。
9. **包安全边界与安全 DOM (P1-09)**：
   - `tooling/d2c/contracts/hash.ts` & `tooling/d2c/cli/package.ts`：强制 7 项必备资源、路径穿越与 Windows 盘符拦截、`.staging/` 隔离原子写入。
   - `tooling/d2c/tokens/builder.ts`：Token 构建暂存隔离，报错不覆盖历史正常产物。
   - `tooling/d2c/figma-plugin/exporter/src/ui.html`：全面采用 Safe DOM API，杜绝未转义字符串插值。
   - `tests/package-security.test.ts`：安全专项回归测试。
10. **阶段 4A PRD → UI Blueprint 引擎**：
   - `tooling/d2c/blueprint/schema.ts`：Zod 契约模式（UIRequirement、ScreenBlueprint、ComponentIntent、DesignBrief、VisualDirection、InteractionContract）。
   - `tooling/d2c/blueprint/component-intent-catalog.json`：官方组件语义目录，锁定组件库合法范围。
   - `tooling/d2c/blueprint/catalog-validator.ts`：反幻觉守护验证器，防范非标准组件与重复语义 ID。
   - `tooling/d2c/blueprint/analyzer.ts`：PRD Markdown 事实/假设/待定决策分流切分器。
   - `tooling/d2c/blueprint/design-brief.ts`：3 套视觉方向生成器（A: Enterprise Dense, B: Modern SaaS, C: Minimal Productivity），包含人工 Gate 停止点。
   - `tooling/d2c/blueprint/blueprint-generator.ts`：ScreenBlueprint 结构化生成器。
   - `tooling/d2c/blueprint/interaction-contract.ts`：事件流与状态转移契约生成与引用验证器。
   - `tooling/d2c/cli/blueprint.ts`：统一 CLI 工具 (`pnpm d2c:blueprint --analyze / --generate / --demo`)。
   - `examples/prd/users-management.md` & `examples/output/`：端到端验证用例与 4 类标准 JSON 产物。
   - `tests/blueprint.test.ts`：12 项专项单元与契约校验测试。
11. **阶段 4B UI Blueprint → Native Figma Generator**：
   - `tooling/d2c/figma-generator/image-prompts.ts`：GPT 图像视觉探索提示词生成器（输出 `visual-prompts.json`，严禁作数据源）。
   - `tooling/d2c/figma-generator/token-binding.ts`：Token Variable 绑定引擎，静态严禁未映射硬编码值。
   - `tooling/d2c/figma-generator/component-mapper.ts`：组件候选映射提案生成器（输出 `mapping-proposal.json`，禁止 autoPublish）。
   - `tooling/d2c/figma-generator/plan-generator.ts`：声明式 Figma 操作计划生成器（输出 `figma-operation-plan.json`）。
   - `tooling/d2c/figma-generator/simulator.ts`：Figma 场景图仿真引擎（验证 Frame/Auto Layout/幂等性/冲突检测）。
   - `tooling/d2c/figma-generator/plugin/`：原生 Figma 插件清单与源码 (`code.ts`, `manifest.json`, `ui.html`)。
   - `examples/output/figma-release-package.json`：Figma 发布包清单。
   - `tests/figma-generator.test.ts`：11 项专项单元、幂等与冲突检测测试。

---

## 5. 下一步动作前置（等待用户确认）

1. **用户审阅**：检查 `examples/output/` 中的 4B 关键产物 (`visual-prompts.json`, `figma-operation-plan.json`, `figma-release-package.json`, `mapping-proposal.json`)。
2. **可选人工操作**：如需在真实 Figma 中加载并运行生成，可在 Figma 桌面端载入 `tooling/d2c/figma-generator/plugin/manifest.json` 并粘贴执行 `figma-operation-plan.json`。
3. **停止点遵从**：阶段 4B 已全部就绪，全流程零 Figma MCP、零业务仓库修改、未进入 React 代码生成。未收到阶段 5（本地桥接或受控回写）指示前，保持停滞。
