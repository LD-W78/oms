import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** SSR 安全：服务端无 localStorage，使用 no-op 避免 500 */
const ssrSafeStorage = () =>
  typeof window === 'undefined'
    ? { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    : localStorage

/** 角色：管理员 / 业务员 / 财务 */
export type Role = 'admin' | 'sales' | 'finance'

export interface Permission {
  resource: string
  actions: ('create' | 'read' | 'update' | 'delete')[]
}

export interface User {
  id: string
  username: string
  name: string
  role: Role
  permissions: Permission[]
  /** 用户级模块权限，为空时使用角色默认 */
  moduleKeys?: string[]
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  logId: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  hasPermission: (resource: string, action: 'create' | 'read' | 'update' | 'delete') => boolean
  /** 是否可访问某模块（用于菜单显示） */
  canAccessModule: (moduleKey: string) => boolean
}

const rolePermissions: Record<Role, Permission[]> = {
  admin: [{ resource: '*', actions: ['create', 'read', 'update', 'delete'] }],
  sales: [
    { resource: 'orders', actions: ['create', 'read', 'update'] },
    { resource: 'customers', actions: ['create', 'read', 'update'] },
    { resource: 'products', actions: ['create', 'read', 'update'] },
    { resource: 'suppliers', actions: ['read', 'update'] },
    { resource: 'quotation', actions: ['create', 'read', 'update'] },
    { resource: 'logistics', actions: ['create', 'read', 'update'] },
    { resource: 'receivable-payable', actions: ['read', 'update'] },
  ],
  finance: [
    { resource: 'orders', actions: ['read'] },
    { resource: 'customers', actions: ['read'] },
    { resource: 'products', actions: ['read'] },
    { resource: 'receivable-payable', actions: ['create', 'read', 'update'] },
    { resource: 'cash-flow', actions: ['create', 'read', 'update'] },
    { resource: 'business-analysis', actions: ['read'] },
  ],
}

/** 角色可访问的模块 key（* 表示全部；支持 finance.xxx 子模块） */
const roleModulePermissions: Record<Role, string[]> = {
  admin: ['*'],
  sales: [
    'dashboard', 'orders', 'customers', 'products', 'suppliers', 'quotation', 'logistics',
    'finance.receivable-payable', 'feishu-sheet',
  ],
  finance: [
    'dashboard', 'orders', 'customers', 'products',
    'finance.receivable-payable', 'finance.cash-flow', 'finance.business-analysis',
    'feishu-sheet',
  ],
}

const mockUsers: User[] = [
  { id: '1', username: 'admin', name: '管理员', role: 'admin', permissions: rolePermissions.admin },
  { id: '2', username: 'sales', name: '李业务', role: 'sales', permissions: rolePermissions.sales },
  { id: '3', username: 'finance', name: '王财务', role: 'finance', permissions: rolePermissions.finance },
]

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      logId: null,

      login: async (username: string, password: string) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })
          const data = await res.json()
          if (data?.success && data?.user) {
            const u = data.user
            const user: User = {
              id: u.id,
              username: u.username,
              name: u.name,
              role: u.role,
              permissions: rolePermissions[u.role as Role] ?? rolePermissions.sales,
              moduleKeys: Array.isArray(u.moduleKeys) ? u.moduleKeys : undefined,
            }
            set({ user, isAuthenticated: true, logId: data.logId ?? null })
            return true
          }
        } catch {
          // fallback to mock
        }
        const user = mockUsers.find((u) => u.username === username && password === '123456')
        if (user) {
          set({ user, isAuthenticated: true })
          return true
        }
        return false
      },

      logout: () => {
        const { logId } = get()
        if (logId && typeof fetch !== 'undefined') {
          fetch('/api/access-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout', logId }),
          }).catch(() => {})
        }
        set({ user: null, isAuthenticated: false, logId: null })
      },

      hasPermission: (resource: string, action: 'create' | 'read' | 'update' | 'delete') => {
        const { user } = get()
        if (!user) return false
        if (user.role === 'admin') return true
        const permission = user.permissions.find(p => p.resource === resource || p.resource === '*')
        return permission ? permission.actions.includes(action) : false
      },

      canAccessModule: (moduleKey: string) => {
        const { user } = get()
        if (!user) return false
        const allowed = (Array.isArray(user.moduleKeys) && user.moduleKeys.length > 0)
          ? user.moduleKeys
          : (roleModulePermissions[user.role] ?? [])
        if (allowed.includes('*')) return true
        if (allowed.includes(moduleKey)) return true
        const parent = moduleKey.split('.')[0]
        if (allowed.includes(parent)) return true
        if (parent === moduleKey && allowed.some((a) => a.startsWith(parent + '.'))) return true
        return false
      },
    }),
    {
      name: 'oms-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      storage: createJSONStorage(ssrSafeStorage),
    }
  )
)
