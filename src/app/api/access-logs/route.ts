import { NextRequest, NextResponse } from 'next/server'
import { getAccessLogs, updateLogoutLog } from '@/lib/access-log'

export async function GET(): Promise<NextResponse> {
  try {
    const logs = await getAccessLogs()
    return NextResponse.json({ logs })
  } catch (e) {
    console.error('[api/access-logs] GET', e)
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action, logId } = body

    if (action === 'logout' && logId) {
      await updateLogoutLog(logId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[api/access-logs] POST', e)
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 })
  }
}
