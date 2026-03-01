/**
 * POST /api/auth/verify-admin
 * 验证管理员密码，用于敏感操作前的二次确认
 */
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'config', 'users.json')

interface UserRecord {
  username: string
  role: string
  password?: string
  enabled?: boolean
}

async function findAdminUser(): Promise<UserRecord | null> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(content) as { users: UserRecord[] }
    return config.users?.find((u) => u.role === 'admin' && u.enabled !== false) ?? null
  } catch {
    return { username: 'admin', role: 'admin', password: '123456' }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { password } = (await request.json()) as { password?: string }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: '请输入密码' }, { status: 400 })
    }
    const admin = await findAdminUser()
    if (!admin) {
      return NextResponse.json({ success: false, error: '未找到管理员账户' }, { status: 403 })
    }
    const expected = admin.password ?? '123456'
    if (password !== expected) {
      return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/auth/verify-admin]', e)
    return NextResponse.json({ error: '验证失败' }, { status: 500 })
  }
}
