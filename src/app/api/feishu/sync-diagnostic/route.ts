import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 同步诊断：逐步测试飞书 API 连通性，返回详细错误便于排查 Vercel 部署同步失败
 */
export async function GET() {
  const steps: Array<{ step: string; ok: boolean; message?: string }> = []

  try {
    const baseUrl = (process.env.FEISHU_BASE_URL || 'https://open.feishu.cn/open-apis').trim()
    const appId = (process.env.FEISHU_APP_ID || '').trim()
    const appSecret = (process.env.FEISHU_APP_SECRET || '').trim()
    const baseToken = (process.env.FEISHU_BASE_APP_TOKEN || '').trim()
    const tableOrders = (process.env.FEISHU_TABLE_ORDERS || process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS || '').trim()

    if (!appId || !appSecret) {
      steps.push({ step: '环境变量', ok: false, message: 'FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置' })
      return NextResponse.json({ steps, summary: '请检查 Vercel 环境变量' })
    }
    steps.push({ step: '环境变量', ok: true, message: `APP_ID/APP_SECRET/BASE_TOKEN 已配置，表ID: ${tableOrders ? '已配置' : '未配置'}` })

    const tokenRes = await fetch(`${baseUrl}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    })
    const tokenData = (await tokenRes.json()) as { code?: number; msg?: string; app_access_token?: string }
    if (tokenData.code !== 0 || !tokenData.app_access_token) {
      steps.push({ step: '获取 Token', ok: false, message: tokenData.msg || `code: ${tokenData.code}` })
      return NextResponse.json({ steps, summary: 'Token 获取失败' })
    }
    steps.push({ step: '获取 Token', ok: true })

    if (!baseToken) {
      steps.push({ step: '多维表格', ok: false, message: 'FEISHU_BASE_APP_TOKEN 未配置' })
      return NextResponse.json({ steps, summary: '请配置 BASE_APP_TOKEN' })
    }

    const tablesUrl = `${baseUrl}/bitable/v1/apps/${baseToken}/tables`
    const tablesRes = await fetch(tablesUrl, {
      headers: { Authorization: `Bearer ${tokenData.app_access_token}` },
    })
    const tablesData = (await tablesRes.json()) as { code?: number; msg?: string; data?: { items?: Array<{ table_id: string; name?: string }> } }

    if (tablesData.code != null && tablesData.code !== 0) {
      steps.push({
        step: '获取表列表',
        ok: false,
        message: tablesData.msg || `code: ${tablesData.code}。若为 1254003/1254040，请检查 BASE_APP_TOKEN 是否与多维表格匹配；若为权限错误，请在飞书开放平台为应用开通「多维表格」权限，并在表格中「添加文档应用」`,
      })
      return NextResponse.json({ steps, summary: '表列表获取失败' })
    }

    const items = tablesData.data?.items ?? []
    const tableIds = items.map((t) => t.table_id)
    const hasOrders = tableOrders && tableIds.includes(tableOrders)

    steps.push({
      step: '获取表列表',
      ok: true,
      message: `共 ${items.length} 个表，订单表 ${tableOrders} ${hasOrders ? '已找到' : '未找到'}`,
    })

    if (!hasOrders && tableOrders) {
      steps.push({
        step: '表匹配',
        ok: false,
        message: `表 ${tableOrders} 不在当前 base 中。请确认 FEISHU_BASE_APP_TOKEN 与表所属的多维表格一致（在飞书表格 URL 中可查看）`,
      })
      return NextResponse.json({ steps, summary: '表 ID 与 BASE_TOKEN 不匹配' })
    }

    return NextResponse.json({
      steps,
      summary: '诊断通过，同步应可正常执行',
    })
  } catch (e) {
    steps.push({ step: '异常', ok: false, message: String(e) })
    return NextResponse.json({
      steps,
      summary: '诊断过程发生异常',
    })
  }
}
