/**
 * Debug: 通过数据层写入一条测试记录（订单号=1001、签约日=2026/03/04、订单金额=1000）
 * GET /api/debug/create-order-test
 */
import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { getTableSchema, syncTableSchema } from '@/lib/feishu/schema'
import type { TableSchema } from '@/lib/feishu/types'
import { prepareFieldsForFeishu } from '@/lib/feishu/prepare-fields-for-feishu'
import { TABLE_IDS } from '@/lib/config/env'

export async function GET() {
  const tableId = TABLE_IDS.orders
  if (!tableId) {
    return NextResponse.json(
      { success: false, error: 'TABLE_IDS.orders 未配置' },
      { status: 400 }
    )
  }

  try {
    let schema: TableSchema | null | undefined = await getTableSchema(tableId)
    if (!schema) {
      try {
        schema = await syncTableSchema(tableId)
      } catch {
        schema = (await getTableSchema(tableId)) ?? null
      }
    }
    if (!schema?.fields?.length) {
      return NextResponse.json(
        { success: false, error: '无法获取数据册', tableId },
        { status: 503 }
      )
    }

    const body: Record<string, unknown> = {
      订单号: '1001',
      签约日: new Date('2026/03/04').getTime(),
      订单金额: 1000,
    }
    const prepared = prepareFieldsForFeishu(body, schema)
    if (Object.keys(prepared).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'prepareFieldsForFeishu 后无字段',
        tableId,
      })
    }

    const record = await feishuClient.createRecord(tableId, prepared)
    return NextResponse.json({
      success: true,
      tableId,
      recordId: record.record_id,
      preparedKeys: Object.keys(prepared),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[create-order-test]', err)
    return NextResponse.json(
      { success: false, error: message, tableId },
      { status: 500 }
    )
  }
}
