# ADR 0001: 无 Figma MCP 开源集成边界与选型决策

- **状态**: 已接受 (Accepted)
- **日期**: 2026-09-21
- **决策者**: Antigravity Agent (技术负责人 / 架构师)
- **技术上下文**: 基于 Windows 10, Node v22.22.2, React 18 / Ant Design 5 目标生态，无 Figma MCP 约束

---

## 1. 背景与诉求

我们需要构建一套可追踪、可验证、不依赖任何官方或第三方 Figma MCP Server 的开源 Design-to-Code 工作流：
`PRD -> Design Brief -> UI Blueprint -> 原生 Figma -> Design Package -> Component Registry + Tokens -> React 实现 -> 浏览器验证`。

在阶段 1，我们对八个候选开源仓库进行了完整的源码审查、依赖分析与兼容性检测：
1. `design-to-code-json`
2. `figma-map`
3. `react-figma`
4. `figma-api`
5. `tokens-studio/figma-plugin`
6. `style-dictionary`
7. `FigmaToCode`
8. `playwright`

我们面临的现实环境制约：
- 本机环境为 **Node.js v22.22.2**，**未安装 Go 与 Bun**。
- 目标真实业务项目（`cs_admin-client`）技术栈为 **React 18 + Ant Design 5.7.3**，且存在正在开发中的未提交代码。
- 约束要求：必须有理有据地确定最小复用组合，不得为了“八个都要用”而引入重复或有害的依赖。

---

## 2. 决策：最小生产组合与模块分工

我们确立以下**唯一主线集成链路**：

```
[Figma Plugin / 导出器]
  └─ 基于 Figma 官方 Plugin API (JSON_REST_V1)
     + 汲取 design-to-code-json (MIT) 纯转换数学算法 (修复缺失 nodeId 与防变量冲突)
       │
       ▼
[不可变设计包 Design Package] (design/releases/<screen>/<revision>/)
  ├─ figma.raw.json (无损原始快照)
  ├─ context.json (多 Mode、保留 Alias 关系的语义上下文)
  └─ manifest.json (内容哈希与审批绑定)
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Token 构建引擎]                  [组件映射与注册表]
  ├─ 接收 Tokens Studio DTCG JSON  ├─ 基于 figma-map 契约理念自研 TypeScript CLI 适配器
  └─ Style Dictionary v5.5.5       └─ 适配真实业务库 Ant Design 5.7.3 封装
     (输出 AntD 5 Theme + CSS Vars)   (严禁将 boolean 转为字符串，人工 Gate 审核)
       │                                 │
       └────────────────┬────────────────┘
                        ▼
       [生产代码实现 (React 18 + AntD 5)]
                        │
                        ▼
       [两层浏览器自动化与回归验证]
         └─ Playwright v1.63.0 (设计结构对比 + 截图交互回归)
```

---

## 3. 逐项目集成结论与淘汰原因

| 仓库名称 | 决策判定 | 角色定义 / 淘汰原因 |
| :--- | :--- | :--- |
| **design-to-code-json** | **小范围源码抽取 (`VENDORED_MODULE`)** | **采纳**：抽取 `src/transform.ts` 中的纯算法（`rgbaToHex` 等）。<br>**重构**：重写变量扁平化逻辑，强制保留 `nodeId`、修复变量重名碰撞。<br>**降级**：Frame 去重仅作为紧凑化选项，不作为组件映射。 |
| **figma-map** | **架构适配 (`CLI_ADAPTER`)** | **采纳**：采纳其 Component Binding 模式与 `data-figma-node` DOM 对齐理念。<br>**淘汰**：彻底淘汰其 Go CLI、Bun Backend 及自动向项目注册 MCP 的 `init` 逻辑，改由纯 TypeScript 实现薄适配器。 |
| **react-figma** | **主线淘汰 (`REJECTED`)** | **淘汰**：Node `<22.0.0` 引擎限制；底层绑定 React 16 Reconciler 与业务 React 18 严重冲突；基于 Yoga 绝对坐标运算无法产出符合总控要求的原生 Auto Layout。 |
| **figma-api** | **主线淘汰 (`REJECTED`)** | **淘汰**：内置高危 `eval` 指令，存在跨频道无差别广播泄露，无认证鉴权，且依赖 Bun 运行环境。阶段 5 若需要本地写入桥接，必须全新实现受限的安全本地网关。 |
| **Tokens Studio** | **数据格式标准 (`SPEC_ONLY`)** | **采纳**：完全支持其导出的 W3C DTCG Token JSON 标准格式。<br>**淘汰**：拒绝引入其拥有数百依赖的庞大插件前端应用、云同步及私有服务代码。 |
| **style-dictionary** | **官方公开依赖 (`DEPENDENCY`)** | **采纳**：固定使用官方公开 npm 包 `style-dictionary@^5.5.5`。<br>**优势**：完美适配 Node 22，零内核修改，仅通过扩展自定义 Format 生成 Ant Design 5 主题与 CSS 变量。 |
| **FigmaToCode** | **独立对照参考 (`REJECTED`)** | **淘汰**：GPL-3.0 强传染性许可证，严禁复制代码、模板与 fixtures 进核心包；其生成的无语义纯 HTML/Tailwind 不支持已有组件库复用。 |
| **playwright** | **官方测试依赖 (`DEPENDENCY`)** | **采纳**：固定使用官方公开 npm 包 `@playwright/test@^1.63.0`，用于双层设计一致性与交互状态回归验证。 |

---

## 4. 关键设计原则与后果 (Consequences)

### 긍正向收益 (Positive)
1. **零 MCP 纯净环境**：全链路无需启动任何 MCP 服务，通过本地文件交换与受控脚本运作，杜绝环境污染。
2. **环境零阻断**：避开缺失的 `go` 和 `bun` 依赖，完全在已有 Node 22 + TypeScript 环境下自闭环。
3. **法律与安全无忧**：杜绝 GPL-3.0 侵染与 `figma-api` 任意代码执行漏洞。
4. **组件真复用**：直面 Ant Design 5 业务现实，通过经过人工审核的 Component Registry 进行精准映射，避免臆造伪组件。

### 부负向代价与缓解 (Trade-offs & Mitigations)
1. **需自研薄 CLI 适配层**：因舍弃 `figma-map` 的 Go CLI，需在 `tooling/d2c/` 下用 TypeScript 编写等价的组件扫描与 binding 逻辑（工作量在阶段 2/3 中受控交付）。
2. **Figma 原生写入初期需依赖文件/插件手动导入**：在阶段 5 安全网关完成前，原生设计创建优先通过经审核的插件本地导入，不追求未经安全加固的实时双向热同步。
