# 阶段 4：补齐 PRD/视觉参考 → 原生 Figma

阅读总控和阶段 1–3 输出。
沿用已经验证的契约、Token、Registry 和导出链路，
不要创建第二套设计包格式或另一套组件命名体系。

## A. 产品与视觉输入

读取真实 PRD，区分已知事实、假设和待确认决策。
输出页面/状态/行为契约和 Design Brief。
没有已确认视觉方向时，准备方案并在视觉 Gate 停止，
但可以继续实现不依赖最终视觉的 schema/编译器测试。
有已批准 GPT Image 图片则将其作为视觉参考；
没有图像生成接口时接受人工提供图片，不虚构调用或生成结果。
把确认记录及内容哈希写入输入元数据。

## B. 声明式 Blueprint

将页面、区域、布局、组件意图、Token 引用、业务 ID 和状态写入 Blueprint。
图片不携带的信息来自 PRD、组件契约和明确决策，不靠猜图补全。
所有原生 API 操作经 schema/能力检查后生成执行计划，
不执行模型给出的任意 JavaScript 或 eval。

## C. 选择唯一 writer

根据阶段 1 兼容性实验决定：
- 用 react-figma 的可维护部分加适配；
- 或以审查过的 figma-api 插件处理单元/官方 Plugin API 构建受控 writer。

不能为了必须用上 react-figma 而降级业务 React/Node。
不能因为使用 Yoga/flex 风格就宣称产物具有原生 Auto Layout。
保留被排除路线的实际证据，必要时只用作对照实验。
不要让两个 writer 同时拥有同一批节点。

首批支持受限节点/组件，明确 unsupported 列表：
Frame、Text、已注册组件 Instance、Auto Layout、变量/样式绑定。
API 支持与字段类型以当前 typings/官方文档/真实实验为依据，
不是要求写到哪里就假装支持到哪里。

创建前检查权限、组件 key、字体、variable collection/mode 和 props。
修改 Text 前使用合法字体加载路径并处理 mixed fonts。
优先使用已有组件；禁止 detach Instance 后冒充复用。
缺失组件进入报告/受控草稿区，禁止自动发布竞争性 Library。

## D. 幂等和人工修改保护

节点记录稳定业务身份和 managed ownership。
默认只操作明确批准的目标范围。
首次运行创建；相同 Blueprint 重跑不新增重复页面/节点。
再次运行按业务身份和基线内容比较，不整页删除重建。
用户修改和 Blueprint 同时修改同一字段时输出 CONFLICT。
无法安全恢复的 API 变更先不支持，不能承诺通用事务回滚。

先展示新增/更新/冲突计划，再经授权写入。
执行日志包含 operationId、目标、前置条件、结果和重读验证。
不要依赖一个可编辑的 pluginData 字段作为完整权限认证。

## E. 验收

真实导入后重新使用阶段 3 exporter 读取：
检查原生 layoutMode、padding/gap、组件 Instance 身份、
variant、variable binding、文案与 semantic identity。
不仅看截图，更不能只看本地 mock 的 figma stub。

完成：
同输入重跑无重复；
单字段修改只影响预期节点；
人工修改不被静默覆盖；
missing font/component 明确失败；
写入后的新 Design Package 经过重新审核；
用该包更新真实页面并重跑浏览器测试。

真实 Figma 交互未执行时保持 LIVE_WRITE=BLOCKED。
