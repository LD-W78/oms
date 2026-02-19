import type { ReactNode } from 'react'

export interface NavItem {
  key: string
  label: string
  icon: string
  path: string
  children?: NavItem[]
  /** 是否为系统菜单（显示在侧栏底部） */
  isSystem?: boolean
}

export const navConfig: NavItem[] = [
  {
    key: 'dashboard',
    label: '首页',
    icon: 'DashboardOutlined',
    path: '/dashboard',
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
    icon: 'UserOutlined',
    path: '/customers',
  },
  {
    key: 'products',
    label: '产品管理',
    icon: 'InboxOutlined',
    path: '/products',
  },
  {
    key: 'suppliers',
    label: '供应商',
    icon: 'TeamOutlined',
    path: '/suppliers',
  },
  {
    key: 'quotation',
    label: '报价管理',
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
      { key: 'receivable-payable', label: '应收应付', icon: 'SwapOutlined', path: '/finance/receivable-payable' },
      { key: 'cash-flow', label: '银行流水', icon: 'DollarOutlined', path: '/finance/cash-flow' },
      { key: 'business-analysis', label: '经营分析', icon: 'PieChartOutlined', path: '/finance/business-analysis' },
    ],
  },
  {
    key: 'feishu-sheet',
    label: '飞书表格',
    icon: 'TableOutlined',
    path: '/feishu-sheet',
  },
  {
    key: 'system',
    label: '系统管理',
    icon: 'SettingOutlined',
    path: '/system',
    isSystem: true,
  },
]

export const iconMapping: Record<string, ReactNode> = {}

/** 所有可配置的模块 key（用于用户权限配置） */
export const MODULE_KEYS: { key: string; label: string }[] = [
  { key: 'dashboard', label: '首页' },
  { key: 'orders', label: '订单管理' },
  { key: 'customers', label: '客户管理' },
  { key: 'products', label: '产品管理' },
  { key: 'suppliers', label: '供应商' },
  { key: 'quotation', label: '报价管理' },
  { key: 'logistics', label: '物流跟踪' },
  { key: 'finance.receivable-payable', label: '应收应付' },
  { key: 'finance.cash-flow', label: '银行流水' },
  { key: 'finance.business-analysis', label: '经营分析' },
  { key: 'feishu-sheet', label: '飞书表格' },
  { key: 'system', label: '系统管理' },
]
