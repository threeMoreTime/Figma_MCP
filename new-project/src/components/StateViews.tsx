import React from 'react';
import { Spin, Empty, Alert, Button } from 'antd';

export const LoadingView: React.FC = () => {
  return (
    <div id="state-loading-view" className="d2c-loading-placeholder">
      <Spin size="large" />
      <p className="d2c-loading-text">正在从后端用户中心加载数据...</p>
    </div>
  );
};

interface EmptyViewProps {
  description?: string;
}

export const EmptyView: React.FC<EmptyViewProps> = ({
  description = '暂无符合筛选条件的用户记录',
}) => {
  return (
    <div
      id="state-empty-view"
      className="d2c-empty-placeholder"
      data-component="empty-placeholder"
    >
      <Empty description={description} />
    </div>
  );
};

interface ErrorViewProps {
  onRetry: () => void;
  message?: string;
}

export const ErrorView: React.FC<ErrorViewProps> = ({
  onRetry,
  message = '后端鉴权认证超时或网络连接异常，请重试。',
}) => {
  return (
    <div id="state-error-view" data-component="alert-notice" style={{ margin: 'var(--d2c-spacing-md) 0' }}>
      <Alert
        message="数据加载失败"
        description={message}
        type="error"
        showIcon
        action={
          <Button danger size="small" onClick={onRetry}>
            重新加载
          </Button>
        }
      />
    </div>
  );
};
