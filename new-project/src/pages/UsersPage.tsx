import React from 'react';
import { Input, Button } from 'antd';
import { PageHeader } from '../components/PageHeader';
import { UserTable } from '../components/UserTable';
import { UserCreateModal } from '../components/UserCreateModal';
import { UserImportModal } from '../components/UserImportModal';
import { LoadingView, EmptyView, ErrorView } from '../components/StateViews';
import { useUsers } from '../hooks/useUsers';
import type { PageState } from '../types/user';

export const UsersPage: React.FC = () => {
  const {
    pageState,
    setPageState,
    filteredUsers,
    searchText,
    setSearchText,
    isModalOpen,
    setIsModalOpen,
    submitting,
    isImportModalOpen,
    setIsImportModalOpen,
    importSubmitting,
    handleCreateUser,
    handleBatchImport,
    handleToggleStatus,
    reloadUsers,
  } = useUsers();

  const states: PageState[] = ['ready', 'loading', 'empty', 'error'];

  return (
    <div className="d2c-app-layout" id="html-prototype-root">
      <div className="d2c-main-container">
        {/* Interaction Contract State Switcher Bar */}
        <aside className="d2c-state-bar" id="state-switcher" aria-label="契约状态切换">
          <span className="d2c-state-title">契约状态切换:</span>
          {states.map((s) => (
            <Button
              key={s}
              id={`btn-state-${s}`}
              size="small"
              type={pageState === s ? 'primary' : 'default'}
              onClick={() => setPageState(s)}
            >
              {s} {s === 'ready' ? '(就绪)' : s === 'loading' ? '(加载中)' : s === 'empty' ? '(空数据)' : '(失败)'}
            </Button>
          ))}
        </aside>

        {/* Region 1: Header */}
        <PageHeader />

        {/* Region 2: Toolbar */}
        <section className="d2c-toolbar-region" id="region-toolbar">
          <div
            className="d2c-toolbar-left"
            data-component="filter-search"
            data-semantic-id="users.management.search_input"
          >
            <Input.Search
              id="input-search"
              placeholder="按姓名或角色搜索..."
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--d2c-spacing-sm)' }}>
            <Button
              id="btn-import-user"
              data-component="button"
              data-semantic-id="users.management.import_btn"
              onClick={() => setIsImportModalOpen(true)}
            >
              批量导入
            </Button>
            <Button
              type="primary"
              id="btn-create-user"
              data-component="button"
              data-semantic-id="users.management.create_btn"
              onClick={() => setIsModalOpen(true)}
            >
              新建用户
            </Button>
          </div>
        </section>

        {/* Region 3: Content */}
        <main className="d2c-content-region" id="region-content">
          {pageState === 'loading' && <LoadingView />}
          {pageState === 'error' && (
            <ErrorView
              onRetry={() => {
                setPageState('ready');
                reloadUsers();
              }}
            />
          )}
          {pageState === 'empty' && <EmptyView />}
          {pageState === 'ready' && (
            <>
              {filteredUsers.length === 0 ? (
                <EmptyView description="未找到匹配的用户" />
              ) : (
                <UserTable users={filteredUsers} onToggleStatus={handleToggleStatus} />
              )}
            </>
          )}
        </main>

        {/* Region 4: Modals */}
        <UserCreateModal
          open={isModalOpen}
          submitting={submitting}
          onCancel={() => setIsModalOpen(false)}
          onSubmit={handleCreateUser}
        />
        <UserImportModal
          open={isImportModalOpen}
          submitting={importSubmitting}
          onCancel={() => setIsImportModalOpen(false)}
          onImport={handleBatchImport}
        />
      </div>
    </div>
  );
};
