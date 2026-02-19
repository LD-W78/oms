import { feishuClient } from '@/lib/feishu/client'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/feishu/records/[id]?tableId=xxx
 * Get a single record
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')
    const recordId = (await params).id

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const record = await feishuClient.getRecord(tableId, recordId)

    return NextResponse.json(record)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch record' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/feishu/records/[id]?tableId=xxx
 * Update a record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')
    const recordId = (await params).id

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    const body = await request.json()
    const { fields } = body

    if (!fields || typeof fields !== 'object') {
      return NextResponse.json({ error: 'fields is required' }, { status: 400 })
    }

    const record = await feishuClient.updateRecord(tableId, recordId, fields)

    return NextResponse.json(record)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update record' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/feishu/records/[id]?tableId=xxx
 * Delete a record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const tableId = searchParams.get('tableId')
    const recordId = (await params).id

    if (!tableId) {
      return NextResponse.json({ error: 'tableId is required' }, { status: 400 })
    }

    await feishuClient.deleteRecord(tableId, recordId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete record' },
      { status: 500 }
    )
  }
}
