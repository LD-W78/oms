import { NextResponse } from 'next/server'
import { getTableData } from '@/lib/feishu/table-data'

/** 关闭路由缓存，保证每次请求都拉取最新表数据，避免刷新异常 */
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * 统一表数据 API：按 tableId 返回 schema + 已格式化的 records
 * 供订单/物流/财务等模块共用，保证字段一致、数据一致
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')?.trim()

  if (!tableId) {
    return NextResponse.json(
      { schema: null, records: [], error: 'tableId is required' },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }

  try {
    const { schema, records } = await getTableData(tableId)
    if (!schema) {
      return NextResponse.json(
        { schema: null, records: [], error: 'Schema not found or table not configured' },
        { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      )
    }
    return NextResponse.json(
      { schema, records },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('[api/table] Failed to fetch table data:', error)
    return NextResponse.json(
      { schema: null, records: [], error: error instanceof Error ? error.message : String(error) },
      { status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  }
}
