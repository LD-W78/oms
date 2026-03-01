import { NextResponse } from 'next/server'

/**
 * 飞书配置（服务端读取 .env），供系统管理/飞书配置页面展示
 * 包含现金表独立 Base Token 等仅服务端可读的配置
 */
export async function GET() {
  try {
    const config = {
      appId: process.env.FEISHU_APP_ID || process.env.NEXT_PUBLIC_FEISHU_APP_ID || '',
      appSecret: process.env.FEISHU_APP_SECRET || process.env.NEXT_PUBLIC_FEISHU_APP_SECRET || '',
      appToken: process.env.FEISHU_BASE_APP_TOKEN || process.env.NEXT_PUBLIC_FEISHU_APP_TOKEN || '',
      cashFlowBaseToken: process.env.FEISHU_CASH_FLOW_BASE_TOKEN || '',
      tableOrders: process.env.FEISHU_TABLE_ORDERS || process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS || '',
      tableCashFlow: process.env.FEISHU_TABLE_CASH_FLOW || process.env.NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW || '',
      tableFinance: process.env.FEISHU_TABLE_FINANCE || process.env.NEXT_PUBLIC_FEISHU_TABLE_FINANCE || '',
      baseUrl: process.env.NEXT_PUBLIC_FEISHU_BASE_URL || '',
      dashboardUrl: process.env.NEXT_PUBLIC_FEISHU_DASHBOARD_URL || '',
      iframeUrls: {
        suppliers: process.env.NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL || '',
        customers: process.env.NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL || '',
        products: process.env.NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL || '',
        operations: process.env.NEXT_PUBLIC_FEISHU_OPERATIONS_URL || '',
        dashboard: process.env.NEXT_PUBLIC_FEISHU_DASHBOARD_URL || '',
      },
    }
    return NextResponse.json(config)
  } catch (e) {
    console.error('[api/config/feishu]', e)
    return NextResponse.json(
      { appId: '', appSecret: '', appToken: '', cashFlowBaseToken: '', tableOrders: '', tableCashFlow: '', tableFinance: '', baseUrl: '', dashboardUrl: '', iframeUrls: {} },
      { status: 200 }
    )
  }
}
