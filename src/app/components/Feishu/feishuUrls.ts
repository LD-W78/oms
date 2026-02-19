// Feishu URLs configuration for Bitable and Data Dashboard
// Uses dedicated URL variables from .env.local

export function getFeishuCustomerUrl(): string {
  return process.env.NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL || ''
}

export function getFeishuProductUrl(): string {
  return process.env.NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL || ''
}

export function getFeishuSupplierUrl(): string {
  return process.env.NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL || ''
}

export function getFeishuOrdersUrl(): string {
  return process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS_URL || ''
}

export function getFeishuDashboardUrl(): string {
  return process.env.NEXT_PUBLIC_FEISHU_DASHBOARD_URL || ''
}
