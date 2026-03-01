/**
 * 银行流水统计 API
 * GET /api/bankflow/stats
 * 返回汇总统计：总收入、总支出、按来源/类型/货币分布
 */

import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { env } from '@/lib/config/env';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const modulePath = path.join(process.cwd(), 'modules', 'bankflow');

    // 构建 Python 统计脚本
    const pythonScript = `
import sys
sys.path.insert(0, '${modulePath}')
sys.path.insert(0, '${path.join(modulePath, 'scripts')}')

import os
os.environ['FEISHU_APP_ID'] = '${env.FEISHU_APP_ID || ''}'
os.environ['FEISHU_APP_SECRET'] = '${env.FEISHU_APP_SECRET || ''}'

import json
from run_workflow_simulation import get_token, APP_TOKEN, TABLE_ID, BASE
import requests

def fetch_all_records():
    token = get_token()
    if not token:
        return []
    
    all_records = []
    page_token = None
    
    while True:
        params = {"page_size": 500}
        if page_token:
            params["page_token"] = page_token
            
        resp = requests.get(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
            params=params,
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

def calculate_stats(records):
    stats = {
        "total_records": len(records),
        "by_source": {},
        "by_type": {},
        "by_currency": {},
        "total_income": 0.0,
        "total_expense": 0.0,
        "monthly_summary": {}
    }
    
    for r in records:
        f = r.get("fields", {})
        
        # 来源统计
        source = f.get("来源", "未知")
        stats["by_source"][source] = stats["by_source"].get(source, 0) + 1
        
        # 类型统计
        type_ = f.get("类型", "未分类")
        stats["by_type"][type_] = stats["by_type"].get(type_, 0) + 1
        
        # 货币统计
        currency = f.get("货币", "未知")
        stats["by_currency"][currency] = stats["by_currency"].get(currency, 0) + 1
        
        # 金额统计
        try:
            income = float(f.get("收入") or 0)
            expense = float(f.get("支出") or 0)
            stats["total_income"] += income
            stats["total_expense"] += expense
        except (ValueError, TypeError):
            pass
        
        # 按月汇总
        date_str = str(f.get("交易日期", ""))
        if len(date_str) >= 6:
            month = date_str[:6]  # YYYYMM
            if month not in stats["monthly_summary"]:
                stats["monthly_summary"][month] = {"income": 0.0, "expense": 0.0, "count": 0}
            try:
                stats["monthly_summary"][month]["income"] += float(f.get("收入") or 0)
                stats["monthly_summary"][month]["expense"] += float(f.get("支出") or 0)
                stats["monthly_summary"][month]["count"] += 1
            except (ValueError, TypeError):
                pass
    
    # 格式化金额
    stats["total_income"] = round(stats["total_income"], 2)
    stats["total_expense"] = round(stats["total_expense"], 2)
    stats["balance"] = round(stats["total_income"] - stats["total_expense"], 2)
    
    for month in stats["monthly_summary"]:
        stats["monthly_summary"][month]["income"] = round(stats["monthly_summary"][month]["income"], 2)
        stats["monthly_summary"][month]["expense"] = round(stats["monthly_summary"][month]["expense"], 2)
        stats["monthly_summary"][month]["balance"] = round(
            stats["monthly_summary"][month]["income"] - stats["monthly_summary"][month]["expense"], 2
        )
    
    return stats

records = fetch_all_records()
stats = calculate_stats(records)

print(json.dumps(stats, ensure_ascii=False))
`;

    const { stdout, stderr } = await execAsync(`python3 -c "${pythonScript}"`, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr) {
      console.warn('[BankflowStats] Python stderr:', stderr);
    }

    const stats = JSON.parse(stdout);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[BankflowStats] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '统计失败',
      },
      { status: 500 }
    );
  }
}
