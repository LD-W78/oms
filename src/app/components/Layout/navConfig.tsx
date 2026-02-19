'use client'

// 导航配置，图标键与 MainLayout iconMap 一致
export interface NavItem {
  key: string
  label: string
  icon: string // lucide icon name
  path: string
  children?: NavItem[]
  isIframe?: boolean
  isSystem?: boolean // 是否是系统管理类菜单
}

// 导航配置 - 图标键与 MainLayout iconMap 一致（@ant-design/icons）
export const navConfig: NavItem[] = [
  {
    key: 'dashboard',
    label: '仪表盘',
    icon: 'DashboardOutlined',
    path: '/dashboard',
    isIframe: true,
  },
  {
    key: 'orders',
    label: '订单管理',
    icon: 'ShoppingCartOutlined',
    path: '/orders',
  },
  {
    key: 'customers',
    label: '客户管理',
    icon: 'TeamOutlined',
    path: '/customers',
    isIframe: true,
  },
  {
    key: 'suppliers',
    label: '供应商管理',
    icon: 'HomeOutlined',
    path: '/suppliers',
    isIframe: true,
  },
  {
    key: 'products',
    label: '产品管理',
    icon: 'InboxOutlined',
    path: '/products',
    isIframe: true,
  },
  {
    key: 'quotation',
    label: '报价核算',
    icon: 'CalculatorOutlined',
    path: '/quotation',
  },
  {
    key: 'logistics',
    label: '物流跟踪',
    icon: 'TruckOutlined',
    path: '/logistics',
  },
  {
    key: 'finance',
    label: '财务管理',
    icon: 'FundOutlined',
    path: '/finance',
    children: [
      {
        key: 'receivable-payable',
        label: '应收应付',
        icon: 'SwapOutlined',
        path: '/finance/receivable-payable',
      },
      {
        key: 'cash-flow',
        label: '银行流水',
        icon: 'DollarOutlined',
        path: '/finance/cash-flow',
      },
      {
        key: 'business-analysis',
        label: '经营分析',
        icon: 'PieChartOutlined',
        path: '/finance/business-analysis',
      },
    ],
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'SettingOutlined',
    path: '/system',
    isSystem: true,
  },
]