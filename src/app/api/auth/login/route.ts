import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import type { Role } from '@/lib/auth/store'
import { log500 } from '@/lib/debug-log'
import { appendLoginLog } from '@/lib/access-log'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'users.json')

interface UserRecord {
  id: string
  username: string
  name: string
  role: string
  password?: string
  moduleKeys?: string[]
  enabled?: boolean
}

async function loadUsers(): Promise<UserRecord[]> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content) as { users: UserRecord[] }
    return config.users ?? []
  } catch {
    return [
      { id: '1', username: 'admin', name: '管理员', role: 'admin', password: '123456' },
      { id: '2', username: 'sales', name: '李业务', role: 'sales', password: '123456' },
      { id: '3', username: 'finance', name: '王财务', role: 'finance', password: '123456' },
    ]
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { username, password } = (await request.json()) as { username: string; password: string }
    const users = await loadUsers()
    const found = users.find((u) => u.username === username && (u.password ?? '123456') === password)
    if (!found) {
      return NextResponse.json({ success: false, error: '用户名或密码错误' }, { status: 401 })
    }
    if (found.enabled === false) {
      return NextResponse.json({ success: false, error: '该账号已被停用，请联系管理员' }, { status: 403 })
    }
    const { password: _, ...user } = found
    const logId = await appendLoginLog(user.username)
    return NextResponse.json({
      success: true,
      logId,
      user: {
        ...user,
        role: user.role as Role,
        permissions: [],
        moduleKeys: Array.isArray(user.moduleKeys) ? user.moduleKeys : undefined,
      },
    })
  } catch (e) {
    console.error('[api/auth/login]', e)
    // #region agent log
    log500('/api/auth/login', 'POST', e)
    // #endregion
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
