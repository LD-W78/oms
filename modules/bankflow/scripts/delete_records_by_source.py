#!/usr/bin/env python3
"""按来源前缀删除合并表中的记录，用于与正确结果参考对齐（如删除 QD_VTB 记录）"""
import os
import re
import sys
import requests

sys.path.insert(0, os.path.dirname(__file__))
from run_workflow_simulation import get_token, BASE, APP_TOKEN, TABLE_ID


def _prefix_from_source(来源):
    s = str(来源 or "").strip()
    return re.sub(r"_\d{8}(?:\.[^.]+)?$", "", s, flags=re.I) or s


def main():
    if len(sys.argv) < 2:
        print("用法: python delete_records_by_source.py QD_VTB_RMB [QD_VTB_RMB2 ...]")
        return 1
    prefixes = set(p.upper() for p in sys.argv[1:])
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
        to_del = [
            it["record_id"] for it in items
            if _prefix_from_source(it.get("fields", {}).get("来源", "")).upper() in prefixes
        ]
        if not to_del:
            if not items:
                break
            pt = j.get("data", {}).get("page_token")
            if not pt:
                break
            continue
        del_r = requests.post(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/batch_delete",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"records": to_del},
        )
        if del_r.json().get("code") != 0:
            print(f"删除失败: {del_r.json().get('msg')}")
            return 1
        deleted += len(to_del)
        print(f"  已删除 {deleted} 条 (前缀: {', '.join(prefixes)})")
        if not items or len(items) < 500:
            break
    print(f"共删除 {deleted} 条")
    return 0


if __name__ == "__main__":
    sys.exit(main())
