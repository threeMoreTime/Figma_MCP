# 阶段 2：建立统一契约、Token 构建和真实组件注册表

阅读总控、阶段 1 报告和 upstreams.lock.json。
采用审查通过的最小组合，实际实现契约校验、适配边界及测试。
如果仍有许可证/授权阻断，只跳过受影响复用单元，不擅自绕过限制。

## A. 契约

至少定义并版本化：
UIBlueprint、DesignContext、DesignPackageManifest、
ComponentRegistry、InteractionContract、DesignPatch。
采用项目适合的 JSON Schema 或等价运行时校验；
TypeScript 类型与校验不能长期分叉。给出有效和无效样例。

DesignContext 至少覆盖：
- sourceFileRef、source nodeId、导出工具/版本、真实/模拟数据来源；
- screenId/state/breakpoint/semanticId/instanceKey；
- native component key/id、实际 variant/props、instance override；
- native component 与 synthesized grouping 的区别；
- 原生布局、尺寸、HUG/FILL/FIXED、padding/gap、文本和 mixed runs；
- Token 引用、原始 alias 图、collection/mode、解析值及解析依据；
- 资源引用与哈希、截图规格、支持/缺失字段、诊断。
不支持的内容写入 diagnostics，严重缺失使验收失败，不静默降级。

身份规则：
componentId 描述组件类型，不是页面元素的唯一 ID。
业务定位使用 screenId/state/breakpoint/semanticId/instanceKey 等组合；
nodeId 保留为当前文件的来源定位，不充当永久跨文件身份。
复制节点导致身份重复时检测冲突，不擅自覆盖另一个节点。
相同名称但不同来源组件/变量不能被错误合并。

DesignPackageManifest 关联：
Blueprint、Registry、Canonical Tokens、源码/工具版本、
资源与截图哈希、数据来源、审批状态和输入内容哈希。
定义确定性序列化与内容哈希范围；
排除 exportedAt/runId 等易变字段和哈希字段自身，避免循环依赖。
设计包不可变，修改后创建新版本并使旧审批失效。

## B. Token 构建

优先使用仓库已有 Canonical Token 源；没有时建立一个。
为 Tokens Studio 数据建立显式导入适配，
为 Style Dictionary 建立符合固定版本 API 的构建配置。
保留语义 alias，而不是只剩十六进制颜色。

输出适配实际项目的 CSS variables、Tailwind 配置/主题文件及 AntD theme。
检测 Tailwind、AntD 主版本和组件封装，不强制迁移。
不能假设每个 AntD Token 都接受任意 CSS 字符串。
复合 typography/shadow/border、单位、模式、alias 循环和缺失引用必须测试。
不同 Figma collections 的 mode 对应关系必须明确，不能仅按名称猜测。
Figma 变量变更先产生 Token proposal，不自动覆盖 Git 全局主题。

相同输入重复构建输出一致。
自定义项目转换是 adapter，不修改 Style Dictionary 内核。

## C. Component Registry

扫描真实源码、类型声明和已有 Storybook；没有 Storybook 时不强制新建完整站点。
按阶段 1 结果复用 figma-map 的目录/绑定能力或对应适配器。
视觉/名称匹配只能给候选，审核后的注册表才是实现输入。

每条记录至少包含：
designComponentId/figma key；
真实 module path、export name、代码版本/类型证据；
typed props/variants、children/slots、事件与 instance swap；
默认值、可支持状态、示例来源、审核状态和已知约束。

输出 REUSE / EXTEND / MISSING / CONFLICT 报告。
编译类型检查示例；false 必须保持 boolean，不能变成字符串 "false"。
不通过执行不受信任的源码来扫描组件。

## D. 测试与输出

建立 synthetic fixtures 并清楚标记来源。
覆盖重复名、重复业务 ID、混合文本、变体组合、布尔属性、
错误 import、缺失 Token、alias 循环、未知 schemaVersion、
哈希稳定性以及旧审批失效。

将上游抽取代码的来源、依赖与许可记录在 third_party/ 和复用清单中。
源码未抽取时不要伪造一条“已抽取函数”。

提供并运行适合本仓库的脚本，例如：
d2c:validate、d2c:tokens、d2c:resolve。
这些是本项目新建命令，不是上游现成 CLI；
只有实现并通过 --help/实际测试后才能写为可用。

交付契约、适配器、Token 构建、Registry、测试、命令说明和阶段报告。
本阶段不需要 Figma 在线，也不得据此宣称真实 Figma 已验证。
