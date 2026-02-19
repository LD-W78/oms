/**
 * 订单状态展示配置：状态键、文案、颜色、图标名
 * 与飞书表「进度/商务进度」等单选字段选项对应，新增状态时仅改配置无需改组件
 */
export const ORDER_STATUS_ALL_KEY = 'all' as const

export interface StatusDisplayItem {
  key: string
  label: string
  color: string
  iconBg: string
  icon: string
}

/** 状态键列表（不含 all），用于统计与卡片顺序 */
export const ORDER_STATUS_KEYS: string[] = [
  '报价中',
  '签约中',
  '已签约',
  '已收款',
  '已结款',
  '待退税',
  '已结单',
]

/** 状态展示配置：key -> 文案、颜色、图标背景色、图标名 */
export const ORDER_STATUS_DISPLAY: Record<string, Omit<StatusDisplayItem, 'key'>> = {
  [ORDER_STATUS_ALL_KEY]: {
    label: '全部订单',
    color: '#1976d2',
    iconBg: 'rgba(25, 118, 210, 0.1)',
    icon: 'ShoppingCartOutlined',
  },
  报价中: {
    label: '报价中',
    color: '#6b7280',
    iconBg: 'rgba(107, 114, 128, 0.1)',
    icon: 'FileTextOutlined',
  },
  签约中: {
    label: '签约中',
    color: '#d97706',
    iconBg: 'rgba(217, 119, 6, 0.1)',
    icon: 'FileTextOutlined',
  },
  已签约: {
    label: '已签约',
    color: '#2563eb',
    iconBg: 'rgba(37, 99, 235, 0.1)',
    icon: 'CheckCircleOutlined',
  },
  已收款: {
    label: '已回款',
    color: '#059669',
    iconBg: 'rgba(5, 150, 105, 0.1)',
    icon: 'DollarOutlined',
  },
  已结款: {
    label: '已结清',
    color: '#0891b2',
    iconBg: 'rgba(8, 145, 178, 0.1)',
    icon: 'BankOutlined',
  },
  待退税: {
    label: '待退税',
    color: '#dc2626',
    iconBg: 'rgba(220, 38, 38, 0.1)',
    icon: 'SafetyCertificateOutlined',
  },
  已结单: {
    label: '已结单',
    color: '#4b5563',
    iconBg: 'rgba(75, 85, 99, 0.1)',
    icon: 'FileDoneOutlined',
  },
}

const DEFAULT_STATUS_DISPLAY = {
  label: '',
  color: '#6b7280',
  iconBg: 'rgba(107, 114, 128, 0.1)',
  icon: 'CheckCircleOutlined',
}

/** 根据状态键取展示配置，未知状态返回默认 */
export function getStatusDisplay(key: string): StatusDisplayItem {
  const base = ORDER_STATUS_DISPLAY[key] ?? DEFAULT_STATUS_DISPLAY
  return { key, label: base.label || key, color: base.color, iconBg: base.iconBg, icon: base.icon }
}

/** 表格/标签用：状态 -> 文字色、背景色 */
export function getStatusTagStyle(status: string): { color: string; bg: string } {
  const styleMap: Record<string, { color: string; bg: string }> = {
    报价中: { color: '#6b7280', bg: '#f3f4f6' },
    签约中: { color: '#d97706', bg: '#fef3c7' },
    已签约: { color: '#2563eb', bg: '#dbeafe' },
    已收款: { color: '#059669', bg: '#d1fae5' },
    已结款: { color: '#0891b2', bg: '#cffafe' },
    待退税: { color: '#dc2626', bg: '#fee2e2' },
    已结单: { color: '#4b5563', bg: '#e5e7eb' },
  }
  return styleMap[status] ?? { color: '#6b7280', bg: '#f3f4f6' }
}

/** 选项类字段（货币/报价类型/运输/RITOS 等）按取值着色，同值同色 */
const OPTION_TAG_PALETTE: { color: string; bg: string }[] = [
  { color: '#2563eb', bg: '#dbeafe' },
  { color: '#059669', bg: '#d1fae5' },
  { color: '#d97706', bg: '#fef3c7' },
  { color: '#7c3aed', bg: '#ede9fe' },
  { color: '#dc2626', bg: '#fee2e2' },
  { color: '#0891b2', bg: '#cffafe' },
  { color: '#65a30d', bg: '#ecfccb' },
  { color: '#be185d', bg: '#fce7f3' },
]

export function getOptionTagStyle(value: string): { color: string; bg: string } {
  if (!value) return { color: '#6b7280', bg: '#f3f4f6' }
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash << 5) - hash + value.charCodeAt(i)
  const idx = Math.abs(hash) % OPTION_TAG_PALETTE.length
  return OPTION_TAG_PALETTE[idx]
}
