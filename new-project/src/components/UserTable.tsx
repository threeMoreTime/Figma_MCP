import React from 'react';
import { Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UserRecord } from '../types/user';

interface UserTableProps {
  users: UserRecord[];
  onToggleStatus: (id: string) => void;
}

export const UserTable: React.FC<UserTableProps> = ({ users, onToggleStatus }) => {
  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span data-col="name">{name}</span>,
    },
    {
      title: '企业邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => <span data-col="email">{email}</span>,
    },
    {
      title: '系统角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const isPrivileged = role === '超级管理员' || role === '安全审计员';
        return (
          <Tag color={isPrivileged ? 'processing' : 'default'} data-col="role">
            {role}
          </Tag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: 'active' | 'disabled') => {
        const isActive = status === 'active';
        return (
          <Tag color={isActive ? 'success' : 'error'} data-col="status">
            {isActive ? '正常' : '禁用'}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time: string) => <span data-col="createdAt">{time}</span>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => {
        const isActive = record.status === 'active';
        return (
          <Button
            type="link"
            size="small"
            data-semantic-id="users.management.row_toggle"
            onClick={() => onToggleStatus(record.id)}
          >
            {isActive ? '禁用' : '启用'}
          </Button>
        );
      },
    },
  ];

  return (
    <div
      className="d2c-table-container"
      data-component="data-table"
      data-semantic-id="users.management.table"
      id="table-container"
    >
      <Table<UserRecord>
        id="users-table"
        rowKey="id"
        columns={columns}
        dataSource={users}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        onRow={(record) => ({
          'data-user-id': record.id,
          className: 'd2c-table-row',
        } as React.HTMLAttributes<HTMLTableRowElement>)}
      />
    </div>
  );
};
