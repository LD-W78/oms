'use client'

import { App, ConfigProvider } from 'antd'

import { themeConfig } from '@/app/theme'

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={themeConfig}>
      <App>{children}</App>
    </ConfigProvider>
  )
}
