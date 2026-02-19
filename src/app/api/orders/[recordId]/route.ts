import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { log500 } from '@/lib/debug-log'
import { getTableSchema, syncTableSchema } from '@/lib/feishu/schema'
import type { TableSchema } from '@/lib/feishu/types'
import { prepareFieldsForFeishu } from '@/lib/feishu/prepare-fields-for-feishu'
import { TABLE_IDS } from '@/lib/config/env'

export async function PUT(request: Request) {
  const tableId = TABLE_IDS.orders

  if (!tableId) {
    return NextResponse.json(
      { error: 'Orders table not configured' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()
    const { recordId, fields } = body

    if (!recordId || !fields || typeof fields !== 'object') {
      return NextResponse.json(
        { error: 'recordId and fields are required' },
        { status: 400 }
      )
    }

    // Schema 用于写前按类型转换，优先缓存，缺失时再同步
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
        { error: '无法获取数据册，请到「系统管理-数据配置」同步后重试' },
        { status: 503 }
      )
    }
    const fieldsForFeishu = prepareFieldsForFeishu(fields as Record<string, unknown>, schema)
    const fieldKeys = Object.keys(fieldsForFeishu)
    if (fieldKeys.length === 0) {
      return NextResponse.json(
        { error: '没有可更新的字段，请检查表单或数据册配置' },
        { status: 400 }
      )
    }
    const record = await feishuClient.updateRecord(tableId, String(recordId), fieldsForFeishu)

    return NextResponse.json({
      success: true,
      data: record
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const errorText = (message && String(message).trim()) || '更新失败'
    console.error('Failed to update order:', errorText)
    // #region agent log
    log500('/api/orders/[recordId]', 'PUT', error)
    // #endregion
    return NextResponse.json(
      { error: errorText },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const tableId = TABLE_IDS.orders
  
  if (!tableId) {
    return NextResponse.json(
      { error: 'Orders table not configured' },
      { status: 400 }
    )
  }

  try {
    const { recordId } = await params

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId is required' },
        { status: 400 }
      )
    }

    await feishuClient.deleteRecord(tableId, recordId)

    return NextResponse.json({
      success: true,
      message: 'Order deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete order:', error)
    // #region agent log
    log500('/api/orders/[recordId]', 'DELETE', error)
    // #endregion
    return NextResponse.json(
      { error: 'Failed to delete order: ' + String(error) },
      { status: 500 }
    )
  }
}
