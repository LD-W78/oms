'use client'

import { usePathname } from 'next/navigation'
import { MainLayout } from './MainLayout'
import { AuthGuard } from '../Auth'
import type { ReactNode } from 'react'

/** 登录页不渲染 MainLayout，避免 hooks 顺序问题；非登录页用 AuthGuard 包裹 */
export function LayoutSwitcher({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? ''
  if (pathname === '/login') {
    return <>{children}</>
  }
  return (
    <AuthGuard requireAuth>
      <MainLayout>{children}</MainLayout>
    </AuthGuard>
  )
}
