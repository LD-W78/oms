import { feishuClient } from './client'
import { TABLE_IDS } from '@/lib/config/env'
import { getTableData, tableRecordToParsedOrder } from './table-data'
import { isFormulaValue } from './formula-parser'

export interface Order {
  id: string
  recordId: string
  customer: string
  product: string
  mts: string
  amount: string
  contractDate: string
  status: '签约中' | '已签约' | '已收款' | '已结款' | '待退税' | '已退税'
  hasFormula?: boolean
  ritos?: string
  [key: string]: unknown
}

export type { OrderStats } from './order-stats'
import { getOrderStats as getOrderStatsSync } from './order-stats'

export interface ParsedOrder extends Order {
  _raw: Record<string, unknown>
  _parsed: Record<string, {
    raw: unknown
    parsed: unknown
    formatted: string
    isFormula: boolean
    isEmpty: boolean
  }>
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function parseFeishuAmount(amount: unknown): string {
  const str = safeString(amount)
  if (!str) return '¥0'
  if (str.includes('¥') || str.includes('￥')) return str
  const num = parseFloat(str.replace(/[^0-9.-]/g, ''))
  if (isNaN(num)) return '¥0'
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseFeishuDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'number') {
    const d = new Date(date)
    return d.toISOString().split('T')[0]
  }
  const str = safeString(date)
  if (!str) return ''
  return str.split(' ')[0] || ''
}

function parseCustomer(value: unknown): string {
  if (!value) return ''
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (typeof first === 'object' && first !== null) {
      return (first as Record<string, unknown>).text as string || 
             (first as Record<string, unknown>).name as string || ''
    }
  }
  return safeString(value)
}

function parseStatus(status: unknown): Order['status'] {
  const str = safeString(status).trim()
  const statusMap: Record<string, Order['status']> = {
    '签约中': '签约中',
    '已签约': '已签约',
    '已收款': '已收款',
    '已回款': '已收款',
    '已结清': '已结款',
    '已结单': '已结款',
    '已结款': '已结款',
    '待退税': '待退税',
    '已退税': '已退税',
  }
  return statusMap[str] || '签约中'
}

function getFieldValue(fields: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (fields && typeof fields === 'object' && key in fields) {
      const value = fields[key]
      if (value !== null && value !== undefined && value !== '') {
        return value
      }
    }
  }
  return null
}

export async function getOrders(): Promise<ParsedOrder[]> {
  const tableId = TABLE_IDS.orders
  if (!tableId) {
    console.warn('FEISHU_TABLE_ORDERS not configured, returning empty array')
    return []
  }
  try {
    const { records } = await getTableData(tableId)
    return records.map((r) => tableRecordToParsedOrder(r) as ParsedOrder)
  } catch (error) {
    console.error('Failed to fetch orders from Feishu:', error)
    return []
  }
}

export async function getOrderStats(orders: Order[]): Promise<import('./order-stats').OrderStats> {
  return getOrderStatsSync(orders)
}

export async function createOrder(fields: Record<string, unknown>): Promise<Order | null> {
  const tableId = TABLE_IDS.orders
  if (!tableId) {
    console.warn('FEISHU_TABLE_ORDERS not configured')
    return null
  }

  try {
    const record = await feishuClient.createRecord(tableId, fields)
    return {
      id: safeString(getFieldValue(fields, '订单号', 'order_id')) || record.record_id || '',
      recordId: record.record_id || '',
      customer: parseCustomer(getFieldValue(fields, '客户', 'customer')),
      product: safeString(getFieldValue(fields, '产品', 'product')) || '',
      mts: safeString(getFieldValue(fields, 'MTs', 'mts', '数量', '数量(MTS)')) || '',
      amount: parseFeishuAmount(getFieldValue(fields, '订单金额CNY', '订单金额', 'amount')),
      contractDate: parseFeishuDate(getFieldValue(fields, '签约日', '签约日期', 'contractDate')),
      status: parseStatus(getFieldValue(fields, '进度', '商务进度', 'status', '业务状态')),
    }
  } catch (error) {
    console.error('Failed to create order:', error)
    throw error
  }
}

export { isFormulaValue }
