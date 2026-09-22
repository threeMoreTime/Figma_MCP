# React Project Incremental Change Plan (Phase 6)

**Target Project**: `new-project/`  
**Change Request**: `requirements/change-request.md` (`CR-2026-USER-IMPORT`)  
**Blueprint Patch**: `blueprint-patch.json`  
**Component Impact**: `component-impact.json`  
**Date**: 2026-09-22  

---

## 1. Principles & Safeguards

1. **Incremental Update Only**:
   - Strictly prohibit regenerating or replacing existing unmodified components.
   - Strictly preserve all existing semantic identifiers:
     - `users.management.page_header`
     - `users.management.search_input`
     - `users.management.create_btn`
     - `users.management.table`
     - `users.management.create_modal`
     - `users.management.create_form`
2. **Zero Regression on Existing Features**:
   - Individual user creation modal, table search filtering, row status toggling, and the 4 contract states (`ready`, `loading`, `empty`, `error`) must remain completely functional.
3. **Token & DS Primitive Compliance**:
   - New UI elements must resolve to Ant Design 5.7.3 primitives (`Modal`, `Input.TextArea`, `Button`) styled through `d2cTheme` and token CSS variables.
   - Zero hardcoded colors or pixel spacing.

---

## 2. Planned File Changes

### 2.1 [NEW] `new-project/src/components/UserImportModal.tsx`
- **Purpose**: Feature component for bulk user import.
- **Underlying Primitives**: Ant Design `Modal`, `Form`, `Input.TextArea`, `Alert`.
- **Semantic Annotations**: `data-component="modal-dialog"`, `data-semantic-id="users.management.import_modal"`.
- **Props**:
  - `open: boolean`
  - `submitting: boolean`
  - `onCancel: () => void`
  - `onImport: (users: CreateUserDto[]) => Promise<boolean>`
- **Validation**:
  - Requires non-empty input.
  - Parses comma-separated rows: `姓名,邮箱,角色`.
  - Rejects malformed rows with user-friendly error messages.

### 2.2 [MODIFY] `new-project/src/services/mockApi.ts`
- **Addition**:
  ```typescript
  async batchImportUsers(items: CreateUserDto[]): Promise<UserRecord[]>
  ```
- **Behavior**:
  - Validates array non-empty.
  - Maps items to `UserRecord` with timestamps.
  - Prepends records to `usersStore`.
  - Returns created user array.

### 2.3 [MODIFY] `new-project/src/hooks/useUsers.ts`
- **State Additions**:
  - `isImportModalOpen: boolean` (default: false)
  - `setIsImportModalOpen: (open: boolean) => void`
  - `importSubmitting: boolean`
  - `handleBatchImport: (items: CreateUserDto[]) => Promise<boolean>`
- **Side Effects**:
  - On success: prepends imported users to state, invokes `message.success('批量导入成功，已新增 X 名用户')`, closes modal.

### 2.4 [MODIFY] `new-project/src/pages/UsersPage.tsx`
- **Toolbar Region Update**:
  - In `#region-toolbar`, place secondary action `<Button id="btn-import-user" data-component="button" data-semantic-id="users.management.import_btn">批量导入</Button>` alongside "新建用户".
- **Modal Layer Update**:
  - Mount `<UserImportModal />` alongside existing `<UserCreateModal />`.

---

## 3. Verification Sequence

1. `npx tsc -p new-project/tsconfig.json --noEmit`: Ensure 0 TypeScript errors.
2. `npx vite build new-project`: Recompile production bundle into `new-project/dist/`.
3. Update Playwright test suite `tests/new-project-browser.test.ts` to add subtest for batch import flow and assert zero regression on existing tests.
4. Run full regression: `pnpm test` and `pnpm typecheck`.
