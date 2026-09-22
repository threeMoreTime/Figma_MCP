import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { CreateUserDto } from '../types/user';

interface UserCreateModalProps {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateUserDto) => Promise<boolean>;
}

export const UserCreateModal: React.FC<UserCreateModalProps> = ({
  open,
  submitting,
  onCancel,
  onSubmit,
}) => {
  const [form] = Form.useForm<CreateUserDto>();

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const success = await onSubmit(values);
      if (success) {
        form.resetFields();
      }
    } catch {
      // Form validation error caught by AntD Form
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="新建企业用户"
      open={open}
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="确认创建"
      cancelText="取消"
      okButtonProps={{ id: 'btn-submit-user' }}
      cancelButtonProps={{ id: 'btn-modal-cancel' }}
      destroyOnClose
      data-component="modal-dialog"
      data-semantic-id="users.management.create_modal"
    >
      <Form
        form={form}
        layout="vertical"
        id="form-create-user"
        data-component="form-container"
        data-semantic-id="users.management.create_form"
        style={{ marginTop: 'var(--d2c-spacing-md)' }}
      >
        <Form.Item
          label="用户姓名"
          name="username"
          data-component="form-field"
          rules={[{ required: true, message: '请输入用户姓名' }]}
        >
          <Input
            id="input-username"
            placeholder="例如：赵六"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="企业邮箱"
          name="email"
          data-component="form-field"
          rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
        >
          <Input
            id="input-email"
            placeholder="例如：zhaoliu@enterprise.com"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          label="系统角色"
          name="role"
          data-component="form-field"
          rules={[{ required: true, message: '请输入系统角色' }]}
        >
          <Input
            id="input-role"
            placeholder="例如：业务运维"
            autoComplete="off"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
