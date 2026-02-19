'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Spin, Result, Button } from 'antd'
import { useAuthStore } from '@/lib/auth/store'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuthStore()
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && requireAuth && !isAuthenticated && pathname !== '/login') {
      router.replace('/login')
    }
  }, [hydrated, isAuthenticated, requireAuth, pathname, router])

  if (!requireAuth) return <>{children}</>

  if (!hydrated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" description="加载中..." />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" description="验证登录状态..." />
      </div>
    )
  }

  return <>{children}</>
}
