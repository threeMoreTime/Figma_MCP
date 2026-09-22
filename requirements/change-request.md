# 需求变更申请 (Change Request): 企业用户批量导入功能

**申请编号**: CR-2026-USER-IMPORT  
**关联基线 PRD**: `examples/prd/users-management.md`  
**目标页面**: `users.management` (路由: `/users`)  
**提交日期**: 2026-09-22  

---

## 1. 变更背景与目标

当前企业用户权限管理控制台仅支持逐个手动新建用户。随着企业入职与部门架构调整，超级管理员与安全审计人员需要支持高效的批量导入能力，以减少重复输入成本并保障批量账号录入的一致性。

## 2. 变更详情 (Jobs & Requirements)

### 新增任务 (Added Job)
- **JOB-04: 批量导入企业用户**
  - 超级管理员在工具栏点击「批量导入」按钮，唤起批量导入弹窗。
  - 支持通过逗号/换行分隔的多行文本格式输入多名员工信息（姓名、邮箱、系统角色）。
  - 客户端即时校验格式有效性与必填字段。
  - 点击「确认导入」后，异步批量创建用户账号，完成后关闭弹窗，刷新用户列表，并给出包含成功条数的提示反馈。

### 影响范围 (Impacted Areas)
1. **工具栏区域 (`region-toolbar`)**:
   - 新增次级操作按钮「批量导入」(`users.management.import_btn`)，位于搜索框右侧、新建按钮左侧。
2. **弹窗覆盖层 (`region-modal`)**:
   - 新增批量导入弹窗组件 (`users.management.import_modal`)，包含多行录入框与格式示例提示。
3. **数据表格区域 (`region-content`)**:
   - 表格 (`users.management.table`) 接收导入成功的新增记录并前置呈现，更新总记录数。

### 不变范围 (Unchanged Scope)
- 页面标题与副标题 (`users.management.page_header`) 保持完全不变。
- 单个搜索过滤框 (`users.management.search_input`) 保持完全不变。
- 单个新建用户按钮 (`users.management.create_btn`) 保持完全不变。
- 单个新建用户弹窗及表单 (`users.management.create_modal`, `users.management.create_form`) 保持完全不变。
- 契约状态切换与 4 态逻辑（`ready`, `loading`, `empty`, `error`）保持完全不变。
