# 阶段 1：八仓库源码审查与最小复用决策

先阅读 00-master.md。本阶段实际读取和检查源码，不能只转述 README。
允许在授权研究目录拉取源码、执行已审核的最小兼容性检查，
不修改业务页面，不注册 MCP，不自动运行上游初始化脚本。

## 输入仓库

https://github.com/arifinbardansyah/design-to-code-json
https://github.com/KirillBaranov/figma-map
https://github.com/react-figma/react-figma
https://github.com/todoforai/figma-api
https://github.com/tokens-studio/figma-plugin
https://github.com/style-dictionary/style-dictionary
https://github.com/bernaferrari/FigmaToCode
https://github.com/microsoft/playwright

## A. 工作区基线

发现 OS、shell、架构、可用 Node/包管理器，以及确有需要时的 Go/Bun。
检查 package.json、lockfile、tsconfig、路由、组件目录、Token、
Storybook、已有测试和工程规则。
检查 git status，不改动用户未提交内容。
只读取配置结构和环境变量名称，不读取/输出密钥值。
运行已存在且获准的 typecheck/lint/test，记录原始失败，避免归咎于本次变更。
区分研究工作区和目标业务仓库；路径不明确时先用可发现上下文判断。

## B. 固定版本与证据

为每个项目记录：
repo、检查日期、选定 tag/完整 commit SHA、分支、LICENSE，
包级/文件级许可证差异、NOTICE、关键依赖和安装脚本。
结合 release、源码和测试选择版本，不使用“永远跟随 latest”。
提取测试命令必须来自实际 package scripts/Makefile/文档，不臆造。

每个候选功能给出以下字段：
upstream file + symbol + permalink at SHA；
输入/输出；
运行环境与传递依赖；
Figma/浏览器/模型/网络依赖；
现有测试及尚未验证边界；
复用方式（DEPENDENCY / CLI_ADAPTER / VENDORED_MODULE / OPTIONAL_EVAL / REJECTED）；
本地目标模块；
许可证处理；
预计需要改动的接口和维护风险。
没有验证到的符号和能力写 NOT_FOUND/UNVERIFIED。

## C. 逐项目审查重点

1. design-to-code-json
   从实际 src/code.ts、src/transform.ts 和测试入手。
   定位节点遍历、颜色/变量转换、alias 解析、组件去重、Variants 导出。
   检查删除 nodeId、折叠默认值、解析 alias 后丢失引用链、
   同名组件/变量碰撞、跨 collection mode 映射和不同 Variants 模式的信息损失。
   保留原始采集与简化视图，不能把有损 JSON 直接当唯一契约。

2. figma-map
   审查 CLI/后台/插件边界、Storybook 扫描、binding、组件解析、
   实现计划、样式检查和截图 diff。
   核实不用 MCP 的实际调用路径，以及 init/update 的配置和下载副作用。
   核实 Go CLI、TS/Bun 后端等实际运行时；不要假定它是单一 npm 库。
   审查 boolean props、相对 import、几何匹配的低置信度、
   未测量节点和未覆盖样式；不直接信任 AI binding。

3. react-figma
   检查 package engines、reconciler、React、Yoga 和 Plugin typings 版本。
   在隔离实验中验证节点创建与更新、原生 Auto Layout、变量绑定和库实例复用。
   Yoga 算出的坐标不自动算原生 Auto Layout。
   不降级业务项目；不把不受支持的旧运行时设为生产默认。
   若不合适，记录具体失败证据，只保留确有价值且可维护的复用部分。

4. figma-api
   检查 REST 读取、插件命令处理、src/bridge.ts 的消息路由与重试。
   特别检查跨频道转发、鉴权、监听地址、目标文件/节点隔离、
   请求关联、写操作重放、任意执行和大消息处理。
   不把日志中的 localhost 文案当作实际只绑定 loopback 的证明。

5. Tokens Studio
   定位 Token 解析、alias/主题/集合处理、节点绑定和同步边界。
   区分“原插件作为编辑器+格式适配”与“小函数抽取”的成本。
   不把完整插件 UI、账户系统、云同步和付费服务绑进第一版。
   必要时保留标准 Token JSON，避免无法解释的有损转换。

6. Style Dictionary
   优先固定版本使用公开构建/transform/format 接口。
   检查实际版本的 Node/ESM 要求和 Token 格式，不照搬旧 README API。
   评估 CSS、Tailwind 和 AntD 的项目适配，不 fork 构建内核。

7. FigmaToCode
   审查实际 packages/backend 中的 IR、布局转换、生成器、警告与测试。
   先作为独立对照实现记录行为；未经许可适配审查不复制源码、模板或 fixtures。
   不因审查了 GPL 源码就声称后续改写是 clean-room。
   明确独立运行、分发、嵌入输出模板等模式需要分别评估。

8. Playwright
   使用固定版本公开测试 API，复用项目已有配置，避免复制浏览器自动化内核。
   核查浏览器版本、安装条件、截图基准和 CI 环境差异。

## D. 本阶段交付

docs/d2c/environment-baseline.md
docs/d2c/upstream-audit.md
docs/d2c/extraction-matrix.md
docs/d2c/risk-register.md
docs/d2c/adr/0001-integration-boundaries.md
upstreams.lock.json

提出一个默认组合和清楚的淘汰原因。
必须全部覆盖八个仓库，但可以明确判定某项目只做对照或暂不引入。
不要为了“八个都用了”引入重复 exporter、writer、bridge 或 token source。

结束时输出：关键事实、具体源码证据、试验结果、
依赖/许可证阻断项和阶段 2 的最小任务清单。
