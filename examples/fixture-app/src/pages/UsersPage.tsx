/**
 * Users Page Prototype Component (examples/fixture-app)
 *
 * Implements:
 * - Ready / Loading / Empty / Error states
 * - Filter input
 * - Add User Modal with form validation
 * - Submit success and simulated error flow
 * - Strict source-map data-d2c-id markers for stable DOM inspection
 */

import React, { useState } from "react";
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Radio,
  Alert,
  Space,
  Typography,
  Tag,
  ConfigProvider,
  message,
} from "antd";
import { antdTheme } from "../../../../tooling/d2c/tokens/dist/antd.theme.js";

const { Title, Text } = Typography;

export interface UserItem {
  id: string;
  name: string;
  role: string;
  status: "active" | "disabled";
}

const initialUsers: UserItem[] = [
  { id: "usr_101", name: "张三 (Admin)", role: "超级管理员", status: "active" },
  { id: "usr_102", name: "李四 (Ops)", role: "运营主管", status: "active" },
  { id: "usr_103", name: "王五 (Auditor)", role: "审计人员", status: "disabled" },
];

export interface UsersPageProps {
  initialState?: "ready" | "loading" | "empty" | "error";
  revision?: number;
  contentHash?: string;
  spacing?: number;
  titleText?: string;
  createButtonText?: string;
  createButtonVariant?: "primary" | "dashed" | "default";
}

export const UsersPage: React.FC<UsersPageProps> = ({
  initialState = "ready",
  revision = 1,
  contentHash = "",
  spacing = 16,
  titleText = "用户管理",
  createButtonText = "新建用户",
  createButtonVariant = "primary",
}) => {
  const [viewState, setViewState] = useState<"ready" | "loading" | "empty" | "error">(initialState);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [searchText, setSearchText] = useState("");
  const [form] = Form.useForm();

  const handleCreate = async (values: { name: string; role: string }) => {
    setSubmitting(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSubmitting(false);

    // Mock validation: reject if name is "error"
    if (values.name === "error") {
      message.error("创建失败：用户名包含违规字符");
      return;
    }

    const newUser: UserItem = {
      id: `usr_${Date.now()}`,
      name: values.name,
      role: values.role,
      status: "active",
    };

    setUsers([newUser, ...users]);
    setModalOpen(false);
    form.resetFields();
    message.success("用户创建成功");
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchText.toLowerCase()) ||
      u.role.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    { title: "用户ID", dataIndex: "id", key: "id" },
    { title: "用户名", dataIndex: "name", key: "name" },
    { title: "所属角色", dataIndex: "role", key: "role" },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "default"}>
          {status === "active" ? "正常" : "已禁用"}
        </Tag>
      ),
    },
  ];

  return (
    <ConfigProvider theme={antdTheme}>
      <div
        id="fixture-app-root"
        data-d2c-revision={revision}
        data-d2c-content-hash={contentHash}
        data-d2c-spacing={spacing}
        style={{
          padding: spacing !== undefined ? `${spacing}px` : "var(--d2c-spacing-md, 16px)",
          backgroundColor: "var(--d2c-color-bg-container, #ffffff)",
          borderRadius: "var(--d2c-borderRadius-base, 6px)",
          border: "1px solid var(--d2c-color-border, #d9d9d9)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* Test State Switcher - Strictly for automated browser testing */}
        <div
          data-d2c-id="fixture-state-switcher"
          style={{
            marginBottom: 16,
            padding: 8,
            backgroundColor: "#f5f5f5",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            [Fixture Harness] 状态选择器:
          </Text>
          <Radio.Group
            size="small"
            value={viewState}
            onChange={(e) => setViewState(e.target.value)}
          >
            <Radio.Button value="ready">Ready</Radio.Button>
            <Radio.Button value="loading">Loading</Radio.Button>
            <Radio.Button value="empty">Empty</Radio.Button>
            <Radio.Button value="error">Error</Radio.Button>
          </Radio.Group>
        </div>

        {/* Header Area */}
        <div
          data-d2c-id="users-header-area"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: spacing !== undefined ? spacing : 16,
          }}
        >
          <Title
            level={4}
            data-d2c-id="users-page-title"
            id="users-page-title"
            style={{ margin: 0 }}
          >
            {titleText}
          </Title>

          <Space>
            <Input.Search
              data-d2c-id="users-filter-input"
              id="users-filter-input"
              placeholder="搜索用户名或角色"
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220 }}
            />
            <Button
              type={createButtonVariant}
              data-d2c-id="users-create-btn"
              id="users-create-btn"
              onClick={() => setModalOpen(true)}
            >
              {createButtonText}
            </Button>
          </Space>
        </div>

        {/* Content Area according to viewState */}
        {viewState === "error" && (
          <Alert
            data-d2c-id="users-error-alert"
            message="数据加载失败"
            description="远程服务响应超时，请重试或检查网络状态。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <div data-d2c-id="users-table-container" id="users-table-container">
          <Table<UserItem>
            rowKey="id"
            columns={columns}
            dataSource={viewState === "empty" ? [] : filteredUsers}
            loading={viewState === "loading"}
            pagination={{ pageSize: 5 }}
            locale={{
              emptyText: <span data-d2c-id="users-empty-indicator">暂无用户数据</span>,
            }}
          />
        </div>

        {/* Create Modal */}
        <Modal
          title="新建用户"
          open={modalOpen}
          onCancel={() => {
            setModalOpen(false);
            form.resetFields();
          }}
          onOk={() => form.submit()}
          confirmLoading={submitting}
          okText="确定"
          cancelText="取消"
          data-d2c-id="users-create-modal"
        >
          <Form form={form} layout="vertical" onFinish={handleCreate}>
            <Form.Item
              name="name"
              label="用户名"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input data-d2c-id="input-username" id="input-username" placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item
              name="role"
              label="用户角色"
              rules={[{ required: true, message: "请输入用户角色" }]}
            >
              <Input data-d2c-id="input-role" id="input-role" placeholder="请输入用户角色" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ConfigProvider>
  );
};

export default UsersPage;
