import { z } from 'zod'

const envSchema = z.object({
  // Feishu credentials - optional for demo/development（trim 去除首尾空格，避免 invalid param）
  FEISHU_APP_ID: z.string().optional().default('').transform((v) => (v || '').trim()),
  FEISHU_APP_SECRET: z.string().optional().default('').transform((v) => (v || '').trim()),
  FEISHU_BASE_APP_TOKEN: z.string().optional().default('').transform((v) => (v || '').trim()),
  /** 现金表所在 Base 的 app_token，若配置则现金表请求使用此 token */
  FEISHU_CASH_FLOW_BASE_TOKEN: z.string().optional().default('').transform((v) => (v || '').trim()),
  FEISHU_BASE_URL: z.string().url().optional().default('https://open.feishu.cn/open-apis'),
  FEISHU_TABLE_ORDERS: z.string().optional(),
  FEISHU_TABLE_CUSTOMERS: z.string().optional(),
  FEISHU_TABLE_PRODUCTS: z.string().optional(),
  FEISHU_TABLE_SUPPLIERS: z.string().optional(),
  FEISHU_TABLE_USERS: z.string().optional(),
  // Cash Flow Table
  FEISHU_TABLE_CASH_FLOW: z.string().optional(),
  // Finance Table
  FEISHU_TABLE_FINANCE: z.string().optional(),
  // Dashboards
  FEISHU_SALES_DASHBOARD_URL: z.string().url().optional().or(z.literal('')),
  FEISHU_SALES_DASHBOARD_TABLE_ID: z.string().optional(),
  FEISHU_OPERATIONS_DASHBOARD_URL: z.string().url().optional().or(z.literal('')),
  FEISHU_OPERATIONS_DASHBOARD_TABLE_ID: z.string().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().default('OMS'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('1.0.0'),
  // Client-side table IDs (with NEXT_PUBLIC_ prefix)
  NEXT_PUBLIC_FEISHU_TABLE_ORDERS: z.string().optional(),
  NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW: z.string().optional(),
  NEXT_PUBLIC_FEISHU_TABLE_FINANCE: z.string().optional(),
})

export const env = envSchema.parse(process.env)

// Server-side table IDs
const serverTableIds = {
  orders: env.FEISHU_TABLE_ORDERS,
  customers: env.FEISHU_TABLE_CUSTOMERS,
  products: env.FEISHU_TABLE_PRODUCTS,
  suppliers: env.FEISHU_TABLE_SUPPLIERS,
  users: env.FEISHU_TABLE_USERS,
  cashFlow: env.FEISHU_TABLE_CASH_FLOW,
  finance: env.FEISHU_TABLE_FINANCE,
  salesDashboard: env.FEISHU_SALES_DASHBOARD_TABLE_ID,
  operationsDashboard: env.FEISHU_OPERATIONS_DASHBOARD_TABLE_ID,
}

// Client-side table IDs (available in browser)
const clientTableIds = {
  orders: env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS,
  cashFlow: env.NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW,
  finance: env.NEXT_PUBLIC_FEISHU_TABLE_FINANCE,
}

// Use client-side IDs when available, fallback to server-side
export const TABLE_IDS = {
  orders: clientTableIds.orders || serverTableIds.orders,
  customers: serverTableIds.customers,
  products: serverTableIds.products,
  suppliers: serverTableIds.suppliers,
  users: serverTableIds.users,
  cashFlow: clientTableIds.cashFlow || serverTableIds.cashFlow,
  finance: clientTableIds.finance || serverTableIds.finance,
  salesDashboard: serverTableIds.salesDashboard,
  operationsDashboard: serverTableIds.operationsDashboard,
} as const

/** 按表 ID 选择 base token：现金表使用独立 base，其余使用默认 base */
export function getBaseTokenForTableId(tableId: string): string {
  const cashFlowId = (env.FEISHU_TABLE_CASH_FLOW || env.NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW || '').trim()
  if (cashFlowId && tableId === cashFlowId && env.FEISHU_CASH_FLOW_BASE_TOKEN) {
    return env.FEISHU_CASH_FLOW_BASE_TOKEN
  }
  return env.FEISHU_BASE_APP_TOKEN || ''
}
