# 风险登记册 (Risk Register)

核查日期：2026-09-21（于 2026-09-22 修正与补充）  
更新责任人：Antigravity Agent (技术负责人)

---

## 风险等级定义
- **CRITICAL**: 造成安全漏洞、系统入侵、生产代码损坏或法务违规，必须硬阻断。
- **HIGH**: 导致核心功能无法运行、框架版本冲突或不可控数据污染，必须重构或替换。
- **MEDIUM**: 引起类型隐式转换、信息丢失或非预期行为，需要适配器修复与单元测试覆盖。
- **LOW**: 边界展示差异、性能微弱波动或警告日志，可通过工程规范规避。

---

## 风险条目清单

| 风险 ID | 风险领域 | 风险描述与触发条件 | 严重程度 | 应对策略与工程隔离方案 | 状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | **安全漏洞** | `figma-api` 的 `plugin/code.js` 包含任意 `eval` 执行接口，且 WebSocket Relay 存在跨频道全连接广播机制，缺乏身份验证 | **CRITICAL** | **剔除原版 figma-api 运行时**。所有插件通信必须经过白名单指令校验，阶段 5 若需要桥接必须重写绑定 `127.0.0.1` 且具短期 Token 认证的守护服务。 | **MITIGATED** |
| **RSK-02** | **许可证合规** | `FigmaToCode` 采用 GPL-3.0 传染性开源许可证。若将其源码、模板或测试夹具复制进核心包，在对外分发时存在 GPL 开源合规诉讼与代码公开风险 | **CRITICAL** | **严禁复制代码进入核心代码库**。将其判定为 `REJECTED`，仅在逻辑隔离下作为外部对照（Clean-room 原则）。 | **BLOCKED** |
| **RSK-03** | **环境冲突** | `react-figma` package.json 声明 `engines.node: ">=10.0.0 <22.0.0"`，且底层绑定 React 16 Reconciler；本机宿主为 Node `22.22.2`，目标业务仓库为 React 18 | **HIGH** | **主线排除 react-figma**。避免生产依赖版本倒退，后续 Figma 原生写入直接通过官方受控 Plugin API 实现。 | **AVOIDED** |
| **RSK-04** | **工具链缺失** | `figma-map` 源码需 Go 1.22+ 编译，Backend 依赖 Bun；本机宿主未安装 `go` 与 `bun` 编译器 | **HIGH** | **当前环境不直接执行其源码路径**。汲取其设计理念，自研纯 TypeScript 适配模块实现 Component Binding 与比对算法，确保在 Node.js 下平稳运行。 | **RESOLVED** |
| **RSK-05** | **MCP 规则违规** | `figma-map init` 自动在目标工程写入 `.mcp.json` 并注册 MCP 服务，违反总控第一条约束 | **CRITICAL** | **严禁执行 `figma-map init`**。所有数据通道收敛为本地文件交换，不触碰任何 MCP 配置。 | **MITIGATED** |
| **RSK-06** | **设计信息损失** | `design-to-code-json` 默认剥离 `nodeId`、打平 Alias 链、折叠单 Mode 变量，且多 Collection 同名变量会相互覆盖 | **HIGH** | **自研抽取并重写 Normalizer**。强制保留完整 `nodeId`、以 `Collection:Variable` 二元组建立防碰撞命名空间，输出不可变 `DesignContext`。 | **PLANNED (Phase 2)** |
| **RSK-07** | **组件语义伪造** | 视觉 Frame 自动推导（`synthesizeComponents`）易误判为业务组件；AI Binding 产生布尔字符串化 (`"false"`) 与虚构 props | **HIGH** | **设立人工审核 Gate**。Frame 去重仅作视觉参考，严禁代替真实组件解析；布尔值严格校验；Component Registry 必须由工程师确认后方可用于代码生成。 | **CONTROLLED** |
| **RSK-08** | **工作区破坏** | 目标业务仓库（`cs_admin-client`）存在用户未提交的 `dev` 分支代码，自动化脚本误操作可能导致工作丢失 | **CRITICAL** | **实施工作区硬保护约束**。严禁自动运行 `git reset`, `git clean` 或修改业务源码；阶段 1/2 产物局限于独立 tooling 与 docs 目录。 | **ENFORCED** |
| **RSK-09** | **视觉断言误报** | 浏览器与 Figma 字体栅格化差异、操作系统抗锯齿不同导致逐像素 Diff 产生大量伪缺陷 | **MEDIUM** | **实施双层验证策略**。区分真实设计一致性比对（人工与结构化属性检查）与代码回归比对（固化环境下的 Playwright 截图基准）。 | **PLANNED (Phase 3/6)** |
| **RSK-10** | **跨 Mode 映射混乱** | Figma 多 Collection（如 Primitives / Semantic）的 Mode 命名不一致，盲目自动映射会导致暗黑模式变量错乱 | **MEDIUM** | **在 Token 契约中建立显式 Mode 映射表**，禁止基于模糊名称匹配做静默隐式映射。 | **PLANNED (Phase 2)** |
| **RSK-11** | **浏览器环境风险** | 当前宿主为 Windows 10 (AMD64)。Playwright 1.63.0 的无头 Chromium 渲染可能受本地字体库、DirectWrite、GPU 加速和 Windows 平台差异影响，可能导致环境截图与 CI Linux 产生基线漂移 | **MEDIUM** | **浏览器验证与逻辑测试严格解耦**。契约、Token、类型与注册表测试完全在纯 Node.js 环境下独立验证；若浏览器在特定环境下无法正常启动或渲染不一致，仅阻断浏览器相关验证（BLOCKED_BROWSER），不得影响核心链路推进。 | **MONITORED** |
