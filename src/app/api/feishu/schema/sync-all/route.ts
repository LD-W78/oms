import { NextResponse } from 'next/server'
import { syncAllSchemas, getTableList } from '@/lib/feishu/schema'
import { log500 } from '@/lib/debug-log'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { success, failed, unconfigured } = await syncAllSchemas()

    const response: {
      success: boolean
      message: string
      tables: Array<{
        tableId: string
        tableName: string
        fieldCount: number
        lastSyncedAt: string
        status: '已同步' | '未同步' | '未配置'
      }>
      failed?: Array<{ tableName: string; error: string }>
      unconfigured?: Array<{ tableName: string }>
    } = {
      success: failed.length === 0,
      message: `已同步 ${success.length} 个表${failed.length > 0 ? `，${failed.length} 个表失败` : ''}${unconfigured.length > 0 ? `，${unconfigured.length} 个表未配置` : ''}`,
      tables: [
        ...success.map(s => ({
          tableId: s.tableId,
          tableName: s.tableName,
          fieldCount: s.fields.length,
          lastSyncedAt: new Date(s.syncedAt).toLocaleString('zh-CN'),
          status: '已同步' as const,
        })),
        ...failed.map(f => ({
          tableId: f.tableId,
          tableName: f.tableName,
          fieldCount: 0,
          lastSyncedAt: `错误: ${f.error}`,
          status: '未同步' as const,
        })),
        ...unconfigured.map(u => ({
          tableId: u.key,
          tableName: u.tableName,
          fieldCount: 0,
          lastSyncedAt: '请配置表ID',
          status: '未配置' as const,
        })),
      ],
    }

    if (failed.length > 0) {
      response.failed = failed.map(f => ({ tableName: f.tableName, error: f.error }))
    }

    if (unconfigured.length > 0) {
      response.unconfigured = unconfigured.map(u => ({ tableName: u.tableName }))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Sync all schemas failed:', error)
    log500('/api/feishu/schema/sync-all', 'POST', error)
    return NextResponse.json(
      { success: false, error: '同步失败: ' + String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const tables = await getTableList()
    
    return NextResponse.json({
      success: true,
      tables,
    })
  } catch (error) {
    console.error('Get table list failed:', error)
    log500('/api/feishu/schema/sync-all', 'GET', error)
    return NextResponse.json(
      { success: false, error: '获取失败: ' + String(error) },
      { status: 500 }
    )
  }
}
