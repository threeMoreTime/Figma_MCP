# D2C 集成推进状态跟踪 (D2C Status Tracking)

最后更新：2026-09-22 10:18:00  
当前执行阶段：**阶段 2 定向补验 + 阶段 3A (真实 Figma 到独立预览) — 已完成**

---

## 1. 总体进度仪表盘

| 阶段 | 阶段名称 | 状态 | 关键验证标准 | 产物与报告 |
| :--- | :--- | :--- | :--- | :--- |
| **阶段 1** | 八仓库源码审查与最小复用决策 | **PASS** | 全部八个仓库完成本地审查、固定 SHA 与许可证分析，修正复用分类与测试状态 | `docs/d2c/` 审计报告集 & `upstreams.lock.json` |
| **阶段 2** | 统一契约、Token 构建与真实组件注册表 | **PASS** (UNIT_VERIFIED) | 契约 Schema 100% 校验通过，Style Dictionary 构建 AntD 5 主题，只读扫描生成注册表，12 项异常防御全测通过 | `tooling/d2c/` 契约与适配代码，`docs/d2c/phase-2-report.md` |
| **阶段 2 补验** | 真实模块 AST 解析、Token 单位、Mode 解耦与来源哈希补验 | **PASS** (UNIT_VERIFIED) | AST 静态解析、类型检查范围覆盖、数值单位/无单位规则、机器 ID 与 Mode 来源证据、磁盘篡改检测全部通过 | `tooling/d2c/registry/verifier.ts`, `tests/targeted-verification.test.ts` |
| **阶段 3A** | Figma 导出插件 -> 设计包 -> 独立预览与两层浏览器验证 | **PARTIAL** | 纯只读离线插件构建就绪并通过安全审计；用户管理页在 fixture-app 完整实现；Playwright 行为与设计测量全通；变更传播验证通过 | `tooling/d2c/figma-plugin/exporter/`, `examples/fixture-app/`, `docs/d2c/phase-3a-report.md` |
| **阶段 3B** | 真实业务接入与路由打通 | **NOT_RUN** | 遵循既定约束，不修改业务仓库，不接入业务路由 | 待后续阶段授权 |
| **阶段 4** | PRD / 视觉参考 -> 原生 Figma | **NOT_RUN** | Blueprint 编译为原生可编辑 Auto Layout 设计，同 Blueprint 重跑幂等 | Figma Plugin Writer |
| **阶段 5** | 可选本地桥接与受控设计回写 | **NOT_RUN** | 安全加固的本地 Loopback 网关，三方差异比对与受控回写 | `tooling/d2c/bridge/` |
| **阶段 6** | 故障注入、复现验证与完整验收 | **NOT_RUN** | 统一 CLI 体验，CI 守护防线，真实验收闭查 | 验收报告与 CI 规则 |

---

## 2. 细分维度状态评级

| 验证维度 | 当前状态 | 判定说明 |
| :--- | :---: | :--- |
| **UNIT_VERIFIED** | **PASS** | 包含契约、AST 模块校验、Token 格式化规则、哈希确定性与变更传播在内的 37 项自动化测试全部通过（37 passed, 0 failed）。`tsc --noEmit` 全量 0 错误。 |
| **LIVE_FIGMA_EXPORT** | **BLOCKED** | 导出插件已构建完成（`networkAccess: allowedDomains: ['none']`），因用户尚未在桌面/网页版 Figma 中载入并点击导出，保持真实 BLOCKED 状态，不伪造实时导出证据。 |
| **DESIGN_TO_FIXTURE** | **PASS** | 独立 `fixture-app` 成功跑通用户管理页（Ready / Loading / Empty / Error 四状态、过滤搜索、新建弹窗表单校验与提交）；Playwright 1.63.0 浏览器自动化测试 100% 通过。 |
| **DESIGN_CHANGE_PROPAGATION** | **PASS** | 离线设计包完成 Rev 1 -> Rev 2 自动化演进测试：精确定位文案/变体/间距差异、内容哈希更新、旧审批判定失效、前端组件响应渲染新属性。 |
| **PRODUCTION_REPO_INTEGRATION** | **NOT_RUN** | 目标业务仓库 `cs_admin-client` 保持绝对只读，Git 状态与文件前后哈希一致，修改增量为 0。 |

---

## 3. 关键交付文件清单

1. **补验与验证套件**：
   - `tooling/d2c/registry/verifier.ts`：静态 AST 模块与导出解析器，拦截空路径、缺失导出、默认/具名错配、boolean 字符串化与未安装依赖标记。
   - `tests/targeted-verification.test.ts`：阶段 2 定向补验专项测试集（16 项测试）。
2. **只读 Figma 导出插件**：
   - `tooling/d2c/figma-plugin/exporter/manifest.json`：离线无外网插件清单（`allowedDomains: ['none']`）。
   - `tooling/d2c/figma-plugin/exporter/src/code.ts`：纯只读选区遍历、布局与变量提取、PNG 截图生成。
   - `tooling/d2c/figma-plugin/exporter/src/ui.html`：插件面板 UI，支持统计查看、JSON 下载与截图保存。
   - `tooling/d2c/figma-plugin/build.ts`：esbuild 独立打包并内置代码安全审计（0 Node 依赖、0 eval、0 网络接口）。
   - `tooling/d2c/figma-plugin/exporter/dist/`：可直接载入 Figma 的插件产物。
3. **设计包管理与变更演进**：
   - `tooling/d2c/cli/package.ts`：标准化设计包创建与磁盘完整性校验工具。
   - `design/releases/users_page/rev_1/`：Rev 1 基线设计包（合成来源，审批状态 `PENDING`）。
   - `design/releases/users_page/rev_2/`：Rev 2 包含文本/变体/间距变更的设计包。
   - `tests/change-propagation.test.ts`：变更传播与审批失效自动化测试。
4. **组件绑定与主题提案**：
   - `tooling/d2c/registry/binding-proposal.ts`：生成待审核组件绑定与主题提案。
   - `docs/d2c/proposals/users_page-rev1-binding-proposal.json`：用户管理页绑定提案（标记为 `REVIEW_REQUIRED`）。
5. **独立预览与浏览器双层验证**：
   - `examples/fixture-app/src/pages/UsersPage.tsx`：用户管理页完整原型组件。
   - `examples/fixture-app/dist/index.html`：独立可在本地浏览器运行的完整构建包。
   - `tests/browser-verification.test.ts`：基于 Playwright 1.63.0 的行为检查、`source-map` 坐标测量（含 `UNMEASURED` 守卫）与回归截图测试。
   - `build/screenshots/browser-users-ready.png`：Playwright 生成的浏览器端页面快照。
   - `build/reports/design-consistency-report.json`：DOM 测量与设计上下文比对报告。
6. **详细报告**：
   - `docs/d2c/phase-3a-report.md`：阶段 2 定向补验 + 阶段 3A 交付报告。

---

## 4. 下一步动作前置（等待用户确认）

1. **用户审阅**：检查 `docs/d2c/phase-3a-report.md`、`users_page-rev1-binding-proposal.json` 与 `build/screenshots/browser-users-ready.png`。
2. **可选人工操作**：如需接入真实 Figma 文件，请参考操作清单在 Figma 中载入 `tooling/d2c/figma-plugin/exporter/dist/manifest.json` 并导出设计包。
3. **停止点遵从**：未收到新指令前，进程停止，不自动进入 3B 或后续阶段。
