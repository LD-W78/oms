#!/usr/bin/env python3
"""清空 ritos_cflow_sum 多维表格所有记录"""
import os
import sys
import requests

sys.path.insert(0, os.path.dirname(__file__))
from run_workflow_simulation import get_token, BASE, APP_TOKEN, TABLE_ID

def main():
    token = get_token()
    if not token:
        return 1
    deleted = 0
    while True:
        r = requests.get(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
            params={"page_size": 500},
            headers={"Authorization": f"Bearer {token}"},
        )
        j = r.json()
        if j.get("code") != 0:
            print(f"获取失败: {j.get('msg')}")
            return 1
        items = j.get("data", {}).get("items", [])
        if not items:
            break
        ids = [it["record_id"] for it in items]
        # 飞书 batch_delete: records 为 record_id 字符串数组
        del_r = requests.post(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/batch_delete",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"records": ids},
        )
        if del_r.json().get("code") != 0:
            print(f"删除失败: {del_r.json().get('msg')}")
            return 1
        deleted += len(ids)
        print(f"  已删除 {deleted} 条...")
    print(f"共清空 {deleted} 条记录")
    return 0

if __name__ == "__main__":
    sys.exit(main())
