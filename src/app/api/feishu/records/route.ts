import { feishuClient } from '@/lib/feishu/client'
import { NextRequest, NextResponse } from 'next/server'
import { log500 } from '@/lib/debug-log'

/**
 * GET /api/feishu/records?tableId=xxx
 * Get records from a table
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')
    const pageSize = searchParams.get('pageSize')
    const pageToken = searchParams.get('pageToken')
    const filter = searchParams.get('filter')

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const result = await feishuClient.getRecords(tableId, {
      pageSize: pageSize ? parseInt(pageSize) : 100,
      pageToken: pageToken || undefined,
      filter: filter || undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', error)
    // #region agent log
    log500('/api/feishu/records', 'GET', error)
    // #endregion
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch records' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/feishu/records?tableId=xxx
 * Create a new record
 */
export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const body = await request.json()
    const { fields } = body

    if (!fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'fields is required' }, { status: 400 })
    }

    const record = await feishuClient.createRecord(tableId, fields)

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('API Error:', error)
    // #region agent log
    log500('/api/feishu/records', 'POST', error)
    // #endregion
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create record' },
      { status: 500 }
    )
  }
}
