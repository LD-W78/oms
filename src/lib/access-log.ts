import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), 'config', 'access-logs.json')

export interface AccessLogEntry {
  id: string
  username: string
  loginTime: string
  logoutTime?: string
}

interface AccessLogsConfig {
  logs: AccessLogEntry[]
}

async function loadLogs(): Promise<AccessLogEntry[]> {
  try {
    const content = await readFile(LOG_PATH, 'utf-8')
    const config = JSON.parse(content) as AccessLogsConfig
    return config.logs ?? []
  } catch {
    return []
  }
}

async function saveLogs(logs: AccessLogEntry[]): Promise<void> {
  await mkdir(path.dirname(LOG_PATH), { recursive: true })
  await writeFile(LOG_PATH, JSON.stringify({ logs }, null, 2), 'utf-8')
}

export async function appendLoginLog(username: string): Promise<string> {
  const logs = await loadLogs()
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  logs.push({
    id,
    username,
    loginTime: new Date().toISOString(),
  })
  await saveLogs(logs)
  return id
}

export async function updateLogoutLog(logId: string): Promise<void> {
  const logs = await loadLogs()
  const idx = logs.findIndex((l) => l.id === logId)
  if (idx >= 0) {
    logs[idx] = { ...logs[idx], logoutTime: new Date().toISOString() }
    await saveLogs(logs)
  }
}

export async function getAccessLogs(limit = 200): Promise<AccessLogEntry[]> {
  const logs = await loadLogs()
  return logs.slice(-limit).reverse()
}
