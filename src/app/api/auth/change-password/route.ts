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
}

async function loadConfig(): Promise<{ version: string; users: UserRecord[] }> {
  try {
    const content = await readFile(CONFIG_PATH, 'utf-8')
    return JSON.parse(content)
  } catch {
    return { version: '1.0', users: [] }
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId, oldPassword, newPassword } = (await request.json()) as {
      userId: string
      oldPassword: string
      newPassword: string
    }
    if (!userId || !oldPassword || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: '参数无效' }, { status: 400 })
    }
    const config = await loadConfig()
    const user = config.users.find((u) => u.id === userId)
    if (!user) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 })
    }
    const currentPwd = user.password ?? '123456'
    if (currentPwd !== oldPassword) {
      return NextResponse.json({ success: false, error: '原密码错误' }, { status: 401 })
    }
    user.password = newPassword
    await mkdir(path.dirname(CONFIG_PATH), { recursive: true })
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[api/auth/change-password]', e)
    // #region agent log
    log500('/api/auth/change-password', 'POST', e)
    // #endregion
    return NextResponse.json({ error: '修改失败' }, { status: 500 })
  }
}
