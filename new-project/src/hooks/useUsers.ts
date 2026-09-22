import { useState, useEffect, useMemo, useCallback } from 'react';
import { message } from 'antd';
import type { UserRecord, CreateUserDto, PageState } from '../types/user';
import { mockApi } from '../services/mockApi';

export function useUsers() {
  const [pageState, setPageState] = useState<PageState>('ready');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importSubmitting, setImportSubmitting] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    try {
      setPageState('loading');
      const data = await mockApi.fetchUsers();
      setUsers(data);
      setPageState('ready');
    } catch {
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) {
      return users;
    }
    const query = searchText.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
    );
  }, [users, searchText]);

  const handleCreateUser = useCallback(async (data: CreateUserDto): Promise<boolean> => {
    setSubmitting(true);
    try {
      const newUser = await mockApi.createUser(data);
      setUsers((prev) => [newUser, ...prev]);
      message.success('用户创建成功');
      setIsModalOpen(false);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '创建用户失败';
      message.error(errMsg);
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleBatchImport = useCallback(async (items: CreateUserDto[]): Promise<boolean> => {
    setImportSubmitting(true);
    try {
      const createdUsers = await mockApi.batchImportUsers(items);
      setUsers((prev) => [...createdUsers, ...prev]);
      message.success(`批量导入成功，已新增 ${createdUsers.length} 名用户`);
      setIsImportModalOpen(false);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '批量导入失败';
      message.error(errMsg);
      return false;
    } finally {
      setImportSubmitting(false);
    }
  }, []);

  const handleToggleStatus = useCallback(async (id: string) => {
    try {
      const updated = await mockApi.toggleUserStatus(id);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      const actionText = updated.status === 'active' ? '启用成功' : '禁用成功';
      message.success(actionText);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '操作失败';
      message.error(errMsg);
    }
  }, []);

  return {
    pageState,
    setPageState,
    users,
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
    reloadUsers: loadData,
  };
}
