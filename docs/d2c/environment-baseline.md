# 环境基线与工作区发现报告 (Environment Baseline)

核查日期：2026-09-21
核查负责人：Antigravity Agent (技术负责人 / 架构师)

---

## 1. 运行宿主与基础工具链

| 检查项 | 真实环境检测值 | 状态 | 评估与影响 |
| :--- | :--- | :--- | :--- |
| **操作系统 (OS)** | Windows 10 Pro (Build 19045.0), AMD64 (x64) | PASS | 支持标准 Node、Git、PowerShell 工具链，路径需适配 Windows 反斜杠/正斜杠 |
| **Shell 环境** | PowerShell Core (`pwsh.exe`) 7.x / 5.1 | PASS | 默认执行 shell 为 pwsh，需注意编码 (`UTF-8`) 与变量转义 |
| **Node.js** | `v22.22.2` (`C:\Program Files\nodejs\node.exe`) | PASS | 现代 LTS+ 运行环境；完全满足 Style Dictionary v5 (要求 `>=22.0.0`)，但与 react-figma (`<22.0.0`) 冲突 |
| **npm** | `10.9.7` | PASS | 可用于依赖安装与脚本执行 |
| **pnpm** | `10.33.0` | PASS | 主包管理器之一，可用 |
| **yarn** | `1.22.22` | PASS | 经典 Yarn 1.x 可用 |
| **Git** | `2.49.0.windows.1` (`C:\Program Files\Git\cmd\git.exe`) | PASS | 完整可用，支持 shallow clone、ls-remote 与分支管理 |
| **Python** | `3.12` (`C:\Users\Administrator\AppData\Local\Programs\Python\Python312\python.exe`) | PASS | 辅组工具支持 |
| **Go** | `NOT FOUND` (未安装 / 不在 PATH) | BLOCKED / NOT_FOUND | 上游 `figma-map` 的 Go CLI 源码无法直接在宿主上进行 `go build`，必须采用预编译二进制或 TypeScript 适配层 |
| **Bun** | `NOT FOUND` (未安装 / 不在 PATH) | BLOCKED / NOT_FOUND | 上游 `figma-api` 的 `Bun.serve` 和 `figma-map/backend` 依赖 Bun 构建无法原生直接运行，需 Node.js 运行时替代 |

---

## 2. 工作区与项目上下文

### 2.1 当前提示词与产物工作区
- **路径**：`C:\Users\Administrator\Desktop\Antigravity_No_Figma_MCP_Prompts`
- **Git 状态**：初始为非独立 Git 仓库（普通文件夹，无 `.git` 历史污染）。
- **定位**：集成契约、适配器、测试脚手架与审计文档主工作目录。

### 2.2 发现的目标业务仓库
- **路径**：`C:\Users\Administrator\Desktop\workspace\cs_admin-client`
- **技术栈特征**：
  - React 18
  - TypeScript
  - Ant Design (`antd: 5.7.3`)
  - `@ant-design/pro-components: 2.8.10`
  - 样式：Less / CSS modules
  - 图标与业务包：`bi-client-icons`, `@monorepo/ui`, `@monorepo/network`, `@monorepo/router`
- **Git 分支与工作区保护检查**：
  - 分支：`dev` (与 `origin/dev` 对齐)
  - 工作区状态：**存在用户未提交的暂存文件及未跟踪文件**（包含 `.env.production` 修改、客服满意度标签与翻译相关组件开发中文件、`.playwright-mcp/` 等未跟踪目录）。
  - **总控硬约束遵从**：**严禁在阶段 1 对目标业务页面执行任何修改、reset、clean 或覆盖**。所有阶段 1 交付物严格限制在 `docs/d2c/` 与项目自身的 tooling 目录中。

---

## 3. MCP 与权限基线

| 检查项 | 状态 | 详细说明 |
| :--- | :--- | :--- |
| **Figma MCP Server** | **NONE (遵从约束)** | 当前环境未启动、未安装、未注册任何 Figma MCP Server；全链路严格遵循“非 MCP”约束。 |
| **本地文件与网络访问** | PASS | 允许本地文件交换；Git 可正常访问 GitHub 公开仓库；本地 loopback 端口具备绑定权限。 |
| **Figma Live 权限** | PENDING (需人工 Gate) | 当前尚未启动真实 Figma 插件会话；阶段 1 以源码静态审查与环境验证为主。 |

---

## 4. 环境基线结论

1. **Node 22 的重大优势与约束**：
   - 完美适配 `style-dictionary@5.5.5`（其 `engines.node` 显式要求 `>=22.0.0`）。
   - 彻底阻断 `react-figma`（其 `engines.node` 显式限制 `<22.0.0`，且其底层依赖 React 16 的 `react-reconciler@0.23.0`，与业务目标 React 18 彻底冲突）。
2. **缺失 Go 和 Bun 的架构解耦**：
   - `figma-map` 的 Go CLI 和 `figma-api` 的 Bun 运行时不得作为本系统的硬前置依赖。
   - 必须通过符合统一契约的 TypeScript 薄适配器（在 Node.js 环境下运行）实现同等能力。
3. **真实业务仓库映射依据**：
   - 业务仓库组件生态为 **Ant Design 5.7.3 + Pro Components**，后续阶段的 Canonical Tokens 和 Component Registry 必须精准适配 Ant Design 5 的 Token 体系 (`theme.useToken()`, `ConfigProvider`)，而非强行引入 Tailwind 迁移。
