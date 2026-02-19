/**
 * 应用路由常量，禁止在页面中硬编码路径
 */
export const ROUTES = {
  DASHBOARD: '/dashboard',
  ORDERS: '/orders',
  LOGISTICS: '/logistics',
  SYSTEM_SYNC: '/system/sync',
  SYSTEM_DATA_CONFIG: '/system/data-config',
  LOGIN: '/login',
} as const

export type RouteKey = keyof typeof ROUTES
