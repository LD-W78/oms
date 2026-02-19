import { NextResponse } from 'next/server'
import { syncTableSchema, getTableSchema } from '@/lib/feishu/schema'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    
    if (!tableId) {
      return NextResponse.json(
        { success: false, error: 'Table ID is required' },
        { status: 400 }
      )
    }
    
    const schema = await syncTableSchema(tableId)
    
    return NextResponse.json({
      success: true,
      message: `${schema.tableName} Schema已更新`,
      table: {
        tableId: schema.tableId,
        tableName: schema.tableName,
        fieldCount: schema.fields.length,
      },
      updatedAt: schema.syncedAt,
    })
  } catch (error) {
    console.error('Sync table failed:', error)
    return NextResponse.json(
      { success: false, error: '同步失败: ' + String(error) },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> }
) {
  try {
    const { tableId } = await params
    
    if (!tableId) {
      return NextResponse.json(
        { success: false, error: 'Table ID is required' },
        { status: 400 }
      )
    }
    
    const schema = await getTableSchema(tableId)
    
    if (!schema) {
      return NextResponse.json(
        { success: false, error: 'Schema not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      schema,
    })
  } catch (error) {
    console.error('Get schema failed:', error)
    return NextResponse.json(
      { success: false, error: '获取失败: ' + String(error) },
      { status: 500 }
    )
  }
}
