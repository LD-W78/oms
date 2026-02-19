import type { ThemeConfig } from 'antd'

export const themeConfig: ThemeConfig = {
  token: {
    // Primary color - professional blue
    colorPrimary: '#1677ff',

    // Border radius
    borderRadius: 6,

    // Font
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',

    // Sidebar colors
    colorBgContainer: '#ffffff',

    // Layout
    colorBgLayout: '#f5f5f5',

    // Header
    colorBgElevated: '#ffffff',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerColor: '#000000',
      siderBg: '#001529',
      triggerBg: '#002140',
      triggerColor: '#ffffff',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#1677ff',
      darkItemColor: '#ffffffa6',
      darkItemSelectedColor: '#ffffff',
      darkSubMenuItemBg: '#000c17',
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#000000d9',
      rowHoverBg: '#f5f5f5',
    },
    Card: {
      borderRadius: 8,
    },
    Button: {
      borderRadius: 6,
    },
  },
}
