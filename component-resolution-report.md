# Component Resolution Report: HTML Prototype → React Application

**Date**: 2026-09-22  
**Input Artifacts**:  
- `examples/html-prototype/` (`index.html`, `prototype-manifest.json`, `styles/`, `runtime/`)  
- `examples/output/ui-blueprint.json`  
- `examples/output/interaction-contract.json`  
- `tooling/d2c/tokens/canonical-tokens.json`  
- `tooling/d2c/blueprint/component-intent-catalog.json`  
- `production-component-catalog.json`  

**Target Output**:  
- `new-project/` (React 18 + TypeScript + Vite + Ant Design 5.7.3)

---

## 1. Resolution Principles & Governance

1. **Component Catalog Priority**:
   Whenever a semantic intent matches an existing catalog primitive (Ant Design 5.7.3), use that primitive directly or wrap it in a lightweight feature component.
2. **Feature Components vs. DS Primitives**:
   - **Allowed**: Feature components (e.g., `PageHeader`, `UserTable`, `UserCreateModal`, `StateViews`, `UsersPage`) that compose primitives to serve business screens.
   - **Strictly Forbidden**: Inventing new base Design System primitives (e.g. creating custom `Button`, `Input`, `Table` from scratch). All UI elements resolve to Ant Design 5.7.3 primitives.
3. **Deterministic Token Binding**:
   All component styling resolves to Canonical Design Tokens (`canonical-tokens.json`). Tokens are injected into React via Ant Design's typed `ThemeConfig` (`ConfigProvider`) and CSS token variables (`--d2c-*`). Zero hardcoded hex colors or pixel spacing.
4. **4-State Completeness**:
   Every data surface and screen must structurally support the 4 core lifecycle states:
   - `ready`: Default operational state with data rendered
   - `loading`: Async fetching state with spinner indicator
   - `empty`: Zero records state with empty placeholder
   - `error`: Network or server failure state with error banner & retry trigger

---

## 2. Component Resolution Matrix

| Semantic ID / Region | HTML Prototype Element (`data-component`) | Target React Component | Component Type | Underlying AntD Primitive | Contract & Props Binding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `users.management.page_header` | `<header data-component="page-header">` | `PageHeader` | Feature Component | `Typography.Title`, `Typography.Paragraph` | `title`: "企业用户权限管理控制台"<br>`subtitle`: "为管理员与安全审计人员..." |
| `users.management.search_input` | `<div data-component="filter-search"><input type="search"></div>` | `Input.Search` | AntD Primitive | `Input.Search` | `placeholder`: "按姓名或角色搜索..."<br>`allowClear`: true<br>`onSearch`: `(val) => void` |
| `users.management.create_btn` | `<button data-component="button">` | `Button` | AntD Primitive | `Button` | `type`: "primary"<br>`onClick`: `() => setModalOpen(true)`<br>`children`: "新建用户" |
| `users.management.table` | `<div data-component="data-table"><table>` | `UserTable` | Feature Component | `Table<UserRecord>` | `dataSource`: `filteredUsers`<br>`rowKey`: "id"<br>`columns`: Name, Email, Role, Status, CreatedAt, Actions |
| `users.management.role_tag` | `<span class="d2c-tag">` | `Tag` | AntD Primitive | `Tag` | `color`: Admin/Auditor → `colorPrimary`, others → `default` |
| `users.management.status_tag` | `<span class="d2c-tag">` | `Tag` | AntD Primitive | `Tag` | `color`: active → `colorSuccess`, disabled → `colorError` |
| `users.management.row_toggle` | `<button class="d2c-btn-link">` | `Button` | AntD Primitive | `Button (type="link")` | `onClick`: `() => toggleStatus(record.id)`<br>`children`: status === 'active' ? '禁用' : '启用' |
| `users.management.create_modal` | `<dialog data-component="modal-dialog">` | `UserCreateModal` | Feature Component | `Modal` | `open`: boolean<br>`title`: "新建企业用户"<br>`onCancel`: `() => void`<br>`onOk`: Form submit |
| `users.management.create_form` | `<form data-component="form-container">` | `Form` | AntD Primitive | `Form`, `Form.Item`, `Input` | `layout`: "vertical"<br>validation: `username` (required), `role` (required) |
| `users.management.state_loading` | `<div class="d2c-loading-placeholder">` | `LoadingView` | Feature Component | `Spin` | Displays loading spinner and status feedback |
| `users.management.state_empty` | `<div data-component="empty-placeholder">` | `EmptyView` | Feature Component | `Empty` | Displays "暂无符合筛选条件的用户记录" |
| `users.management.state_error` | `<div data-component="alert-notice">` | `ErrorView` | Feature Component | `Alert` | `type`: "error"<br>`showIcon`: true<br>`action`: `<Button danger>重新加载</Button>` |

---

## 3. Design Token to React Theme Mapping

The application configures Ant Design's `ConfigProvider` using tokens directly derived from `canonical-tokens.json`:

```typescript
// new-project/src/styles/theme.ts
import type { ThemeConfig } from 'antd';

export const d2cAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',      // {color.brand.blue.600}
    colorSuccess: '#52c41a',      // {color.brand.green.500}
    colorError: '#ff4d4f',        // {color.brand.red.500}
    colorBgContainer: '#ffffff',  // {color.neutral.white}
    colorBgLayout: '#f5f5f5',     // {color.neutral.gray.100}
    colorTextBase: '#141414',     // {color.neutral.gray.900}
    colorTextSecondary: '#595959',// {color.neutral.gray.700}
    colorBorder: '#d9d9d9',       // {color.neutral.gray.300}
    borderRadius: 6,              // {borderRadius.base}
    fontSize: 14,                 // {fontSize.base}
    fontSizeHeading1: 20,         // {fontSize.heading}
  },
  components: {
    Table: {
      headerBg: '#fafafa',
      headerBorderRadius: 6,
    },
    Button: {
      borderRadius: 6,
    }
  }
};
```

Global layout and helper styles use CSS variables mapped from `tokens.css`:
- `--d2c-spacing-xs: 4px`
- `--d2c-spacing-sm: 8px`
- `--d2c-spacing-md: 16px`
- `--d2c-spacing-lg: 24px`

Zero inline arbitrary hex colors or pixel spacing will be present in the project.

---

## 4. Interaction Contract Implementation

The implementation matches all 5 interaction sequences defined in `interaction-contract.json`:

1. **`int-click-create`**: Clicking "新建用户" triggers `setModalOpen(true)` on `UserCreateModal`.
2. **`int-validate-form`**: Submitting `form-create-user` enforces required validation on `username` and `role`.
3. **`int-submit-form`**: Valid form calls `mockApi.createUser()`, closes the modal, and resets form inputs.
4. **`int-success-form`**: Success triggers AntD `message.success('用户创建成功')` and prepends the new user to the table.
5. **`int-error-form`**: Validation errors display inline messages on the respective form inputs.

---

## 5. Architectural Directory Layout

```
new-project/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── component-resolution-report.md
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/
    │   └── user.ts
    ├── services/
    │   └── mockApi.ts
    ├── hooks/
    │   └── useUsers.ts
    ├── styles/
    │   ├── theme.ts
    │   ├── tokens.css
    │   └── index.css
    ├── components/
    │   ├── PageHeader.tsx
    │   ├── UserTable.tsx
    │   ├── UserCreateModal.tsx
    │   └── StateViews.tsx
    └── pages/
        └── UsersPage.tsx
```

---

## 6. Verification Strategy

1. **TypeScript Typecheck**: `npx tsc -p new-project/tsconfig.json --noEmit` ensures zero TypeScript errors.
2. **Vite Production Build**: `npx vite build new-project` ensures asset bundling and bundle integrity.
3. **Playwright E2E Browser Test**: `tests/new-project-browser.test.ts` drives headless browser to test:
   - Initial `ready` state rendering
   - State switcher verification for `loading`, `empty`, `error`
   - Real-time search query filtering
   - Modal opening and form validation errors
   - Successful user creation and table row insertion
   - User status toggle action
   - Automated screenshot capture for visual confirmation
