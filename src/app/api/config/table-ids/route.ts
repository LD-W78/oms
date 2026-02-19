import { NextResponse } from 'next/server'

/**
 * 服务端表 ID 配置，供前端在未配置 NEXT_PUBLIC_ 时获取订单表等 tableId
 * 仅返回表 ID，不包含密钥等敏感信息
 */
export async function GET() {
  try {
    const orders = process.env.FEISHU_TABLE_ORDERS ?? process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS ?? null
    const cashFlow = process.env.FEISHU_TABLE_CASH_FLOW ?? process.env.NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW ?? null
    const finance = process.env.FEISHU_TABLE_FINANCE ?? process.env.NEXT_PUBLIC_FEISHU_TABLE_FINANCE ?? null
    return NextResponse.json({
      orders: orders || null,
      cashFlow: cashFlow || null,
      finance: finance || null,
    })
  } catch (e) {
    console.error('[api/config/table-ids]', e)
    return NextResponse.json(
      { orders: null, cashFlow: null, finance: null },
      { status: 200 }
    )
  }
}
