#!/usr/bin/env python3
"""
为 ritos_cflow_sum 添加 我方账户、我方账号、对方账户、对方账号 字段
（采用方案A：我方/对方命名）
需在飞书多维表格中手动执行，或通过 API 创建。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from run_workflow_simulation import get_token, BASE, APP_TOKEN, TABLE_ID


def list_fields(token):
    r = __import__("requests").get(
        f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/fields",
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return []
    return [f.get("field_name") for f in j.get("data", {}).get("items", [])]


def create_field(token, field_name, field_type=1):
    """field_type: 1=文本"""
    import requests
    url = f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/fields"
    r = requests.post(
        url,
        json={"field_name": field_name, "type": field_type},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    return r.json()


def main():
    token = get_token()
    if not token:
        return 1
    existing = list_fields(token)
    print("现有字段:", existing)
    to_add = ["我方账户", "我方账号", "对方账户", "对方账号"]
    for name in to_add:
        if name in existing:
            print(f"  跳过（已存在）: {name}")
            continue
        j = create_field(token, name)
        if j.get("code") == 0:
            print(f"  创建成功: {name}")
        else:
            print(f"  创建失败: {name}", j.get("msg", j))
    return 0


if __name__ == "__main__":
    sys.exit(main())
