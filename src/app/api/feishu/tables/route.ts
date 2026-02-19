import { feishuClient } from '@/lib/feishu/client'
import { TABLE_IDS } from '@/lib/config/env'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/feishu/tables
 * Get all table schemas
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')

    if (tableId) {
      // Get single table schema
      const schema = await feishuClient.getTableSchema(tableId)
      return NextResponse.json(schema)
    }

    // Return table IDs for reference
    const tables = Object.entries(TABLE_IDS)
      .filter(([_, id]) => id)
      .map(([key, id]) => ({
        key,
        tableId: id,
        name: key.charAt(0).toUpperCase() + key.slice(1),
      }))

    return NextResponse.json({ tables })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tables' },
      { status: 500 }
    )
  }
}
