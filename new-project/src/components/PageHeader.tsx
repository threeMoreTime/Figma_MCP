import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title = '企业用户权限管理控制台',
  subtitle = '为管理员与安全审计人员提供用户生命周期管理、多角色权限配置及操作轨迹审计能力。',
}) => {
  return (
    <header
      className="d2c-page-header"
      data-component="page-header"
      data-semantic-id="users.management.page_header"
      id="region-header"
    >
      <Title level={3} id="header-title" style={{ margin: 0 }}>
        {title}
      </Title>
      <Paragraph
        id="header-subtitle"
        type="secondary"
        style={{ marginTop: 'var(--d2c-spacing-xs)', marginBottom: 0 }}
      >
        {subtitle}
      </Paragraph>
    </header>
  );
};
