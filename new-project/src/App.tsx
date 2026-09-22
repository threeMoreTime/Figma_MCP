import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { d2cTheme } from './styles/theme';
import { UsersPage } from './pages/UsersPage';

export const App: React.FC = () => {
  return (
    <ConfigProvider theme={d2cTheme} locale={zhCN}>
      <UsersPage />
    </ConfigProvider>
  );
};

export default App;
