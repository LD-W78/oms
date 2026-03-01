/**
 * 银行流水记录查询 API
 * GET /api/bankflow/records?来源=xxx&日期起=xxx&日期止=xxx&类型=xxx&货币=xxx&limit=100
 *
 * 安全：筛选参数通过 argv 传递 JSON，避免命令注入
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { env } from '@/lib/config/env'

export const dynamic = 'force-dynamic'

/** 固定 Python 脚本，不含用户输入；参数通过 sys.argv 传入 */
const PYTHON_SCRIPT = `
import sys
import json
import os

module_path = sys.argv[1]
params_str = sys.argv[2] if len(sys.argv) > 2 else '{}'
params = json.loads(params_str)

sys.path.insert(0, module_path)
sys.path.insert(0, os.path.join(module_path, 'scripts'))

source = params.get('source', '')
date_from = params.get('dateFrom', '')
date_to = params.get('dateTo', '')
type_val = params.get('type', '')
currency = params.get('currency', '')
limit = int(params.get('limit', 100))

import requests
from run_workflow_simulation import get_token, APP_TOKEN, TABLE_ID, BASE

def fetch_all_records():
    token = get_token()
    if not token:
        return []
    all_records = []
    page_token = None
    while True:
        req_params = {"page_size": 500}
        if page_token:
            req_params["page_token"] = page_token
        resp = requests.get(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
            params=req_params,
            headers={"Authorization": f"Bearer {token}"}
        )
        data = resp.json()
        if data.get("code") != 0:
            break
        items = data.get("data", {}).get("items", [])
        all_records.extend(items)
        page_token = data.get("data", {}).get("page_token")
        if not page_token or not items:
            break
    return all_records

def filter_records(records):
    result = records
    if source:
        result = [r for r in result if str(r.get("fields", {}).get("来源", "")) == source]
    if date_from:
        result = [r for r in result if str(r.get("fields", {}).get("交易日期", "")) >= date_from]
    if date_to:
        result = [r for r in result if str(r.get("fields", {}).get("交易日期", "")) <= date_to]
    if type_val:
        result = [r for r in result if str(r.get("fields", {}).get("类型", "")) == type_val]
    if currency:
        result = [r for r in result if str(r.get("fields", {}).get("货币", "")) == currency]
    return result

records = fetch_all_records()
filtered = filter_records(records)

output = []
for r in filtered[:limit]:
    f = r.get("fields", {})
    output.append({
        "record_id": r.get("record_id"),
        "交易日期": f.get("交易日期"),
        "账号": f.get("账号"),
        "账户名": f.get("账户名"),
        "收入": f.get("收入"),
        "支出": f.get("支出"),
        "货币": f.get("货币"),
        "类型": f.get("类型"),
        "来源": f.get("来源"),
        "对方户名": f.get("对方户名"),
        "摘要": f.get("摘要"),
    })

print(json.dumps({"total": len(filtered), "records": output}, ensure_ascii=False))
`

function runPython(modulePath: string, paramsJson: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-c', PYTHON_SCRIPT, modulePath, paramsJson], {
      env: {
        ...process.env,
        FEISHU_APP_ID: env.FEISHU_APP_ID || '',
        FEISHU_APP_SECRET: env.FEISHU_APP_SECRET || '',
      },
    })
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Python script timeout (30s)'))
    }, 30000)
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d) => { stdout += d.toString() })
    proc.stderr?.on('data', (d) => { stderr += d.toString() })
    proc.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) {
        reject(new Error(stderr || `Python exited with code ${code}`))
      } else {
        resolve(stdout)
      }
    })
    proc.on('error', reject)
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const source = searchParams.get('来源') || searchParams.get('source') || ''
    const dateFrom = searchParams.get('日期起') || searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('日期止') || searchParams.get('dateTo') || ''
    const type = searchParams.get('类型') || searchParams.get('type') || ''
    const currency = searchParams.get('货币') || searchParams.get('currency') || ''
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10), 1), 1000)

    const modulePath = path.join(process.cwd(), 'modules', 'bankflow')
    const paramsJson = JSON.stringify({
      source,
      dateFrom,
      dateTo,
      type,
      currency,
      limit,
    })

    const stdout = await runPython(modulePath, paramsJson)
    const result = JSON.parse(stdout)

    return NextResponse.json({
      success: true,
      total: result.total,
      records: result.records,
      filters: { source, dateFrom, dateTo, type, currency },
    })
  } catch (error) {
    console.error('[BankflowRecords] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '查询失败',
      },
      { status: 500 }
    )
  }
}
