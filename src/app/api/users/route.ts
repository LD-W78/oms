import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { log500 } from '@/lib/debug-log'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'users.json')

interface UserRecord {
  id: string
  username: string
  name: string
  role: string
  password?: string
  moduleKeys?: string[]
  /** 是否启用，默认 true */
  enabled?: boolean
}

interface UsersConfig {
  version: string
  users: UserRecord[]
}

async function loadUsers(): Promise<UsersConfig> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(content) as UsersConfig
  } catch {
    return {
      version: '1.0',
      users: [
        { id: '1', username: 'admin', name: '管理员', role: 'admin', password: '123456' },
        { id: '2', username: 'sales', name: '李业务', role: 'sales', password: '123456' },
        { id: '3', username: 'finance', name: '王财务', role: 'finance', password: '123456' },
      ],
    }
  }
}

async function saveUsers(config: UsersConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export async function GET(): Promise<NextResponse> {
  try {
    const config = await loadUsers()
    const users = config.users.map(({ password: _, ...u }) => ({ ...u, enabled: u.enabled !== false }))
    return NextResponse.json({ users })
  } catch (e) {
    console.error('[api/users] GET', e)
    // #region agent log
    log500('/api/users', 'GET', e)
    // #endregion
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { action, data } = body

    if (action === 'save') {
      const config = await loadUsers()
      const incoming = data as Array<{ id: string; username: string; name: string; role: string; password?: string; moduleKeys?: string[]; enabled?: boolean }>
      const existingMap = new Map(config.users.map((u) => [u.id, u]))
      const updated: UserRecord[] = incoming.map((u) => {
        const existing = existingMap.get(u.id)
        const pwd = typeof u.password === 'string' && u.password.length > 0 ? u.password : (existing?.password ?? '123456')
        return {
          id: u.id,
          username: u.username,
          name: u.name,
          role: u.role,
          password: pwd,
          moduleKeys: Array.isArray(u.moduleKeys) ? u.moduleKeys : undefined,
          enabled: u.enabled !== false,
        }
      })
      config.users = updated
      await saveUsers(config)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[api/users] POST', e)
    // #region agent log
    log500('/api/users', 'POST', e)
    // #endregion
    return NextResponse.json({ error: 'Failed to save users' }, { status: 500 })
  }
}
