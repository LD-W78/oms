import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 部署方案: Vercel 服务端渲染 (SSR)
  // 说明: 使用服务端渲染以支持 API Routes，实现前端-BFF-飞书架构
  //
  // 关闭 PPR，避免流式占位导致内容区异常
  experimental: {
    ppr: false,
  },
  // 关闭开发态右下角「rendering」等指示器，避免一直显示造成误解
  devIndicators: false,

  images: {
    unoptimized: true,
  },
  
  // 环境变量将在构建时注入
  // 生产环境请在 Vercel Dashboard 中配置
  env: {
    NEXT_PUBLIC_FEISHU_APP_ID: process.env.FEISHU_APP_ID || process.env.NEXT_PUBLIC_FEISHU_APP_ID || '',
    NEXT_PUBLIC_FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || process.env.NEXT_PUBLIC_FEISHU_APP_SECRET || '',
    NEXT_PUBLIC_FEISHU_APP_TOKEN: process.env.FEISHU_BASE_APP_TOKEN || process.env.NEXT_PUBLIC_FEISHU_APP_TOKEN || '',
    NEXT_PUBLIC_FEISHU_TABLE_ORDERS: process.env.FEISHU_TABLE_ORDERS || process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS || '',
    NEXT_PUBLIC_FEISHU_TABLE_LOGISTICS: process.env.FEISHU_TABLE_LOGISTICS || process.env.NEXT_PUBLIC_FEISHU_TABLE_LOGISTICS || '',
    NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW: process.env.NEXT_PUBLIC_FEISHU_TABLE_CASH_FLOW || '',
    NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS: process.env.NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS || '',
    NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS: process.env.NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS || '',
    NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS: process.env.NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS || '',
    NEXT_PUBLIC_FEISHU_BASE_URL: process.env.NEXT_PUBLIC_FEISHU_BASE_URL || 'https://open.feishu.cn',
    NEXT_PUBLIC_FEISHU_DASHBOARD_URL: process.env.NEXT_PUBLIC_FEISHU_DASHBOARD_URL || '',
    NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL: process.env.NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL || '',
    NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL: process.env.NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL || '',
    NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL: process.env.NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL || '',
    NEXT_PUBLIC_FEISHU_OPERATIONS_URL: process.env.NEXT_PUBLIC_FEISHU_OPERATIONS_URL || '',
  },
}

export default nextConfig
