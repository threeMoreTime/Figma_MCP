import type { ThemeConfig } from 'antd';

/**
 * Ant Design 5.7.3 Theme Configuration
 * Directly mapped from Canonical Tokens (canonical-tokens.json).
 * Guarantees zero hardcoded colors and spacing across all React components.
 */
export const d2cTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorError: '#ff4d4f',
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorTextBase: '#141414',
    colorTextSecondary: '#595959',
    colorBorder: '#d9d9d9',
    borderRadius: 6,
    fontSize: 14,
    fontSizeHeading1: 20,
    wireframe: false,
  },
  components: {
    Button: {
      borderRadius: 6,
      controlHeight: 32,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 32,
    },
    Modal: {
      borderRadiusLG: 8,
    },
    Tag: {
      borderRadiusSM: 2,
    },
  },
};
