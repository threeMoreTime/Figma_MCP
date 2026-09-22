# 阶段 3：打通真实 Figma → 设计包 → 真实 React 页面

阅读总控、阶段 1/2 输出。
本阶段只验证一个页面，不先做自然语言生成 Figma，也不引入实时桥接。
使用已审查的 design-to-code-json 复用单元和统一契约；
实际需要时接入 figma-map 的已审核组件目录/验证能力。

## A. Figma 导出插件

让用户在授权文件中选择一个明确的页面 Frame。
插件导出当前选区的实际内容，不拿旧 Blueprint 代替设计。
保留 Figma 原始证据，可使用经当前 Plugin API 验证的 JSON_REST_V1 导出；
在有损转换和去重之前采集 nodeId、组件身份、变量引用和来源映射。
PNG/SVG 导出与结构 JSON 分工，图片不能替代组件/交互语义。

基于现有 exporter 实现或适配：
真实组件实例与 synthesized frame 的区分；
当前 variant 的实际结构/样式/属性和 override；
原始 alias 图、resolved values、实际 collection/mode；
mixed text、图标/图片资源及 unresolved diagnostics。
不能仅依赖默认 Variants Off；需要检测轴间组合和实例覆盖，
不能假设逐轴差值一定能还原所有组合。

导出截图、资产及资源哈希。
字体仅记录依赖、可用性和许可要求，不未经许可打包分发字体。
无权限/缺失资产时产生明确错误；不猜测设计内容。
只读取所选范围及其必要依赖，避免全文件无界遍历。

## B. 设计包

生成并验证类似以下结构，允许遵循现有仓库命名：
design/releases/<screen>/<revision>/
  manifest.json
  figma.raw.json
  context.json
  source-map.json
  tokens.snapshot.json
  components.used.json
  interactions.json
  screenshots/
  assets/

manifest 记录 sourceFileRef、rootNodeId、工具 SHA、输入版本和内容哈希。
交互来自明确的 InteractionContract；Figma 未声明的行为不通过看图猜测。
审批与当前内容哈希绑定；缺少审批时不得标为正式设计交付。

## C. 真实项目实现

先验证 Registry 中 import、props 和 examples，
输出组件解析报告，再实施用户管理页。
优先内部 Button、Table、Form、Modal 等封装。
不要将普通导出 JSX 整页复制进业务仓库。
静态布局、语义 Token、组件 API 和业务事件分别处理。

优先在既有运行时提供 /prototype/users 或项目一致的预览入口。
实现 ready/loading/empty/error、筛选、新建弹窗、表单校验、提交成功/失败。
遵循现有路由、状态、请求、权限、可访问性模式。
Mock 和状态选择入口限定为测试/开发，不引入生产后门。
没有真实仓库时仅做明确标注的 fixture-app，真实复用验收保持 BLOCKED。

## D. 两层浏览器验证

1. 设计一致性：
   在相同视口、内容、状态下对照真实 Figma 截图与浏览器渲染；
   输出 overlay/diff、组件映射、关键布局/Token 差异。
   Figma 与浏览器字体栅格不同，不追求未经定义的“逐像素零差异”。
   没有对应 DOM 的节点写 unmeasured，不能视为通过。
   DOM 身份标记用稳定业务 ID，并关联 source-map，不只靠几何猜测。

2. 代码回归：
   人工完成设计一致性审核后建立浏览器 screenshot baseline，
   之后用 Playwright 截图断言和行为测试检测回归。
   固定浏览器、字体环境、locale/timezone、数据、动画策略及视口。
   新截图生成不等于设计审核通过；不自动 update-snapshots 消除失败。

## E. 必须有的反向测试

在 Figma 中修改一处文案/间距/组件 variant，重新导出。
验证差异指向正确元素，旧审批失效，Agent 使用新包更新实现。
验证旧 Blueprint 不覆盖设计师当前修改。
在实现中制造一处错误组件或硬编码颜色，验证 guard/测试能失败。

如没有真实 Figma、用户未运行插件或缺少页面授权：
完成插件构建与 fixture 测试；
把 live export、live screenshot 和真实闭环标为 BLOCKED，
给出所需人工操作，不制作模拟“成功证据”。

交付插件构建、真实/模拟来源分类、设计包、代码 diff、
测试日志、浏览器截图、差异报告和阶段状态。
