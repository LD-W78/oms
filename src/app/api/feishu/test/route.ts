import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // 直接使用服务端环境变量，避免客户端传入空值导致 400
    const appId = process.env.FEISHU_APP_ID
    const appSecret = process.env.FEISHU_APP_SECRET

    if (!appId || !appSecret) {
      return NextResponse.json(
        { success: false, error: '缺少App ID或App Secret，请在 Vercel 环境变量中配置 FEISHU_APP_ID 和 FEISHU_APP_SECRET' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.FEISHU_BASE_URL || 'https://open.feishu.cn/open-apis'
    const tokenResponse = await fetch(`${baseUrl}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId.trim(),
        app_secret: appSecret.trim()
      })
    })

    const tokenData = await tokenResponse.json().catch(() => ({})) as { code?: number; msg?: string; expire?: number }

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { success: false, error: '获取Token失败: ' + (tokenData.msg || tokenResponse.statusText) },
        { status: 400 }
      )
    }

    if (tokenData.code !== 0) {
      return NextResponse.json(
        { success: false, error: 'Token获取失败: ' + (tokenData.msg || '未知错误') },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '飞书连接正常',
      tokenExpiresIn: tokenData.expire
    })

  } catch (error) {
    console.error('Test connection failed:', error)
    return NextResponse.json(
      { success: false, error: '连接测试失败: ' + String(error) },
      { status: 500 }
    )
  }
}
