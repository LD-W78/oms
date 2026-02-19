import { NextRequest, NextResponse } from 'next/server'
import { getTableSchema, syncTableSchema } from '@/lib/feishu/schema'
import { log500 } from '@/lib/debug-log'

interface RouteParams {
  params: Promise<{
    tableId: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { tableId } = await params
    
    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      )
    }

    let schema = await getTableSchema(tableId)
    if (!schema) {
      try {
        schema = await syncTableSchema(tableId)
      } catch {
        return NextResponse.json(
          { tableId, tableName: '', fields: [], syncedAt: '', error: 'Schema not found. Sync schema in System > Sync.' },
          { status: 200 }
        )
      }
    }
    return NextResponse.json(schema)
  } catch (error) {
    console.error('Failed to get schema:', error)
    return NextResponse.json(
      { tableId: '', tableName: '', fields: [], syncedAt: '', error: error instanceof Error ? error.message : 'Failed to get schema' },
      { status: 200 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { tableId } = await params
    
    if (!tableId) {
      return NextResponse.json(
        { error: 'Table ID is required' },
        { status: 400 }
      )
    }

    const schema = await syncTableSchema(tableId)
    return NextResponse.json(schema)
  } catch (error) {
    console.error('Failed to sync schema:', error)
    log500('/api/schema/[tableId]', 'POST', error)
    return NextResponse.json(
      { error: 'Failed to sync schema' },
      { status: 500 }
    )
  }
}
