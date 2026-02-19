'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore, type Role } from '@/lib/auth/store'
import { Spin } from 'antd'

interface PermissionGuardProps {
  children: React.ReactNode
  resource: string
  action: 'create' | 'read' | 'update' | 'delete'
  fallback?: React.ReactNode
  requiredRoles?: Role[]
}

export function PermissionGuard({
  children,
  resource,
  action,
  fallback = null,
  requiredRoles,
}: PermissionGuardProps) {
  const { user, isAuthenticated, hasPermission } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isAuthenticated && pathname !== '/login') {
      router.push('/login')
    }
  }, [isAuthenticated, pathname, router])

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" description="正在验证权限..." />
      </div>
    )
  }

  // Check role-based access
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return fallback
  }

  // Check permission-based access
  if (!hasPermission(resource, action)) {
    return fallback
  }

  return <>{children}</>
}

export function RoleGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles: Role[]
}) {
  const { user, isAuthenticated } = useAuthStore()

  if (!isAuthenticated || !user) {
    return null
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h2>权限不足</h2>
        <p>您没有权限访问此页面</p>
      </div>
    )
  }

  return <>{children}</>
}
