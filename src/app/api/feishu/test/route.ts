import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { appId, appSecret, appToken } = await request.json()

    if (!appId || !appSecret) {
      return NextResponse.json(
        { success: false, error: '缺少App ID或App Secret' },
        { status: 400 }
      )
    }

    // 测试飞书连接（使用环境变量 FEISHU_BASE_URL，符合禁止硬编码 URL 规范）
    const baseUrl = process.env.FEISHU_BASE_URL || 'https://open.feishu.cn/open-apis'
    const tokenResponse = await fetch(`${baseUrl}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    })

    if (!tokenResponse.ok) {
      return NextResponse.json(
        { success: false, error: '获取Token失败: ' + tokenResponse.statusText },
        { status: 400 }
      )
    }

    const tokenData = await tokenResponse.json()
    
    if (tokenData.code !== 0) {
      return NextResponse.json(
        { success: false, error: 'Token获取失败: ' + tokenData.msg },
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
