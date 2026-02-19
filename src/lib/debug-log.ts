/**
 * 调试用：将 500 错误写入 .cursor/debug.log（NDJSON）
 * 用于定位 Internal Server Error 来源
 */
const LOG_PATH = '.cursor/debug.log'

export function log500(api: string, method: string, error: unknown): void {
  try {
    const fs = require('fs')
    const path = require('path')
    const fullPath = path.join(process.cwd(), LOG_PATH)
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const payload = {
      location: `${api}:${method}:catch`,
      message: '500 error',
      data: {
        api,
        method,
        error: String(error),
        stack: error instanceof Error ? error.stack : '',
      },
      timestamp: Date.now(),
    }
    fs.appendFileSync(fullPath, JSON.stringify(payload) + '\n', 'utf-8')
  } catch {
    // ignore
  }
}
