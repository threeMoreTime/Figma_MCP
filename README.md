# Antigravity：无 Figma MCP 的开源 Design-to-Code 集成提示词包

核查日期：2026-09-21。

## 这个包是什么

这是一组用于你本地 Antigravity 的执行提示词，不是已经实现的集成软件，
也不是安装脚本。它要求 Agent 在真实工作区审查、选择、实现和验证。
本次已在线核查八个项目的公开说明及部分源码/配置，尚未在你的设备运行它们。
本包不附带上游源码，不提供任何未经验证的上游 commit SHA。
本地阶段 1 必须固定实际使用的 SHA。

依据原研究报告的主轴：
PRD → UI Blueprint → Figma Design System → Component Mapping → Production Repository。
在本方案中，Figma MCP 被文件交换、Plugin API 和可选普通本地桥接替代。
图像生成服务仍是可替换的视觉输入；不把“无 MCP”误写成“整个链路完全离线”。

## 怎么使用

在目标业务仓库对应的 Antigravity 工作区中解压整个目录，
保持目录名 `antigravity-d2c-prompts`。
第一次发送下面的启动提示词：

```text
阅读 antigravity-d2c-prompts/README.md、
antigravity-d2c-prompts/00-master.md 和
antigravity-d2c-prompts/01-audit.md。

保持本任务不依赖 Figma MCP，按总控约束执行阶段 1。
实际审查全部八个仓库并写入审计产物，
不要只输出计划，不要安装所有完整产品，也不要修改业务页面。

先发现当前工作区、真实项目结构和权限；
对不能访问或不能验证的项目明确标记，完成其余可执行检查。
```

阶段 1 结束后检查证据，再依次发送：

```text
继续执行阶段 2：
阅读 00-master.md 和 02-contracts-tokens-registry.md，
遵循已经记录的源码审查结果，实际实现和测试。
```

后续同理替换阶段文件。不要一次把全部阶段都要求“自动完成”：
视觉选择、真实 Figma 操作授权、绑定/设计审核和最终合并仍保留人工 Gate。
无需把整个目录一次塞进模型上下文；每阶段读取总控、当前任务与相关状态即可。

若目录不在工作区根目录，使用真实相对路径。
没有真实业务项目时只能验证 fixture-app，不能算生产仓库闭环成立。

## 文件顺序

| 文件 | 用途 |
| --- | --- |
| 00-master.md | 总目标、边界、证据标准和开源/权限约束 |
| 01-audit.md | 八仓库审查、固定 SHA、复用矩阵与环境基线 |
| 02-contracts-tokens-registry.md | 统一契约、Token 构建、真实组件注册表 |
| 03-export-to-real-code.md | 真实 Figma 导出 → 真实 React 页面 → 浏览器验证 |
| 04-blueprint-to-figma.md | PRD/视觉参考 → Blueprint → 原生可编辑设计 |
| 05-bridge-and-reconciliation.md | 可选本地桥接、安全加固、受控回写和冲突检测 |
| 06-hardening-and-delivery.md | 故障注入、复现、CI、文档和完整验收 |
| 07-resume.md | 中断恢复，避免重复研究、重新下载和重写 |
| upstream-notes.md | 本次在线核查发现及原始来源 |
| full-prompt-pack.md | 全部提示词合并版，便于检索与归档 |

## 预期采用方式，而非强制结论

- design-to-code-json：导出/转换候选，小范围扩展来源与身份信息。
- figma-map：组件目录、绑定、计划与验证候选；优先薄 CLI 适配。
- react-figma：隔离兼容性与原生布局实验；不强制进入主线。
- figma-api：命令/插件写入和桥接候选；必须补安全与幂等。
- Tokens Studio：可保留完整编辑插件，但主线只依赖经过审核的 Token 数据。
- Style Dictionary：固定版本公开构建依赖，不 fork 内核。
- FigmaToCode：独立对照评估；许可证审查前不抽 GPL 源码进入核心包。
- Playwright：固定版本公开测试依赖，区分设计验证与截图回归。

八个都要审查，不等于八个都要进入运行时。
任何“已抽取”必须有文件/符号/commit/目标路径/测试证据。
不能为完成表格而虚构抽取或把仅阅读代码写成已经集成。

## Antigravity 配置说明

当前官方文档采用 `.agents/rules`，并保留 `.agent/rules` 兼容；
Rules 单文件有长度限制。具体行为应以本机版本和官方文档为准。[S1]
本包是普通 Markdown 提示词，不会自动激活成 IDE Rules，也不会安装任何 Skill/MCP。
长期规则可由本地 Agent 根据已确认版本拆入 Workspace Rules，并在界面核实生效；
不要覆盖全局配置或单靠“写了文件”就宣称已经加载。

当前 IDE Workflows 文档公告了向 Skills 的迁移计划，日期为 2026-11-01。[S2]
本包先用普通文件执行，将实际可靠性放在契约、版本、命令与测试上，
不依赖某个 IDE 专属 slash command。

## 什么时候算通过

只有 synthetic fixture 测试通过：UNIT_VERIFIED，尚未验证真实 Figma。
真实读取与导出通过：LIVE_READ_VERIFIED。
真实原生写入和重读通过：LIVE_WRITE_VERIFIED。
真实设计审核、真实组件实现、浏览器验证、变更与冲突演练均有证据：
CLOSED_LOOP_VERIFIED。

仍需观察后续项目使用和上游升级表现，不能把单页验收称为所有场景的稳定保证。
