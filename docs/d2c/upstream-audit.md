# 八仓库深度源码审查与能力证据库 (Upstream Audit)

核查日期：2026-09-21  
核查方式：本地 shallow clone (`--depth 1`) 真实源码分析、语法结构与依赖审查、测试脚本实测  
总控原则：不依赖 Figma MCP，禁止臆造已提取代码，区分真实运行时与外部参考，明确许可证合规。

---

## 目录
1. [design-to-code-json](#1-design-to-code-json)
2. [figma-map](#2-figma-map)
3. [react-figma](#3-react-figma)
4. [figma-api](#4-figma-api)
5. [tokens-studio-figma-plugin](#5-tokens-studio-figma-plugin)
6. [style-dictionary](#6-style-dictionary)
7. [FigmaToCode](#7-figmatocode)
8. [playwright](#8-playwright)

---

## 1. design-to-code-json

- **Repository**: `https://github.com/arifinbardansyah/design-to-code-json`
- **Selected SHA**: `0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94`
- **Selected Tag**: `v0.11.0` (HEAD 与 tag 对齐)
- **Branch**: `main`
- **License**: `MIT` (Copyright 2026 Arifin Bardansyah)
- **Runtime & Engines**: Node.js (ESM), `@figma/plugin-typings ^1.100.0`, `esbuild ^0.24.0`, `typescript ^5.6.0`

### 源码逐项审查事实

1. **节点遍历与有损压缩机制 (`src/code.ts`)**:
   - `code.ts` 第 160-162 行明确声明行为固定：`dedupe + component library on, ids dropped, instances not expanded, all variable modes emitted`。
   - **重大信息损失：删除 `nodeId`**。原始设计树中的唯一节点标识符在生成 compact JSON 时被剔除，导致其产物无法直接用于双向定位、DOM 与 Figma 节点对齐 (`source-map.json`) 以及受控回写。
2. **变量与 Alias 转换 (`src/transform.ts`)**:
   - 符号：`resolveToLiteral(value, modeId, varById, collById, seen)`。
   - 实现：采用广度优先解析别名引用，设置了环检测 `seen.has(value.id)`。
   - **重大信息损失：引用链丢失与同名冲突**。
     - `buildFlatCatalog` 将别名直接打平为最终十六进制颜色或数值字面量，丢失了 Token 引用链（如 `button.primary.bg -> color.blue.600 -> #1890ff` 中的语义层关系）。
     - 目录字典以变量名 `v.name` 作为主键 (`colors[v.name] = ...`)。若不同 Collection（如 `Primitives` 与 `Semantic`）存在同名变量，后解析的变量直接覆盖前一个，产生静默碰撞！
     - 单 Mode 折叠有损：当一个 Collection 仅有 1 个 Mode 时，输出值从 `{ Default: "#fff" }` 坍缩为纯字符串 `"#fff"`，导致下游解析器面临多态类型。
3. **组件推导与去重 (`src/components.ts`)**:
   - 符号：`synthesizeComponents(nodes, opts)`、`signature(node, opts)`。
   - 实现：通过比对容器子树结构签名（布局、对齐、插槽字段等），将重复出现的 Frame 结构自动抽象为“虚拟组件”并替换为 `{ use, props }`。
   - **架构边界警告**：此推导组件仅为 AST 纯视觉压缩，**绝不等于真实代码库中封装良好、具备业务交互的 Design System 组件**（例如 Ant Design 的 `<Button />` 或 `<Table />`）。直接信任此组件推导会导致生成大量无意义的临时 JSX wrapper。
4. **测试现状实测**:
   - 官方测试脚本：`node tool/test_transform.mjs && node tool/test_components.mjs`。
   - 本地无依赖直接运行退出码：`1` (`ERR_MODULE_NOT_FOUND: Cannot find package 'esbuild'`)。
   - 证据：`test_transform.mjs` 依赖 `esbuild` 在运行时动态将 `src/transform.ts` 编译为临时 ESM 文件，必须在受控环境下提供打包器或经由 TypeScript 预编译执行。

### 复用决策
- **复用方式**: `VENDORED_MODULE` (小范围受控重构抽取)
- **目标本地模块**: `tooling/d2c/normalizer/` 与 `tooling/d2c/figma-plugin/exporter/`
- **改造要点**:
  1. 必须补全保留原始 `nodeId`、`sourceFileRef` 和组件 Instance 身份。
  2. 提取 `transform.ts` 中的 `rgbaToHex` 及基础几何计算，重写 `buildFlatCatalog`，输出携带完整 collection、mode、alias graph 的不可变快照，杜绝同名变量碰撞与单 Mode 随意坍缩。

---

## 2. figma-map

- **Repository**: `https://github.com/KirillBaranov/figma-map`
- **Selected SHA**: `6901f443e29c55d09558872a95a28dc3d14508fc`
- **Selected Tag**: `v0.13.0`
- **Branch**: `main`
- **License**: `MIT` (Copyright 2026 Kirill Baranov)
- **Runtime & Engines**: Go 1.22+ (CLI), Bun / Node 20+ (Backend), WebSocket, `@modelcontextprotocol/sdk ^1.26.0`

### 源码逐项审查事实

1. **CLI / Backend / Plugin 边界与运行时**:
   - 根命令由 Go 实现 (`main.go`, `cmd/root.go`)，子命令统一定义在 `internal/op/registry.go`。
   - 后台 (`backend/`) 依赖 Bun 或 Node 20+，使用 `@modelcontextprotocol/sdk` 和 `ws` 暴露服务。
   - **本机环境基线事实**：当前宿主未安装 `go` 与 `bun`，且 `init` 命令 (`cmd/init.go`) 会主动向目标项目的 `.mcp.json` 写入 MCP 服务注册，并修改 `CLAUDE.md`。
   - **总控硬约束遵从**：**严禁执行 `figma-map init` 与 `figma-map mcp`**，禁止引入或激活任何 MCP 服务。
2. **组件解析与 Binding 机制 (`internal/op/`)**:
   - 审查 `docs/limitations.md` 与 `internal/service/`:
     - **Binding 是 AI 草稿**：`bind` 命令利用 Vision LLM 基于 Storybook 故事名猜测组件属性，容易虚构不存在的 prop 或漏填值，官方明确强调“必须人工审核 Binding”。
     - **Boolean Props 字符串化缺陷**：布尔类型 prop 被导出为字符串格式（如 `disabled: ["false", "true"]`），在生成代码中渲染为 `disabled="true"`，违反 React 惯用法。
     - **Import 路径脆弱**：直接从 Storybook 故事源文件提取相对路径，若移动或缺少别名配置会导致编译失败。
3. **样式比对与 DOM 对齐 (`reconcile`)**:
   - 依靠 `data-figma-node` 进行精确匹配；若无此标记则退化为几何位置/文本内容启发式匹配（标记为低置信度）。未匹配节点报告为 `unmeasured`。
   - 无法比对 margins、box-shadow、渐变等复合属性，且无法捕获 hover/active 等交互态。

### 复用决策
- **复用方式**: `CLI_ADAPTER` (架构与契约理念采纳，自研薄 TypeScript CLI 适配器)
- **目标本地模块**: `tooling/d2c/registry/` 与 `tooling/d2c/verification/`
- **改造要点**:
  1. 汲取其 Component Binding 契约与 `data-figma-node` DOM 对齐思想，在阶段 2 中定义严格强类型的 `ComponentRegistry` JSON Schema。
  2. 彻底剥离其 Go CLI 与 Bun MCP 服务，由本地纯 TypeScript 工具实现扫描与比对，规避 Go/Bun 编译依赖与 MCP 污染。
  3. 修复布尔类型为严格 boolean，禁止将 `false` 序列化为 `"false"`。

---

## 3. react-figma

- **Repository**: `https://github.com/react-figma/react-figma`
- **Selected SHA**: `1fd2d9d7ed4fbdb3c217d17a171432df9a506819`
- **Selected Tag**: `v0.31.0` (commit `eb1bacd0b0f9d2249c7451cf5cd8fff32e8c30a7`)
- **Branch**: `master`
- **License**: `MIT` (Copyright 2019 Ilya Lesik)
- **Runtime & Engines**: `node >=10.0.0 <22.0.0`, React `16.8.6`, `react-reconciler ^0.23.0`, `typescript ^3.5.3`, `@figma/plugin-typings 1.64.0`, `yoga-layout-prebuilt 1.9.3`

### 源码逐项审查事实

1. **引擎与核心依赖严重过时**:
   - `package.json` 第 37 行：`"engines": { "node": ">=10.0.0 <22.0.0" }`。当前宿主环境为 Node `v22.22.2`，直接超出其支持范围。
   - 核心 reconciler 基于 `react-reconciler ^0.23.0`，绑定 React 16 生命周期。而我们的业务仓库（`cs_admin-client`）以及现代前端生态均运行在 React 18 / 19。若强行引入将导致 React 上下文撕裂、Hooks 崩溃与严苛的 peerDependencies 报错。
2. **布局机制与原生 Auto Layout 错位**:
   - `react-figma` 核心使用 Facebook Yoga (`yoga-layout-prebuilt`) 在客户端计算绝对 Flexbox 盒模型坐标，再调用 `node.resize` 与 `node.x / node.y` 进行绝对定位摆放。
   - 虽然存在 `src/mixins/autoLayoutMixin.ts`，但其属性映射仅对应 Figma 早期 API (`primaryAxisSizingMode`, `counterAxisSizingMode`)，完全不支持现代 Figma Auto Layout 的 `HUG` / `FILL` (`layoutSizingHorizontal = 'FILL'`)、Wrap 换行以及现代变量绑定。

### 复用决策
- **复用方式**: `REJECTED` (主线淘汰，不作为生产与写入依赖)
- **淘汰原因**: Node 22 与 React 18 双重版本阻断；Yoga 绝对坐标计算违背“生成原生 Auto Layout 可编辑设计”的总控要求。
- **参考保留**: 仅将 `src/mixins/autoLayoutMixin.ts` 中的基础布局枚举对应关系作为编写自研 Figma 原生 Plugin Writer 时的历史参考。

---

## 4. figma-api

- **Repository**: `https://github.com/todoforai/figma-api`
- **Selected SHA**: `c094db9c706c33dc14431e7f929784907a3f01b0`
- **Selected Tag**: none (HEAD)
- **Branch**: `main`
- **License**: `MIT` (Copyright 2026 TODOforAI)
- **Runtime & Engines**: Bun (`bun.lock`), `commander ^14.0.3`

### 源码逐项审查事实

1. **通信协议与严重安全隐患 (`src/bridge.ts`)**:
   - **跨频道广播泄露**：第 78-89 行实现了一个所谓“便利”特性——忽略客户端指定的 channel，直接将消息向所有连接的其他 peer 广播 (`for (const peer of all) if (peer !== ws) peer.send(out)`)。这意味着如果在同一端口存在多个项目或不同会话，所有数据和指令会被毫无防备地交叉泄露！
   - **缺乏鉴权与 Origin 检查**：没有 Token 校验，没有 Host / Origin 白名单检查，任何网页或外部进程均可直连该 WebSocket 端口。
   - **监听地址歧义**：终端打印 `listening on ws://localhost:3055`，但底层调用 `Bun.serve` 未显式配置 `hostname: "127.0.0.1"`，在多网卡环境下存在绑定 `0.0.0.0` 的远程被渗透风险。
2. **高危任意代码执行 (`plugin/code.js`)**:
   - 第 64-67 行显式内置了 `eval` 命令：
     ```javascript
     async eval(p) {
       const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
       return { value: serialize(await new AsyncFunction("figma", p.code || "")(figma)) };
     }
     ```
   - 任何连接到 Relay 的客户端只要发送 `{ command: "eval", params: { code: "..." } }`，即可在用户当前打开的 Figma 文档上下文中执行任意 JavaScript，可能导致文档被恶意清空或数据外泄。
3. **无损导出发现 (`plugin/code.js`)**:
   - 第 81 行：`await n.exportAsync({ format: "JSON_REST_V1" })`。证实 Figma 官方 Plugin API 原生支持将节点树完整导出为无损 REST V1 JSON 对象，无需任何启发式压缩或字段剥离。

### 复用决策
- **复用方式**: `REJECTED` (未经加固前严禁直接作为桥接服务端)
- **目标本地模块**: `tooling/d2c/figma-plugin/writer/` (仅受控参考其指令类型)
- **加固与重构要求**:
  1. 彻底删除 `eval` 命令，所有写操作必须是白名单受限命令（如 `create_frame`, `set_auto_layout`, `bind_variable`）。
  2. 若在阶段 5 实现本地桥接，必须重写为基于 Node.js `ws` 的独立安全服务，强制绑定 `127.0.0.1`，引入短期配对 Token、Origin 强校验与跨会话绝对隔离。

---

## 5. tokens-studio-figma-plugin

- **Repository**: `https://github.com/tokens-studio/figma-plugin`
- **Selected SHA**: `5c7fe785f6e8f82849f4e19d345c00dcbefdda31`
- **Selected Tag**: `2.12.0` (commit `6527e22b36e8301d9785e923fdadca1240ff5bc1`)
- **Branch**: `main`
- **License**: `MIT` (Copyright 2023 Jan Six and Contributors, LICENSE.md)
- **Runtime & Engines**: 庞大 Monorepo，依赖 `@supabase/supabase-js`, `@octokit/rest`, `@monaco-editor/react`, `@sentry/browser`, `stitches`, `radix` 等数百个依赖

### 源码逐项审查事实

1. **架构边界与体积分析**:
   - 该项目是一个拥有完整 UI、云端多后端同步（GitHub, GitLab, Supabase, Supernova）、Monaco 代码编辑器和 Sentry 上报的企业级 Figma 插件产品。
   - 核心代码高度耦合其自身的前端状态管理 (`@rematch/core`)、Stitches 样式系统与云存储。
2. **Token 数据契约标准**:
   - 其导出的 JSON 遵循 W3C DTCG (Design Tokens Community Group) 标准雏形，以 `$value`, `$type`, `{alias.path}` 形式表达设计令牌与别名图谱。

### 复用决策
- **复用方式**: `DEPENDENCY_FREE_SPEC` (仅采用其公开 Token 数据标准格式，不抽取或打包其插件代码)
- **目标本地模块**: `tooling/d2c/tokens/`
- **决策说明**:
  - 用户可自由在 Figma 中安装官方 Tokens Studio 插件管理 Token，并导出为标准 JSON。
  - 本系统的 Token 转换管线仅接收该标准 JSON 作为输入，完全无需引入该插件庞大的源码或依赖。

---

## 6. style-dictionary

- **Repository**: `https://github.com/style-dictionary/style-dictionary`
- **Selected SHA**: `951cc612b37a18f2d26fcfa55858c93b09109e1d`
- **Selected Tag**: `v5.5.5`
- **Branch**: `main`
- **License**: `Apache-2.0` (Amazon.com / Style Dictionary Contributors, 含 NOTICE 文件)
- **Runtime & Engines**: Node.js `>=22.0.0`, 纯 ESM 模块架构

### 源码逐项审查事实

1. **版本与环境契约高度契合**:
   - `package.json` 明确规定 `"engines": { "node": ">=22.0.0" }`，与本机 Node `v22.22.2` 完美契合。
   - 导出纯 ESM 接口 (`export { StyleDictionary } from './lib/StyleDictionary.js'`)，支持插件化的 `hooks`: `transforms`, `formats`, `actions`。
2. **业务适配可行性**:
   - 目标业务项目使用 Ant Design 5 与 Less。Style Dictionary v5 原生支持自定义 Format。
   - 我们只需编写一个轻量 Format 适配器，将 Tokens 转换为 Ant Design 5 的 `theme.useToken()` / `ConfigProvider` 主题对象和 CSS Variables，无需 fork 任何 Style Dictionary 内核代码。

### 复用决策
- **复用方式**: `DEPENDENCY` (固定版本 npm 官方公开依赖 `style-dictionary@^5.5.5`)
- **目标本地模块**: `tooling/d2c/tokens/builder.ts`
- **决策说明**: 完全保持官方原版依赖引入，零内核修改，仅通过公开 API 注册 Transform 和 Format。

---

## 7. FigmaToCode

- **Repository**: `https://github.com/bernaferrari/FigmaToCode`
- **Selected SHA**: `f5c4831d5de6cffc19a73fe2823c56b4bb551281`
- **Selected Tag**: none (HEAD)
- **Branch**: `main`
- **License**: `GPL-3.0` (GNU General Public License v3.0, 35,821 bytes)
- **Runtime & Engines**: Turbo monorepo, `pnpm`, React 19, TypeScript

### 源码逐项审查事实

1. **严格的传染性许可证 (GPL-3.0)**:
   - 根目录下存在完整的 GNU General Public License v3.0。
   - 任何直接 vendoring、复制、改编其 `packages/backend`（包括其 `altNodes` IR 转换器、Tailwind 生成器、模板代码）到闭源或商业工程中的行为，在分发时均会触发 GPL-3.0 的开源同等条款约束。
2. **生成机制审查 (`packages/backend/src`)**:
   - 架构为：Figma Node -> `altNodes` (扁平中间树) -> `html` / `tailwind` 纯文本拼接。
   - 生成的纯文本仅包含基础 HTML 标签（`<div>`, `<span>`）与 Tailwind 实用类，完全不感知目标仓库的组件系统（无法映射到 `<Button />` 或 `<Table />`）。

### 复用决策
- **复用方式**: `REJECTED` (严禁抽取源码进入核心包与运行时)
- **使用边界**: 仅作为外部对照参考（Clean-room 原则），严禁将任何 GPL 代码、模板或测试 fixture 复制进本工程的代码库中。

---

## 8. playwright

- **Repository**: `https://github.com/microsoft/playwright`
- **Selected SHA**: `07f1a6154795f055f341b8972086533e8e48b36f`
- **Selected Tag**: `v1.63.0`
- **Branch**: `main`
- **License**: `Apache-2.0` (Microsoft Corporation, 含 NOTICE 文件)
- **Runtime & Engines**: Node.js, 跨平台浏览器自动化引擎

### 源码逐项审查事实

1. **定位与复用边界**:
   - 浏览器的二进制下载与自动化驱动极其庞大，严禁从源码抽取任何浏览器自动化核心。
   - 必须通过官方已发布的公开 npm 包 `@playwright/test` 或 `playwright` 引入。
2. **两层验证原则落实**:
   - 必须将“真实设计一致性审核 (Visual Conformance)”与“代码行为回归断言 (Regression Testing)”明确解耦。
   - 视觉基准必须在固定的操作系统、字体包、动画关闭策略及固定视口（1440×900 / 390×844）下采集，严禁通过自动覆盖 snapshot 抹平真实缺陷。

### 复用决策
- **复用方式**: `DEPENDENCY` (固定使用公开依赖 `@playwright/test@^1.63.0`)
- **目标本地模块**: `tooling/d2c/verification/`
- **决策说明**: 复用已有测试配置，构建设计包的比对断言脚本。

---

## 9. 审查结论总表

| 仓库名称 | 选定 SHA / Tag | 许可证 | 审查结论 (复用方式) | 核心理由 |
| :--- | :--- | :--- | :--- | :--- |
| **design-to-code-json** | `0d9b1dc...` / `v0.11.0` | MIT | `VENDORED_MODULE` (受控抽取并修复) | 抽取纯算法转换逻辑，修复缺失 nodeId 与变量碰撞缺陷 |
| **figma-map** | `6901f44...` / `v0.13.0` | MIT | `CLI_ADAPTER` (架构采纳 + TS 重写) | 汲取 Binding 与 Reconcile 契约，剥离 Go/Bun 与 MCP 注册 |
| **react-figma** | `1fd2d9d...` / `v0.31.0` | MIT | `REJECTED` (淘汰，仅留历史参考) | Node 22 与 React 18 严重不兼容；Yoga 无法产出原生 Auto Layout |
| **figma-api** | `c094db9...` / HEAD | MIT | `REJECTED` (主线淘汰，加固后备用) | 存在高危 eval 及跨频道广播漏洞，且依赖 Bun |
| **Tokens Studio** | `5c7fe78...` / `2.12.0` | MIT | `DEPENDENCY_FREE_SPEC` (仅遵循数据契约) | 仅对接其导出的 W3C DTCG Token JSON，不引入臃肿插件源码 |
| **Style Dictionary** | `951cc61...` / `v5.5.5` | Apache-2.0 | `DEPENDENCY` (官方 npm 原生依赖) | 原生支持 Node 22，零 fork 扩展 Ant Design 5 格式转换 |
| **FigmaToCode** | `f5c4831...` / HEAD | GPL-3.0 | `REJECTED` (严禁复制代码) | GPL-3.0 许可证传染风险，且生成产物无真实组件复用能力 |
| **Playwright** | `07f1a61...` / `v1.63.0` | Apache-2.0 | `DEPENDENCY` (官方 npm 原生依赖) | 官方测试工具，承载双层浏览器视觉与交互回归验证 |
