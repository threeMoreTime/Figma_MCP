import type { UserRecord, CreateUserDto } from '../types/user';

/**
 * Mock API Service for Greenfield React Application
 * Conforms strictly to Interaction Contract (interaction-contract.json).
 */

export const INITIAL_USERS: UserRecord[] = [
  {
    id: 'usr-01',
    name: '张三 (Admin)',
    email: 'zhangsan@enterprise.com',
    role: '超级管理员',
    status: 'active',
    createdAt: '2026-09-01 10:00',
  },
  {
    id: 'usr-02',
    name: '李四 (Auditor)',
    email: 'lisi@enterprise.com',
    role: '安全审计员',
    status: 'active',
    createdAt: '2026-09-05 14:30',
  },
  {
    id: 'usr-03',
    name: '王五 (Operator)',
    email: 'wangwu@enterprise.com',
    role: '业务运维',
    status: 'disabled',
    createdAt: '2026-09-10 09:15',
  },
];

let usersStore: UserRecord[] = [...INITIAL_USERS];

export const mockApi = {
  async fetchUsers(): Promise<UserRecord[]> {
    // Simulate brief network latency
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...usersStore]);
      }, 50);
    });
  },

  async createUser(data: CreateUserDto): Promise<UserRecord> {
    if (!data.username || data.username.trim() === '') {
      throw new Error('请输入用户姓名');
    }
    if (!data.role || data.role.trim() === '') {
      throw new Error('请输入系统角色');
    }

    const newUser: UserRecord = {
      id: `usr-${Date.now()}`,
      name: data.username.trim(),
      email: data.email?.trim() || `${data.username.trim()}@enterprise.com`,
      role: data.role.trim(),
      status: 'active',
      createdAt: '刚刚',
    };

    usersStore = [newUser, ...usersStore];
    return newUser;
  },

  async batchImportUsers(items: CreateUserDto[]): Promise<UserRecord[]> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('导入数据不能为空');
    }

    const createdUsers: UserRecord[] = items.map((data, index) => ({
      id: `usr-${Date.now() + index}`,
      name: data.username.trim(),
      email: data.email?.trim() || `${data.username.trim()}@enterprise.com`,
      role: data.role.trim() || '业务运维',
      status: 'active',
      createdAt: '刚刚 (批量)',
    }));

    usersStore = [...createdUsers, ...usersStore];
    return createdUsers;
  },

  async toggleUserStatus(id: string): Promise<UserRecord> {
    const userIndex = usersStore.findIndex((u) => u.id === id);
    if (userIndex === -1) {
      throw new Error(`用户 ID 不存在: ${id}`);
    }

    const user = usersStore[userIndex];
    const updatedUser: UserRecord = {
      ...user,
      status: user.status === 'active' ? 'disabled' : 'active',
    };

    usersStore[userIndex] = updatedUser;
    return updatedUser;
  },

  resetUsers(): void {
    usersStore = [...INITIAL_USERS];
  },
};
