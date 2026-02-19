/**
 * 数据层完整性检查：对比「飞书原始拉取」与「getTableData 输出」
 * 用于判断显示不完整是数据层获取不全，还是格式化/页面使用问题。
 * GET /api/debug/data-layer-check?tableId=xxx （不传则用订单表）
 */
import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { getTableData } from '@/lib/feishu/table-data'
import { TABLE_IDS } from '@/lib/config/env'

export async function GET(request: Request) {
  let defaultTableId = ''
  try {
    defaultTableId = TABLE_IDS.orders ?? ''
  } catch {
    // env 解析失败时不影响返回
  }
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')?.trim() || defaultTableId

  if (!tableId) {
    return NextResponse.json(
      {
        success: false,
        error: 'tableId required',
        hint: 'Set env FEISHU_TABLE_ORDERS or use ?tableId=你的多维表格ID',
        urlExample: 'http://localhost:3000/api/debug/data-layer-check?tableId=tblxxxx',
      },
      { status: 200 }
    )
  }

  try {
    // 1) 直接从飞书拉：schema + records（与 getTableData 内一致 pageSize: 500）
    const [feishuSchema, feishuRecords] = await Promise.all([
      feishuClient.getTableSchema(tableId),
      feishuClient.getRecords(tableId, { pageSize: 500 }),
    ])
    const feishuItems = feishuRecords.items || []
    const feishuFirstFields = feishuItems[0]?.fields || {}
    const feishuFirstRecordKeys = Object.keys(feishuFirstFields)
    const feishuSchemaFieldNames = (feishuSchema.fields || []).map(
      (f: { field_name?: string }) => f.field_name
    )

    // 2) 经数据层：getTableData（内部会 syncSchema + getRecords + processRecord）
    const { schema: ourSchema, records: ourRecords } = await getTableData(tableId)
    const ourFirstRecord = ourRecords[0]
    const ourFirstRecordFieldsKeys = ourFirstRecord
      ? Object.keys(ourFirstRecord.fields || {})
      : []
    const ourFirstRecordRawKeys = ourFirstRecord?.raw
      ? Object.keys(ourFirstRecord.raw).filter((k) => k !== 'recordId' && k !== 'record_id')
      : []

    const feishuRecordCount = feishuItems.length
    const ourRecordCount = ourRecords.length
    const feishuSchemaFieldCount = feishuSchemaFieldNames.length
    const ourSchemaFieldCount = ourSchema?.fields?.length ?? 0

    // 3) 判定
    const feishuKeysSet = new Set(feishuFirstRecordKeys)
    const ourRawHasAllFeishuKeys =
      feishuFirstRecordKeys.length === 0 ||
      feishuFirstRecordKeys.every((k) => ourFirstRecordRawKeys.includes(k))
    const rowComplete = feishuRecordCount === ourRecordCount
    const rawComplete = ourRawHasAllFeishuKeys && ourFirstRecordRawKeys.length >= feishuFirstRecordKeys.length
    const schemaComplete = ourSchemaFieldCount >= feishuSchemaFieldCount
    const formattedComplete =
      ourSchemaFieldCount > 0 &&
      ourFirstRecordFieldsKeys.length === ourSchemaFieldCount

    const summary = {
      /** 飞书原始：条数、是否有下一页、首条字段数、schema 字段数 */
      feishu: {
        recordCount: feishuRecordCount,
        hasMore: feishuRecords.has_more ?? false,
        firstRecordKeysCount: feishuFirstRecordKeys.length,
        firstRecordKeys: feishuFirstRecordKeys,
        schemaFieldCount: feishuSchemaFieldCount,
        schemaFieldNames: feishuSchemaFieldNames,
      },
      /** 数据层输出：条数、首条 record.fields 键数、首条 record.raw 键数、schema 字段数 */
      dataLayer: {
        recordCount: ourRecordCount,
        firstRecordFieldsKeysCount: ourFirstRecordFieldsKeys.length,
        firstRecordFieldsKeys: ourFirstRecordFieldsKeys,
        firstRecordRawKeysCount: ourFirstRecordRawKeys.length,
        firstRecordRawKeys: ourFirstRecordRawKeys,
        schemaFieldCount: ourSchemaFieldCount,
      },
      /** 结论 */
      verdict: {
        /** 行数是否一致（数据层拿到的条数 = 飞书返回条数） */
        rowComplete,
        /** 首条 raw 是否包含飞书首条全部字段（原始数据是否完整保留） */
        rawComplete,
        /** 数据层 schema 字段数是否不少于飞书 */
        schemaComplete,
        /** 首条 record.fields 键数是否 = schema 字段数（格式化是否输出全部 schema 列） */
        formattedComplete,
      },
      /** 若 raw 完整但页面仍不完整，则问题在格式化或页面；若 raw 不完整则问题在获取 */
      message:
        !rowComplete
          ? '行数不一致：可能未分页或拉取失败'
          : !rawComplete
            ? '原始字段不完整：数据层从飞书获取或写入 raw 时丢失'
            : !schemaComplete
              ? 'Schema 不完整：同步的 schema 少于飞书表字段'
              : !formattedComplete
                ? '格式化不完整：record.fields 列数少于 schema'
                : '数据层获取与格式化均完整，若页面仍不完整请检查页面/列配置',
    }

    return NextResponse.json({
      success: true,
      tableId,
      ...summary,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[data-layer-check]', tableId, err)
    return NextResponse.json(
      { success: false, error: message, tableId },
      { status: 500 }
    )
  }
}
