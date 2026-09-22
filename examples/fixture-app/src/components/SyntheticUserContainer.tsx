/**
 * Synthetic User Container Component (DEMO SHELL ONLY)
 *
 * Sourced: SYNTHETIC (Explicitly constructed for D2C contract & token verification)
 * NOT a production business component.
 * Demonstrates integration of:
 * - Ant Design 5.7.3 ConfigProvider with generated antdTheme
 * - CSS Variables (--d2c-*)
 * - Canonical component types and registry mapping
 */

import React, { useState } from "react";
import { Button, Table, Modal, Form, Input, ConfigProvider, Space, Typography } from "antd";
import { antdTheme } from "../../../../tooling/d2c/tokens/dist/antd.theme.js";

const { Title, Text } = Typography;

export interface SyntheticUserData {
  id: string;
  name: string;
  role: string;
  status: "active" | "disabled";
}

const mockUsers: SyntheticUserData[] = [
  { id: "usr_1", name: "张三", role: "管理员", status: "active" },
  { id: "usr_2", name: "李四", role: "运营人员", status: "active" },
  { id: "usr_3", name: "王五", role: "质检人员", status: "disabled" },
];

export const SyntheticUserContainer: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const columns = [
    { title: "ID", dataIndex: "id", key: "id" },
    { title: "用户名", dataIndex: "name", key: "name" },
    { title: "角色", dataIndex: "role", key: "role" },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Text type={status === "active" ? "success" : "secondary"}>
          {status === "active" ? "正常" : "已禁用"}
        </Text>
      ),
    },
  ];

  return (
    <ConfigProvider theme={antdTheme}>
      <div
        style={{
          padding: "var(--d2c-spacing-md, 16px)",
          backgroundColor: "var(--d2c-color-bg-container, #ffffff)",
          borderRadius: "var(--d2c-borderRadius-base, 6px)",
          border: "1px solid var(--d2c-color-border, #d9d9d9)",
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Title level={4} style={{ margin: 0 }}>
              用户管理 (Synthetic Fixture Demo Shell)
            </Title>
            <Button type="primary" onClick={() => setModalOpen(true)}>
              新建用户
            </Button>
          </Space>

          <Table<SyntheticUserData>
            rowKey="id"
            columns={columns}
            dataSource={mockUsers}
            pagination={false}
            size="middle"
          />

          <Modal
            title="新建用户 (Synthetic)"
            open={modalOpen}
            onOk={() => setModalOpen(false)}
            onCancel={() => setModalOpen(false)}
            okText="确定"
            cancelText="取消"
          >
            <Form form={form} layout="vertical">
              <Form.Item name="name" label="用户名" rules={[{ required: true }]}>
                <Input placeholder="请输入用户名" />
              </Form.Item>
              <Form.Item name="role" label="角色" rules={[{ required: true }]}>
                <Input placeholder="请输入用户角色" />
              </Form.Item>
            </Form>
          </Modal>
        </Space>
      </div>
    </ConfigProvider>
  );
};

export default SyntheticUserContainer;
