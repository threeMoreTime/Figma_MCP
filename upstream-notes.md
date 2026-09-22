# 在线核查摘要与来源

核查日期：2026-09-21。以下为公开仓库/官方资料支持的事实；
推荐的集成结构、契约和验收规则属于本提示词包的工程设计，不是上游已有统一产品。
动态 main 分支只用于本轮研究；实际抽取必须由阶段 1 固定 commit SHA。

## 关键事实

**design-to-code-json**：README 明确其输出会移除 node ID；
默认 Variants Off 不记录变体的完整结构/样式差异。
变量目录会把 alias 解析为值，适合给 AI 的紧凑视图，
不能据此认定完整来源与 alias 图得到保留。
`src/transform.ts` 是与 Figma API 分离的转换代码候选。
参见 S3、S4。

**figma-map**：公开 CLI 覆盖设计读取、组件目录、绑定、实现计划和验证。
`init` 会写 MCP 注册；本流程必须选择非 MCP 运行路径。
项目公开限制包括绑定草稿、布尔属性字符串化、部分 import 和验证覆盖边界。
参见 S5、S6、S7。

**react-figma**：基于 Plugin API 的 React 渲染器，使用 Yoga。
本轮读取的 package.json 声明 Node `>=10.0.0 <22.0.0`，
并依赖 `react-reconciler ^0.23.0`。
这些事实说明需要兼容性实验，不足以证明支持当前业务项目或满足原生 Auto Layout 要求。
参见 S8、S9。

**figma-api**：公开 `src/bridge.ts` 将命令转发给其他已连接 peer，
注释也说明这是跨频道转发；不能把 channel 当作权限隔离。
参见 S10、S11。文件中的 localhost 日志不等于监听地址已被强制限制。

**Tokens Studio**：开源插件可管理 JSON Tokens 和同步。
发布版 Pro 文档对主题管理、部分同步工作流等区分许可能力；
源码许可证和托管服务/发布产品权限需分别核查。
参见 S12、S13。

**Style Dictionary**：提供 Token 构建及扩展接口；
Tailwind/AntD 的具体映射应按本地版本与项目约定实现。
参见 S14、S15。

**FigmaToCode**：README 定位为可编辑视觉脚手架；
生成器不读取真实业务仓库，不应代替项目组件解析。
仓库公开许可证为 GPL-3.0。
许可证审查需区分运行程序、复制/改编源码、分发方式，
以及生成输出是否含受保护模板/运行时代码。
进程隔离或改名本身不是通用许可豁免结论。
参见 S16、S17、S18。

**Playwright**：截图比较依赖基准，运行环境影响渲染。
首次生成基准不等于设计审核完成，需将设计对照与浏览器回归分开。
参见 S19、S20。

**Figma Plugin API**：官方接口支持节点导出，`JSON_REST_V1` 返回对象，
PNG 等图像格式返回字节；实际使用需按运行版本验证。
社区插件审核还对与原生 AI 能力重叠、官方 MCP 之外的程序化 AI 访问提出限制。
这属于发布审核边界，不能从本地实验成功推断公共发布必获批准。
参见 S21、S22。

## 来源

以下地址为研究入口，不是自动下载执行脚本：

```text
[S1] https://antigravity.google/docs/rules-workflows?tab=ide
[S2] https://antigravity.google/docs/ide/workflows
[S3] https://github.com/arifinbardansyah/design-to-code-json
[S4] https://raw.githubusercontent.com/arifinbardansyah/design-to-code-json/main/src/transform.ts
[S5] https://github.com/KirillBaranov/figma-map
[S6] https://raw.githubusercontent.com/KirillBaranov/figma-map/main/docs/commands.md
[S7] https://raw.githubusercontent.com/KirillBaranov/figma-map/main/docs/limitations.md
[S8] https://github.com/react-figma/react-figma
[S9] https://raw.githubusercontent.com/react-figma/react-figma/master/package.json
[S10] https://github.com/todoforai/figma-api
[S11] https://raw.githubusercontent.com/todoforai/figma-api/main/src/bridge.ts
[S12] https://github.com/tokens-studio/figma-plugin
[S13] https://docs.tokens.studio/get-started/pro-licence
[S14] https://github.com/style-dictionary/style-dictionary
[S15] https://styledictionary.com/reference/hooks/transforms/
[S16] https://github.com/bernaferrari/FigmaToCode
[S17] https://raw.githubusercontent.com/bernaferrari/FigmaToCode/main/LICENSE
[S18] https://www.gnu.org/licenses/gpl-faq.html
[S19] https://github.com/microsoft/playwright
[S20] https://playwright.dev/docs/test-snapshots
[S21] https://developers.figma.com/docs/plugins/api/properties/nodes-exportasync/
[S22] https://help.figma.com/hc/en-us/articles/360039958914-Plugin-and-widget-review-guidelines
```

## 许可与平台审查的使用边界

本包中的措施是工程风险控制，不是针对你的分发方式出具的法律意见。
若组合产物要闭源分发、商业发布或向团队外提供服务，
应让有资质的人员按具体源码、模板、依赖与部署方式审核。
不要因为仓库写着 MIT 就假定所有素材、子模块和远程服务都采用相同授权。
