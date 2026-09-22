import React, { useState } from 'react';
import { Modal, Form, Input, Alert } from 'antd';
import type { CreateUserDto } from '../types/user';

interface UserImportModalProps {
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onImport: (users: CreateUserDto[]) => Promise<boolean>;
}

export const UserImportModal: React.FC<UserImportModalProps> = ({
  open,
  submitting,
  onCancel,
  onImport,
}) => {
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOk = async () => {
    setErrorMsg(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setErrorMsg('请输入要导入的用户数据');
      return;
    }

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsedUsers: CreateUserDto[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const username = parts[0];
      const email = parts[1];
      const role = parts[2];

      if (!username) {
        setErrorMsg(`第 ${i + 1} 行姓名不能为空`);
        return;
      }

      parsedUsers.push({
        username,
        email: email || `${username}@enterprise.com`,
        role: role || '业务运维',
      });
    }

    if (parsedUsers.length === 0) {
      setErrorMsg('未解析到有效的用户记录');
      return;
    }

    const success = await onImport(parsedUsers);
    if (success) {
      setText('');
      setErrorMsg(null);
    }
  };

  const handleCancel = () => {
    setText('');
    setErrorMsg(null);
    onCancel();
  };

  return (
    <Modal
      title="批量导入企业用户"
      open={open}
      confirmLoading={submitting}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="确认导入"
      cancelText="取消"
      okButtonProps={{ id: 'btn-submit-import' }}
      cancelButtonProps={{ id: 'btn-import-cancel' }}
      destroyOnClose
      data-component="modal-dialog"
      data-semantic-id="users.management.import_modal"
    >
      <Form layout="vertical" style={{ marginTop: 'var(--d2c-spacing-md)' }}>
        <Form.Item
          label="批量数据录入 (每行格式：姓名,邮箱,角色)"
          required
          help="支持直接粘贴多行 CSV 数据，系统将自动批量验证并创建企业账号"
        >
          <Input.TextArea
            id="textarea-import-data"
            rows={5}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={`孙七,sunqi@enterprise.com,业务运维\n周八,zhouba@enterprise.com,安全审计员`}
          />
        </Form.Item>

        {errorMsg && (
          <Alert
            message={errorMsg}
            type="error"
            showIcon
            style={{ marginBottom: 'var(--d2c-spacing-sm)' }}
          />
        )}
      </Form>
    </Modal>
  );
};
