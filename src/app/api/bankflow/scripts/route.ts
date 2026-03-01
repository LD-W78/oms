/**
 * POST /api/bankflow/scripts
 * 执行 bankflow 维护脚本（需先通过管理员密码验证）
 * body: { action: string, params?: Record<string, string>, password: string }
 */
import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { readFile } from 'fs/promises'
import { env } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

const MODULE_PATH = path.join(process.cwd(), 'modules', 'bankflow')
const USERS_PATH = path.join(process.cwd(), 'config', 'users.json')

interface UserRecord {
  username: string
  role: string
  password?: string
  enabled?: boolean
}

async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password || typeof password !== 'string') return false
  try {
    const content = await readFile(USERS_PATH, 'utf-8')
    const config = JSON.parse(content) as { users: UserRecord[] }
    const admin = config.users?.find((u) => u.role === 'admin' && u.enabled !== false) ?? null
    if (!admin) return false
    const expected = admin.password ?? '123456'
    return password === expected
  } catch {
    return password === '123456'
  }
}
const SCRIPTS: Record<string, { script: string; args?: string[]; danger?: boolean }> = {
  clear_bitable: { script: 'clear_bitable.py', danger: true },
  delete_records_by_source: { script: 'delete_records_by_source.py', danger: true },
  fix_type_field: { script: 'fix_type_field.py', danger: false },
  fix_my_account_field: { script: 'fix_my_account_field.py', danger: false },
  add_my_counterparty_fields: { script: 'add_my_counterparty_fields.py', danger: false },
  check_source_duplicates: { script: 'check_source_duplicates.py', danger: false },
}

function runScript(
  scriptName: string,
  args: string[] = []
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const scriptPath = path.join(MODULE_PATH, 'scripts', scriptName)
    const python = spawn('python3', [scriptPath, ...args], {
      cwd: MODULE_PATH,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        FEISHU_APP_ID: env.FEISHU_APP_ID || '',
        FEISHU_APP_SECRET: env.FEISHU_APP_SECRET || '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    python.stdout?.on('data', (d) => { stdout += d.toString() })
    python.stderr?.on('data', (d) => { stderr += d.toString() })
    python.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }))
    python.on('error', (err) => {
      stderr += err.message
      resolve({ stdout, stderr, code: -1 })
    })
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      params?: Record<string, string>
      password?: string
    }
    const { action, params = {}, password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: '请先输入管理员密码' }, { status: 400 })
    }
    const valid = await verifyAdminPassword(password)
    if (!valid) {
      return NextResponse.json({ success: false, error: '密码错误' }, { status: 401 })
    }

    if (!action || typeof action !== 'string') {
      return NextResponse.json({ success: false, error: '缺少 action 参数' }, { status: 400 })
    }

    const cfg = SCRIPTS[action]
    if (!cfg) {
      return NextResponse.json({ success: false, error: `未知操作: ${action}` }, { status: 400 })
    }

    const args: string[] = []
    if (action === 'delete_records_by_source') {
      const source = params?.source?.trim()
      if (!source) {
        return NextResponse.json({ success: false, error: 'delete_records_by_source 需要 params.source' }, { status: 400 })
      }
      args.push(source)
    }

    const { stdout, stderr, code } = await runScript(cfg.script, args)
    const output = [stdout, stderr].filter(Boolean).join('\n\n--- stderr ---\n')

    return NextResponse.json({
      success: code === 0,
      output: output.substring(0, 15000),
      exitCode: code,
    })
  } catch (e) {
    console.error('[api/bankflow/scripts]', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : '执行失败' },
      { status: 500 }
    )
  }
}
