/**
 * RITOS OMS 设计稿预览
 * 基于 http://localhost:4002 参考网站样式
 */

// 颜色系统
export const colors = {
  // 主色
  primary: '#1976d2',
  primaryHover: '#1565c0',
  primaryLight: '#e3f2fd',

  // 文字颜色
  text: {
    primary: '#111827',      // rgb(17, 24, 39) - 主要文字
    secondary: '#6b7280',    // 次要文字
    tertiary: '#9ca3af',     // 辅助文字
    disabled: '#9ca3af',
  },

  // 背景色
  background: {
    body: '#f5f5f7',        // rgb(245, 245, 247) - 页面背景
    card: '#ffffff',        // 卡片背景
    header: '#ffffff',       // 头部背景
    sidebar: '#111827',      // 侧边栏背景 (深色)
  },

  // 边框
  border: {
    light: '#e5e7eb',
    default: '#d1d5db',
  },

  // 状态色
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
}

// 字体系统
export const fonts = {
  family: 'Inter, Roboto, Helvetica, Arial, sans-serif',
  size: {
    xs: '12px',
    sm: '14px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    xxl: '20px',
    heading: '24px',
  },
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
}

// 间距系统
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
}

// 圆角系统
export const borderRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  xxl: '24px',  // 大圆角卡片
  full: '9999px', // 圆形
}

// 阴影系统
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
}

// 布局尺寸
export const layout = {
  sidebar: {
    width: 260,
    collapsedWidth: 80,
    background: '#111827',
  },
  header: {
    height: 64,
    background: '#ffffff',
  },
  content: {
    padding: 24,
  },
}

// 组件样式

// Card 组件样式
export const cardStyles = {
  background: '#ffffff',
  borderRadius: '24px',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
  padding: '24px',
  border: 'none',
}

// Header 组件样式
export const headerStyles = {
  background: '#ffffff',
  height: '64px',
  borderBottom: '1px solid #e5e7eb',
  padding: '0 24px',
}

// 按钮样式
export const buttonStyles = {
  primary: {
    background: '#1976d2',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
  },
  default: {
    background: '#ffffff',
    color: '#111827',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    border: '1px solid #d1d5db',
  },
  text: {
    background: 'transparent',
    color: '#1976d2',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '14px',
  },
}

// 输入框样式
export const inputStyles = {
  background: '#ffffff',
  color: '#111827',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  padding: '8px 12px',
  fontSize: '14px',
  placeholder: '#9ca3af',
}

// 菜单项样式
export const menuItemStyles = {
  sidebar: {
    background: 'transparent',
    color: '#9ca3af',
    hoverBackground: 'rgba(255, 255, 255, 0.1)',
    hoverColor: '#ffffff',
    selectedBackground: '#1976d2',
    selectedColor: '#ffffff',
    padding: '12px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
  },
}

// 表格样式
export const tableStyles = {
  headerBackground: '#f9fafb',
  headerColor: '#111827',
  rowHoverBackground: '#f9fafb',
  rowBorderBottom: '#e5e7eb',
  cellPadding: '12px 16px',
  fontSize: '14px',
}

// 标签页样式
export const tabStyles = {
  activeColor: '#1976d2',
  inactiveColor: '#6b7280',
  underlineColor: '#1976d2',
  fontSize: '14px',
  fontWeight: 500,
}

// 徽章样式
export const badgeStyles = {
  default: {
    background: '#f3f4f6',
    color: '#374151',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
  },
  primary: {
    background: '#e3f2fd',
    color: '#1976d2',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '12px',
  },
}

// 设计稿配置导出
export const designSystem = {
  colors,
  fonts,
  spacing,
  borderRadius,
  shadows,
  layout,
  components: {
    card: cardStyles,
    header: headerStyles,
    button: buttonStyles,
    input: inputStyles,
    menuItem: menuItemStyles,
    table: tableStyles,
    tab: tabStyles,
    badge: badgeStyles,
  },
}

export default designSystem
