import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { log500 } from '@/lib/debug-log'
import { getTableSchema } from '@/lib/feishu/schema'
import { TABLE_IDS } from '@/lib/config/env'

const ROUTE_TO_TABLE_ID: Record<string, string | undefined> = {
  '/orders': TABLE_IDS.orders,
  // 物流跟踪模块使用订单表数据
  '/logistics': TABLE_IDS.orders,
  '/finance/receivable-payable': TABLE_IDS.finance,
  '/finance/cash-flow': TABLE_IDS.cashFlow,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const route = searchParams.get('route')

  if (!route) {
    return NextResponse.json(
      { error: 'Route is required' },
      { status: 400 }
    )
  }

  const tableId = ROUTE_TO_TABLE_ID[route]
  
  if (!tableId) {
    return NextResponse.json(
      { error: 'Table not configured for this route' },
      { status: 400 }
    )
  }

  try {
    const [schema, records] = await Promise.all([
      getTableSchema(tableId),
      feishuClient.getRecords(tableId, { pageSize: 500 })
    ])

    const fieldNameToId: Record<string, string> = {}
    if (schema?.fields) {
      schema.fields.forEach(field => {
        fieldNameToId[field.fieldName] = field.fieldId
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        records: records.items.map(record => record.fields || {}),
        schema: schema,
        fieldNameToId,
      }
    })
  } catch (error) {
    console.error('Failed to fetch table data:', error)
    // #region agent log
    log500('/api/table-data', 'GET', error)
    // #endregion
    return NextResponse.json(
      { error: 'Failed to fetch data: ' + String(error) },
      { status: 500 }
    )
  }
}
