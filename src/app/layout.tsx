import type { Metadata, Viewport } from 'next'
import './globals.css'

import { AntdProvider } from './components/Providers'
import { LayoutSwitcher } from './components/Layout/LayoutSwitcher'

export const metadata: Metadata = {
  title: 'OMS',
  description: '专业的订单管理系统',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased" style={{ minHeight: '100vh', margin: 0 }}>
        <AntdProvider>
          <LayoutSwitcher>{children}</LayoutSwitcher>
        </AntdProvider>
      </body>
    </html>
  )
}
