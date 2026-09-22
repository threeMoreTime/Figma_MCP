# 阶段 6：复现验证、故障注入与可维护交付

阅读总控、全部阶段报告与 upstreams.lock.json。
本阶段修补闭环，不增加新平台、新数据库或无关后台。
检查所有此前声称 PASS 的项目是否有真实证据。

## A. 对外命令

使用本仓库现有包管理器，提供命名一致的命令。
以下名称只是建议；只有真正实现后才可写进 README：
d2c:doctor
d2c:validate
d2c:tokens
d2c:resolve
d2c:plan
d2c:diff
d2c:verify
d2c:ci
d2c:bridge（仅在桥接已实现时）

帮助信息、输入 schema、输出 schema 和退出码需明确。
本地文件模式、fixture 模式和 live Figma 模式分开；
缺少 live 前置条件返回 BLOCKED/非成功状态，不能伪装为空结果。
环境变量模板只含键名和示例占位符。

## B. CI Guardrails

在既有检查上补充：
组件 import/重复 primitive 检查；
Token 硬编码和不允许任意值检查；
Registry import/typed props 检查；
schema/资源哈希/来源/审批新鲜度检查；
许可证清单与构建依赖审查；
指定流程未引入 Figma MCP 的运行路径检查。

尽量使用 AST/类型信息，例外通过明确审核的 allowlist；
不能只用 grep 字符串造成大量误报。
依赖含 MCP 相关可选文件不自动失败；实际启用/调用则失败。
不能自动删除用户已有无关 MCP 配置。

## C. 故障注入和验收

故意注入并证明能检测：
boolean 变成字符串、组件 import 错误、重复基础组件、
硬编码颜色、丢失变量绑定、错误 variant、缺失资源、
重复业务 ID、过期审批、stale design package、
snapshot 差异以及桥接跨会话访问。

真实闭环验收至少包含：
1. Figma 当前变更进入新设计包和真实页面。
2. 核心布局确为原生 Auto Layout，复用组件确为 Instance。
3. 已注册核心 React 组件真实复用，没有新增重复 primitive。
4. loading/ready/empty/error 与关键交互全部验证。
5. 同 Blueprint 重跑不产生重复受管节点。
6. 设计/代码同字段双改得到冲突，不被静默覆盖。
7. 文件通道独立可用，桥接关闭不阻断已交付设计的实现。
8. 命令、版本、输入、日志与截图可追踪。
9. 两次相同输入的确定性转换一致；AI 候选结果需保存审核，不宣称确定性。

组件复用率如要统计，必须说明分子、分母、豁免和真实样本；
synthetic fixture 不计入真实仓库指标。
视觉指标说明环境、遮罩、未测量区域和阈值来源；
不得自动放宽阈值或更新 baseline 以掩盖失败。

## D. 复现与交付

在授权的独立目录验证固定版本、lockfile 的干净安装与测试，
不能通过清空用户仓库来制造“干净环境”。
审查安装脚本和需要联网的步骤，明确前置条件。
运行上游适配契约测试，记录升级一个上游时的回归检查步骤。

交付：
README、最小操作手册、故障排查、
架构决策、依赖/许可/SBOM 清单、上游补丁出处、
升级/回退说明、真实验收证据、
安全配置、示例设计包和阶段 STATUS。

分别给出：
UNIT_VERIFIED；
LIVE_READ_VERIFIED；
LIVE_WRITE_VERIFIED；
CLOSED_LOOP_VERIFIED。
每项记录 PASS/FAIL/BLOCKED/NOT_RUN，不用一个模糊“完成”覆盖全部。

不自动 push、merge、publish 或改变用户生产系统。
结束时明确：已验证能力、未验证能力、阻断项，以及需要用户完成的最少操作。
