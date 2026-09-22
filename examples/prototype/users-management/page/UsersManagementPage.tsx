import React, { useState } from "react";
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Tag,
  Alert,
  Empty,
  Spin,
  Space,
  message,
} from "antd";
import type { TableProps } from "antd";
import { adaptDesignProps } from "../adapter/component-adapter.js";

type ColumnsType<T> = NonNullable<TableProps<T>["columns"]>;

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "disabled";
  createdAt: string;
}

const INITIAL_USERS: UserRecord[] = [
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

export const UsersManagementPage: React.FC = () => {
  // Sourced strictly from InteractionContract
  const [pageState, setPageState] = useState<"ready" | "loading" | "empty" | "error">("ready");
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Adapted Props via Prototype Component Adapter
  const primaryActionProps = adaptDesignProps({
    component: "primary-action",
    variant: "primary",
    state: submitting ? "loading" : "ready",
  }).props;

  const tableProps = adaptDesignProps({
    component: "data-table",
    state: pageState === "loading" ? "loading" : pageState === "empty" ? "empty" : "ready",
  }).props;

  const searchInputProps = adaptDesignProps({
    component: "filter-search",
  }).props;

  // Columns definition conforming to DataTable blueprint
  const columns: ColumnsType<UserRecord> = [
    {
      title: "用户姓名",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "企业邮箱",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "系统角色",
      dataIndex: "role",
      key: "role",
      render: (role: string) => {
        let color = "blue";
        if (role === "超级管理员") color = "gold";
        if (role === "安全审计员") color = "purple";
        return <Tag color={color}>{role}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "red"}>
          {status === "active" ? "正常" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record: UserRecord) => (
        <Space size="middle">
          <Button
            type="link"
            size="small"
            data-semantic-id="users.management.row_toggle"
            onClick={() => {
              setUsers((prev) =>
                prev.map((u) =>
                  u.id === record.id
                    ? { ...u, status: u.status === "active" ? "disabled" : "active" }
                    : u
                )
              );
              message.info(`已变更用户 ${record.name} 状态`);
            }}
          >
            {record.status === "active" ? "禁用" : "启用"}
          </Button>
        </Space>
      ),
    },
  ];

  // Filtered list
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchText.toLowerCase()) ||
      u.email.toLowerCase().includes(searchText.toLowerCase()) ||
      u.role.toLowerCase().includes(searchText.toLowerCase())
  );

  // Interaction: click primary action -> open modal
  const handleOpenCreateModal = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  // Interaction: form submit with validation
  const handleFormFinish = async (values: any) => {
    if (values.username === "error_trigger") {
      message.error("提交失败，后端用户中心校验不通过");
      return;
    }

    const newUser: UserRecord = {
      id: `usr-${Date.now()}`,
      name: values.username,
      email: values.email || `${values.username}@enterprise.com`,
      role: values.role,
      status: "active",
      createdAt: "刚刚",
    };

    setUsers((prev) => [newUser, ...prev]);
    setIsModalOpen(false);
    message.success("用户创建成功");
  };

  return (
    <div className="prototype-container" id="users-prototype-root">
      {/* State Switcher Bar for testing InteractionContract states */}
      <div className="state-switcher-bar" id="state-switcher">
        <span className="state-switcher-title">契约状态切换:</span>
        <Button
          size="small"
          type={pageState === "ready" ? "primary" : "default"}
          id="btn-state-ready"
          onClick={() => setPageState("ready")}
        >
          ready (就绪)
        </Button>
        <Button
          size="small"
          type={pageState === "loading" ? "primary" : "default"}
          id="btn-state-loading"
          onClick={() => setPageState("loading")}
        >
          loading (加载中)
        </Button>
        <Button
          size="small"
          type={pageState === "empty" ? "primary" : "default"}
          id="btn-state-empty"
          onClick={() => setPageState("empty")}
        >
          empty (空数据)
        </Button>
        <Button
          size="small"
          type={pageState === "error" ? "primary" : "default"}
          id="btn-state-error"
          onClick={() => setPageState("error")}
        >
          error (失败)
        </Button>
      </div>

      {/* 1. Header Region */}
      <header className="prototype-header-region" id="region-header">
        <h2 id="header-title">企业用户权限管理控制台</h2>
        <p id="header-subtitle">为管理员与安全审计人员提供用户生命周期管理、多角色权限配置及操作轨迹审计能力。</p>
      </header>

      {/* 2. Toolbar Region */}
      <section className="prototype-toolbar-region" id="region-toolbar">
        <div className="prototype-toolbar-left">
          <Input.Search
            {...searchInputProps}
            id="input-search"
            data-semantic-id="users.management.search_input"
            placeholder="按姓名或角色搜索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Button
          {...primaryActionProps}
          id="btn-create-user"
          data-semantic-id="users.management.create_btn"
          onClick={handleOpenCreateModal}
        >
          新建用户
        </Button>
      </section>

      {/* 3. Content Region */}
      <main className="prototype-content-region" id="region-content">
        {pageState === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 0" }} id="state-loading-view">
            <Spin size="large" tip="正在从后端用户中心加载数据..." />
          </div>
        )}

        {pageState === "error" && (
          <div id="state-error-view">
            <Alert
              message="数据加载失败"
              description="后端鉴权认证超时或网络连接异常，请重试。"
              type="error"
              showIcon
              action={
                <Button size="small" danger onClick={() => setPageState("ready")}>
                  重新加载
                </Button>
              }
            />
          </div>
        )}

        {pageState === "empty" && (
          <div id="state-empty-view" style={{ padding: "40px 0" }}>
            <Empty description="暂无符合筛选条件的用户记录" />
          </div>
        )}

        {pageState === "ready" && (
          <div id="state-ready-view">
            <Table<UserRecord>
              {...tableProps}
              id="users-table"
              data-semantic-id="users.management.table"
              columns={columns}
              dataSource={filteredUsers}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </div>
        )}
      </main>

      {/* 4. Modal Container Region */}
      <Modal
        wrapClassName="modal-create-user-wrap"
        title="新建企业用户"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <div id="modal-create-user" data-semantic-id="users.management.create_modal">
          <Form
            form={form}
            layout="vertical"
            id="form-create-user"
            data-semantic-id="users.management.create_form"
            onFinish={handleFormFinish}
          >
            <Form.Item
              name="username"
              label="用户姓名"
              rules={[{ required: true, message: "请输入用户姓名" }]}
            >
              <Input id="input-username" placeholder="例如：赵六" />
            </Form.Item>

            <Form.Item
              name="email"
              label="企业邮箱"
              rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
            >
              <Input id="input-email" placeholder="例如：zhaoliu@enterprise.com" />
            </Form.Item>

            <Form.Item
              name="role"
              label="系统角色"
              rules={[{ required: true, message: "请输入系统角色" }]}
            >
              <Input id="input-role" placeholder="例如：业务运维" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
              <Space>
                <Button onClick={() => setIsModalOpen(false)}>取消</Button>
                <Button type="primary" htmlType="submit" loading={submitting} id="btn-submit-user">
                  确认创建
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </div>
  );
};

// Also export alias for UsersPrototype
export const UsersPrototype = UsersManagementPage;
