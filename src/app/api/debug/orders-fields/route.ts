/**
 * Debug: 对比飞书订单表实际字段/数据与当前系统使用的 schema 与 records，定位「数据不完整」原因
 * GET /api/debug/orders-fields
 */
import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { getTableData } from '@/lib/feishu/table-data'
import { getTableSchema } from '@/lib/feishu/schema'
import { TABLE_IDS } from '@/lib/config/env'

export async function GET() {
  const tableId = TABLE_IDS.orders
  if (!tableId) {
    return NextResponse.json({ error: 'Orders table not configured' }, { status: 400 })
  }

  try {
    // 1) 飞书实时：表字段 + 一条记录
    const [feishuSchema, feishuRecords, ourData] = await Promise.all([
      feishuClient.getTableSchema(tableId),
      feishuClient.getRecords(tableId, { pageSize: 1 }),
      getTableData(tableId),
    ])

    const feishuFieldNames = (feishuSchema.fields || []).map((f: { field_name?: string }) => f.field_name)
    const feishuFirstRecordKeys = feishuRecords.items?.[0] ? Object.keys(feishuRecords.items[0].fields || {}) : []
    const ourSchemaFieldCount = ourData.schema?.fields?.length ?? 0
    const ourSchemaFieldNames = (ourData.schema?.fields ?? []).map((f: { fieldName: string }) => f.fieldName)
    const ourFirstRecordFieldKeys = ourData.records?.[0] ? Object.keys(ourData.records[0].fields || {}) : []
    const rawKeysFromOurFirstRecord = ourData.records?.[0]?.raw ? Object.keys(ourData.records[0].raw) : []

    // 2) 差异：飞书 raw 中有、但我们 record.fields 里没有的键（按 dataKey/fieldName 覆盖关系算）
    const ourDataKeysAndNames = new Set<string>()
    ;(ourData.schema?.fields ?? []).forEach((f: { fieldName: string; dataKey?: string }) => {
      ourDataKeysAndNames.add(f.fieldName)
      if (f.dataKey) ourDataKeysAndNames.add(f.dataKey)
    })
    const rawKeysNotInSchema = rawKeysFromOurFirstRecord.filter((k) => !ourDataKeysAndNames.has(k))
    const feishuKeysNotInOurFields = feishuFirstRecordKeys.filter((k) => !ourFirstRecordFieldKeys.includes(k))

    return NextResponse.json({
      success: true,
      tableId,
      comparison: {
        feishu: {
          schemaFieldCount: feishuFieldNames.length,
          schemaFieldNames: feishuFieldNames,
          firstRecordKeysCount: feishuFirstRecordKeys.length,
          firstRecordKeys: feishuFirstRecordKeys,
        },
        ours: {
          schemaFieldCount: ourSchemaFieldCount,
          schemaFieldNames: ourSchemaFieldNames,
          firstRecordFieldsKeysCount: ourFirstRecordFieldKeys.length,
          firstRecordFieldsKeys: ourFirstRecordFieldKeys,
        },
        rawKeysNotInSchema,
        feishuKeysNotInOurFields,
        hasMoreRecords: feishuRecords.has_more,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
