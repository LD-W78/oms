import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { getTableSchema } from '@/lib/feishu/schema'
import { TABLE_IDS } from '@/lib/config/env'

export async function GET() {
  const tableId = TABLE_IDS.orders
  
  if (!tableId) {
    return NextResponse.json(
      { error: 'Orders table not configured' },
      { status: 400 }
    )
  }

  try {
    const [schema, records] = await Promise.all([
      getTableSchema(tableId),
      feishuClient.getRecords(tableId, { pageSize: 1 })
    ])

    if (!schema) {
      return NextResponse.json(
        { error: 'Schema not found' },
        { status: 404 }
      )
    }

    const sampleRecord = records.items[0]
    const actualFields = sampleRecord ? Object.keys(sampleRecord.fields || {}) : []

    const fieldComparison = schema.fields.map(field => ({
      fieldName: field.fieldName,
      fieldId: field.fieldId,
      fieldType: field.fieldType,
      uiType: field.uiType,
      existsInRecord: actualFields.includes(field.fieldName),
      sampleValue: sampleRecord?.fields?.[field.fieldName] ?? null
    }))

    return NextResponse.json({
      success: true,
      data: {
        tableId,
        tableName: schema.tableName,
        totalSchemaFields: schema.fields.length,
        totalRecordFields: actualFields.length,
        schemaFields: schema.fields.map(f => ({
          name: f.fieldName,
          type: f.fieldType,
          uiType: f.uiType
        })),
        recordFields: actualFields,
        fieldComparison,
        sampleRecord: sampleRecord?.fields || null
      }
    })
  } catch (error) {
    console.error('Failed to verify fields:', error)
    return NextResponse.json(
      { error: 'Failed to verify fields: ' + String(error) },
      { status: 500 }
    )
  }
}
