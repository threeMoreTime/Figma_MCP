# 上游功能抽取与复用决策矩阵 (Extraction Matrix)

核查日期：2026-09-21（于 2026-09-22 修正分类与测试状态）  
说明：依据阶段 1 源码实测与环境基线，明确八个仓库中具体符号级别的复用方案、依赖闭包、许可证处理与维护风险。

---

## 复用矩阵总览

| 编号 | 模块分类 | 来源仓库 | 符号 / 特性 | 复用方式 | 本地目标路径 | 许可证处理 | 维护与风险等级 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M1** | 颜色格式转换 | design-to-code-json | `rgbaToHex(c)` | `VENDORED_MODULE` | `tooling/d2c/normalizer/color.ts` | 保留 MIT 版权头与出处 | LOW |
| **M2** | 变量解析核心 | design-to-code-json | `resolveToLiteral(...)` | `VENDORED_MODULE` (重构) | `tooling/d2c/normalizer/variables.ts` | 保留 MIT 版权头与出处 | MEDIUM |
| **M3** | 扁平目录生成 | design-to-code-json | `buildFlatCatalog(...)` | `REJECTED` (自研替代) | `tooling/d2c/normalizer/catalog.ts` | 自研实现，避免变量覆盖 | MEDIUM |
| **M4** | 组件推导算法 | design-to-code-json | `synthesizeComponents` | `OPTIONAL_EVAL` (降级参考) | `tooling/d2c/normalizer/synthesizer.ts` | 仅作为视觉树压缩选项，不作为组件映射 | LOW |
| **M5** | 组件绑定草稿 | figma-map | `bindOp`, `planOp` 契约理念 | `REFERENCE_ONLY` + `CUSTOM_IMPLEMENTATION` | `tooling/d2c/registry/binding.ts` | 独立编写 TypeScript 契约，遵循 MIT | HIGH |
| **M6** | 视觉对齐比对 | figma-map | `reconcileOp` 对齐理念 | `REFERENCE_ONLY` + `CUSTOM_IMPLEMENTATION` | `tooling/d2c/verification/reconcile.ts` | 独立编写 TypeScript 对齐逻辑，遵循 MIT | HIGH |
| **M7** | 布局渲染容器 | react-figma | `frame`, `autoLayoutMixin` | `REJECTED` | N/A (不引入) | MIT (仅作为历史属性对照表) | HIGH (阻断) |
| **M8** | WebSocket 中继 | figma-api | `startBridge`, `handlers` | `REJECTED` (加固重写) | `tooling/d2c/bridge/` | MIT (若需要则重写安全版本，杜绝 eval) | CRITICAL |
| **M9** | 官方无损导出 | Figma Plugin API / figma-api | `exportAsync({ format: "JSON_REST_V1" })` | `VENDORED_MODULE` | `tooling/d2c/figma-plugin/exporter/` | 遵循 Figma Plugin API 官方规范 | LOW |
| **M10** | Token 数据格式 | Tokens Studio | DTCG Token JSON 规范 | `SPEC_ONLY` | `tooling/d2c/tokens/schema.json` | 仅采用数据格式标准，无插件代码引入 | LOW |
| **M11** | Token 构建转换 | Style Dictionary | `StyleDictionary` 引擎 | `DEPENDENCY` | `package.json` (`dependencies`) | Apache-2.0, 保留 NOTICE | LOW |
| **M12** | 模板代码生成 | FigmaToCode | `altNodes`, `tailwind` | `REJECTED` | N/A (不引入) | GPL-3.0 许可证隔离，严禁复制代码 | HIGH (法务风险) |
| **M13** | 浏览器视觉验证 | Playwright | `@playwright/test` | `DEPENDENCY` | `package.json` (`devDependencies`) | Apache-2.0, 保留 NOTICE | LOW |

---

## 详细符号审计详情

### 1. M1: `rgbaToHex` (design-to-code-json)
- **Upstream Location**: `src/transform.ts#L57-L60` @ `0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94`
- **Permalink**: `https://github.com/arifinbardansyah/design-to-code-json/blob/0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94/src/transform.ts#L57-L60`
- **Input / Output**: `Rgba { r: number, g: number, b: number, a: number }` (0..1) -> `#RRGGBB` 或 `#RRGGBBAA`
- **Dependencies**: 零第三方依赖，纯数学位运算。
- **External Requirements**: 无 Figma / 浏览器 / 网络依赖。
- **Testing Status**: `BLOCKED_ENVIRONMENT`（上游测试脚本 `node tool/test_transform.mjs` 因缺少 devDependency `esbuild` 在未安装依赖时退出码 1；算法逻辑通过独立单元测试验证）。
- **Reuse Mode**: `VENDORED_MODULE`
- **Local Target**: `tooling/d2c/normalizer/color.ts`
- **License Handling**: MIT，文件头部保留原作者版权声明。
- **Risk & Modifications**: 零维护风险，直接抽取消除打包依赖。

### 2. M2: `resolveToLiteral` (design-to-code-json)
- **Upstream Location**: `src/transform.ts#L101-L119` @ `0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94`
- **Permalink**: `https://github.com/arifinbardansyah/design-to-code-json/blob/0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94/src/transform.ts#L101-L119`
- **Input / Output**: `(value: RawValue, modeId: string, varById, collById, seen: Set<string>)` -> `string | number | boolean | null`
- **Dependencies**: 依赖 `RawValue`, `RawVariable`, `RawCollection` 类型。
- **External Requirements**: 纯 AST 操作，无外部环境依赖。
- **Testing Status**: `BLOCKED_ENVIRONMENT`（同上，上游自测环境缺失打包器；由本地测试补足断言）。
- **Reuse Mode**: `VENDORED_MODULE` (改造版)
- **Local Target**: `tooling/d2c/normalizer/variables.ts`
- **License Handling**: MIT。
- **Risk & Modifications**:
  - 原函数仅返回终值，丢失引用关系。
  - 改造要求：扩展返回值，不仅返回字面量，还需输出完整解析路径 `resolvedPath: string[]` 与所属 Collection/Mode 标识。

### 3. M3: `buildFlatCatalog` (design-to-code-json)
- **Upstream Location**: `src/transform.ts#L135-L165` @ `0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94`
- **Permalink**: `https://github.com/arifinbardansyah/design-to-code-json/blob/0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94/src/transform.ts#L135-L165`
- **Status**: `REJECTED` (设计不符合本流程无损要求)
- **Reason**: 以 `v.name` 为 key 导致同名变量碰撞；单 Mode 坍缩导致类型多态不可控。
- **Solution**: 在 `tooling/d2c/normalizer/catalog.ts` 中自研多维度安全快照生成器，以 `collection.name / variable.name` 结构化建索引。

### 4. M5 & M6: Component Binding & Reconcile (figma-map)
- **Upstream Location**: `internal/op/registry.go#L35`, `internal/op/registry.go#L51` @ `6901f443e29c55d09558872a95a28dc3d14508fc`
- **Permalink**: `https://github.com/KirillBaranov/figma-map/blob/6901f443e29c55d09558872a95a28dc3d14508fc/internal/op/registry.go`
- **Input / Output**: 源码组件导出列表 + Figma 设计节点 -> 交互式 Binding 方案与 DOM 布局差异报告。
- **Dependencies**: 原代码依赖 Go 1.22 编译环境与 Bun/Node 后台，且含有 MCP 依赖与自动修改 `.mcp.json` 的副作用。
- **External Requirements**: 需读取前端源码 AST。
- **Reuse Mode**: `REFERENCE_ONLY` + `CUSTOM_IMPLEMENTATION` (未调用 Go CLI，未引入其 Go/Bun 运行时，仅借鉴 Binding 与 DOM 标记思想，自研纯 TypeScript 实现)
- **Local Target**: `tooling/d2c/registry/`
- **License Handling**: 独立编写，遵循 MIT 兼容规范。
- **Risk & Modifications**: 规避原 Go/Bun 与 MCP 强绑定；修复 boolean props 字符串化 bug；建立人工审核 Gate。

### 5. M7: `autoLayoutMixin` / `frame` (react-figma)
- **Upstream Location**: `src/renderers/frame.ts`, `src/mixins/autoLayoutMixin.ts` @ `1fd2d9d7ed4fbdb3c217d17a171432df9a506819`
- **Status**: `REJECTED`
- **Reason**: 绑定 React 16 与 Node `<22.0.0`，与业务目标 Node 22 + React 18 彻底冲突；基于 Yoga 绝对坐标计算，违背原生 Auto Layout 要求。

### 6. M8: `startBridge` / `plugin/code.js` (figma-api)
- **Upstream Location**: `src/bridge.ts#L35`, `plugin/code.js#L64` @ `c094db9c706c33dc14431e7f929784907a3f01b0`
- **Status**: `REJECTED` (作为外部未加固服务直接运行)
- **Reason**: 内置任意 `eval` 代码执行接口，存在跨频道无差别广播泄露，无鉴权与 Origin 校验。
- **Alternative**: 在阶段 5 若需要本地桥接，必须自研符合最小权限原则的安全 Loopback 守卫网关。

### 7. M10: DTCG Token Specification (Tokens Studio)
- **Upstream Location**: `packages/tokens-studio-for-figma` @ `5c7fe785f6e8f82849f4e19d345c00dcbefdda31`
- **Reuse Mode**: `SPEC_ONLY` (仅作为输入数据契约标准，不抽取引进庞大插件应用源码)
- **Local Target**: `tooling/d2c/tokens/types.ts`
- **License Handling**: MIT。

### 8. M11: `StyleDictionary` (style-dictionary)
- **Upstream Location**: `lib/StyleDictionary.js` @ `951cc612b37a18f2d26fcfa55858c93b09109e1d` (v5.5.5)
- **Input / Output**: 标准 Token 格式对象 -> 编译生成的 Ant Design 5 主题文件、CSS Variables。
- **Dependencies**: 纯 Node.js (>=22.0.0) 原生依赖。
- **Reuse Mode**: `DEPENDENCY`
- **Local Target**: 引入为正式依赖 `style-dictionary@5.5.5`。
- **License Handling**: Apache-2.0，在交付清单与代码中包含原 NOTICE。

### 9. M12: Code Generator & IR (FigmaToCode)
- **Upstream Location**: `packages/backend/src/altNodes/` @ `f5c4831d5de6cffc19a73fe2823c56b4bb551281`
- **Status**: `REJECTED`
- **Reason**: GPL-3.0 许可证强传染风险；输出为无法与业务组件库融合的无语义静态 HTML。

### 10. M13: Regression & Visual Tests (Playwright)
- **Upstream Location**: `@playwright/test` @ `07f1a6154795f055f341b8972086533e8e48b36f` (v1.63.0)
- **Input / Output**: 浏览器页面渲染 -> 截图 Diff、DOM 树比对、交互状态断言。
- **Reuse Mode**: `DEPENDENCY`
- **Local Target**: `devDependencies` 中使用 `@playwright/test@^1.63.0`。
- **License Handling**: Apache-2.0。
