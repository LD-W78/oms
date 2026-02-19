import { NextResponse } from 'next/server'
import { getOrders, getOrderStats, createOrder } from '@/lib/feishu/orders'
import { log500 } from '@/lib/debug-log'
import { getTableSchema, syncTableSchema } from '@/lib/feishu/schema'
import type { TableSchema } from '@/lib/feishu/types'
import { prepareFieldsForFeishu } from '@/lib/feishu/prepare-fields-for-feishu'
import { TABLE_IDS } from '@/lib/config/env'
import { ORDER_STATUS_KEYS } from '@/lib/config/order-status.config'

function buildEmptyStats() {
  const base: Record<string, { count: number; amount: string }> = {
    all: { count: 0, amount: '¥0' },
  }
  ORDER_STATUS_KEYS.forEach((k) => {
    base[k] = { count: 0, amount: '¥0' }
  })
  return base
}
const emptyStats = buildEmptyStats()

export async function GET() {
  try {
    const tableId = TABLE_IDS.orders
    if (!tableId) {
      return NextResponse.json({ orders: [], stats: emptyStats, error: 'Orders table not configured' }, { status: 200 })
    }
    const orders = await getOrders()
    const stats = await getOrderStats(orders)
    return NextResponse.json({ orders, stats })
  } catch (error) {
    console.error('Failed to fetch orders:', error)
    return NextResponse.json(
      { orders: [], stats: emptyStats, error: error instanceof Error ? error.message : String(error) },
      { status: 200 }
    )
  }
}

export async function POST(request: Request) {
  const tableId = TABLE_IDS.orders
  
  if (!tableId) {
    return NextResponse.json(
      { error: 'Orders table not configured' },
      { status: 400 }
    )
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    // Schema 用于写前按类型转换（数字/日期/公式过滤等），优先缓存，缺失时再同步
    let schema: TableSchema | null | undefined = await getTableSchema(tableId)
    if (!schema) {
      try {
        schema = await syncTableSchema(tableId)
      } catch {
        schema = (await getTableSchema(tableId)) ?? null
      }
    }
    const fields = prepareFieldsForFeishu(body, schema ?? null)
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: '没有可提交的字段，请检查表单或数据册配置' },
        { status: 400 }
      )
    }
    const order = await createOrder(fields)

    if (!order) {
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: order
    })
  } catch (error) {
    console.error('Failed to create order:', error)
    // #region agent log
    log500('/api/orders', 'POST', error)
    // #endregion
    return NextResponse.json(
      { error: 'Failed to create order: ' + String(error) },
      { status: 500 }
    )
  }
}
