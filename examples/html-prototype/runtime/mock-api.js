/**
 * Mock API Service for Greenfield HTML Prototype
 * Sourced strictly from Interaction Contract.
 */

const INITIAL_USERS = [
  {
    id: "usr-01",
    name: "张三 (Admin)",
    email: "zhangsan@enterprise.com",
    role: "超级管理员",
    status: "active",
    createdAt: "2026-09-01 10:00",
  },
  {
    id: "usr-02",
    name: "李四 (Auditor)",
    email: "lisi@enterprise.com",
    role: "安全审计员",
    status: "active",
    createdAt: "2026-09-05 14:30",
  },
  {
    id: "usr-03",
    name: "王五 (Operator)",
    email: "wangwu@enterprise.com",
    role: "业务运维",
    status: "disabled",
    createdAt: "2026-09-10 09:15",
  },
];

let usersStore = [...INITIAL_USERS];

async function fetchUsers() {
  return [...usersStore];
}

async function createUser(data) {
  if (!data.username || data.username.trim() === "") {
    throw new Error("请输入用户姓名");
  }
  if (!data.role || data.role.trim() === "") {
    throw new Error("请输入系统角色");
  }

  const newUser = {
    id: "usr-" + Date.now(),
    name: data.username.trim(),
    email: data.email?.trim() || data.username.trim() + "@enterprise.com",
    role: data.role.trim(),
    status: "active",
    createdAt: "刚刚",
  };

  usersStore = [newUser, ...usersStore];
  return newUser;
}

async function importUsers(usersList) {
  if (!Array.isArray(usersList) || usersList.length === 0) {
    throw new Error("导入数据不能为空");
  }
  const newUsers = usersList.map((u, i) => ({
    id: "usr-" + (Date.now() + i),
    name: u.username.trim(),
    email: u.email?.trim() || u.username.trim() + "@enterprise.com",
    role: u.role?.trim() || "业务运维",
    status: "active",
    createdAt: "刚刚 (批量)",
  }));
  usersStore = [...newUsers, ...usersStore];
  return newUsers;
}

function resetUsers() {
  usersStore = [...INITIAL_USERS];
}

if (typeof window !== "undefined") {
  window.D2C_MOCK_API = { INITIAL_USERS, fetchUsers, createUser, importUsers, resetUsers };
}
