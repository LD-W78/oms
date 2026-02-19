/**
 * 订单统计纯函数，可在服务端与前端复用，无飞书依赖
 * 支持动态状态列表（由 order-status.config 提供）
 */

export interface OrderStatItem {
  count: number
  /** 订单金额CNY 合计（¥） */
  amount: string
  /** 全部订单中 货币=USD 的「订单金额」合计，用于「其中 $aaa」 */
  amountOriginal?: string
}

export interface OrderStats {
  all: OrderStatItem
  [status: string]: OrderStatItem
}

export interface OrderForStats {
  id?: string
  status?: string
  amount?: string
  amountCNY?: string
  _raw?: Record<string, unknown>
  [key: string]: unknown
}

/** 飞书进度值与卡片状态键统一（已回款→已收款、已结清/已结单→已结款、已退→已退税、含报价中→报价中），供统计与表格筛选共用 */
export function normalizeStatus(status: string): string {
  const s = String(status ?? '').trim()
  if (s.includes('报价中')) return '报价中'
  const map: Record<string, string> = {
    已回款: '已收款',
    已结清: '已结款',
    已退: '已退税',
  }
  return map[s] ?? s
}

/** 从订单对象解析进度（优先 dataKey 'status'，兼容 _raw 中的 'status' 或 '进度'） */
export function getOrderStatus(order: OrderForStats): string {
  const raw = order.status ?? (order._raw && (order._raw['status'] ?? order._raw['进度']))
  return normalizeStatus(String(raw ?? '').trim())
}

/** 仅统计「订单金额CNY」合计（与 field-mapping dataKey 'amountCNY' 一致） */
function getOrderAmountCNY(order: OrderForStats): string {
  const raw = order.amountCNY ?? (order._raw && (order._raw['amountCNY'] ?? order._raw['订单金额CNY']))
  return String(raw ?? '').trim() || '¥0'
}

/** 是否货币=USD（与 field-mapping dataKey 'currency' 一致） */
function isCurrencyUSD(order: OrderForStats): boolean {
  const raw = order.currency ?? (order._raw && (order._raw['currency'] ?? order._raw['货币']))
  const s = String(raw ?? '').trim().toUpperCase()
  return s === 'USD' || s.includes('USD')
}

/** 订单金额原币（与 field-mapping dataKey 'amount' 一致），用于「其中」条件统计 */
function getOrderAmountOriginal(order: OrderForStats): string {
  const raw = order.amount ?? (order._raw && (order._raw['amount'] ?? order._raw['订单金额']))
  return String(raw ?? '').trim() || '0'
}

/** 默认状态键（与 order-status.config 保持一致），调用方可传入自定义列表 */
const DEFAULT_STATUS_KEYS = [
  '报价中',
  '签约中',
  '已签约',
  '已收款',
  '已结款',
  '待退税',
  '已结单',
]

/** 金额格式：千分位 + 两位小数（人民币） */
function formatAmount(num: number): string {
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 订单金额展示（美元），用于「其中 $aaa」 */
function formatAmountOriginal(num: number): string {
  if (num === 0) return ''
  return `$${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface GetOrderStatsOptions {
  /** 统计「全部」时排除的进度值；例如 ['报价中','签约中'] 表示全部 = 排除进度为报价中或签约中的订单 */
  allExcludeStatuses?: string[]
}

/**
 * 按字段「进度」分别统计：每状态订单数 + 合计「订单金额CNY」
 * 全部订单：不加筛选，条数=所有订单数，主金额=全量「订单金额CNY」合计，括号=货币=USD 的「订单金额」合计（$）
 */
export function getOrderStats(
  orders: OrderForStats[],
  statusKeys: string[] = DEFAULT_STATUS_KEYS,
  options?: GetOrderStatsOptions
): OrderStats {
  const all: OrderStatItem = { count: 0, amount: '¥0.00' }
  const statusAmounts: Record<string, number> = { all: 0 }
  const statusCounts: Record<string, number> = { all: 0 }
  const excludeSet = new Set(options?.allExcludeStatuses ?? [])
  statusKeys.forEach((k) => {
    statusAmounts[k] = 0
    statusCounts[k] = 0
  })
  /** 各状态卡片：该状态下 货币=USD 的「订单金额」合计（用于第二行「其中 $xxx」） */
  const statusAmountsUsd: Record<string, number> = {}
  statusKeys.forEach((k) => { statusAmountsUsd[k] = 0 })

  /** 1. 全部卡片主金额：直接统计「订单金额CNY」合计（包含报价中） */
  let allAmountCNYTotal = 0
  /** 2. 全部卡片第二行：货币=USD 时「订单金额」的合计 */
  let allAmountUsd = 0

  orders.forEach((order) => {
    if (order.id == null || order.id === '') return
    const status = getOrderStatus(order) || statusKeys[0] || '签约中'
    const amountStr = getOrderAmountCNY(order)
    const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
    const countInAll = excludeSet.size === 0 || !excludeSet.has(status)
    allAmountCNYTotal += amount
    if (countInAll) {
      all.count++
      statusAmounts.all += amount
    }
    if (isCurrencyUSD(order)) {
      const orig = parseFloat(getOrderAmountOriginal(order).replace(/[^0-9.-]/g, '')) || 0
      allAmountUsd += orig
      if (statusAmountsUsd[status] === undefined) statusAmountsUsd[status] = 0
      statusAmountsUsd[status] += orig
    }
    if (!statusAmounts.hasOwnProperty(status)) {
      statusAmounts[status] = 0
      statusCounts[status] = 0
    }
    statusAmounts[status] += amount
    statusCounts[status] += 1
  })

  all.amount = formatAmount(allAmountCNYTotal)
  const allAmountOriginal = formatAmountOriginal(allAmountUsd)
  const stats: OrderStats = {
    all: {
      count: all.count,
      amount: all.amount,
      amountOriginal: allAmountOriginal || '$0.00',
    },
  }
  Object.keys(statusAmounts).forEach((key) => {
    if (key === 'all') return
    const amt = statusAmounts[key] ?? 0
    const amtUsd = statusAmountsUsd[key] ?? 0
    stats[key] = {
      count: statusCounts[key] ?? 0,
      amount: formatAmount(amt),
      amountOriginal: formatAmountOriginal(amtUsd) || '$0.00',
    }
  })
  statusKeys.forEach((key) => {
    if (!stats[key]) stats[key] = { count: 0, amount: '¥0.00' }
  })
  return stats
}
