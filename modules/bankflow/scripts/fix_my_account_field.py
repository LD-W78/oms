#!/usr/bin/env python3
"""
历史数据清洗：修正目标表中错误的 我方账户/我方账号。
按 来源 字段提取 prefix，从 company_profile 查找正确公司名和账号，对不匹配的记录执行更新。
"""
import os
import re
import sys
import time

import requests

sys.path.insert(0, os.path.dirname(__file__))
from run_workflow_simulation import (
    get_token,
    BASE,
    APP_TOKEN,
    TABLE_ID,
    _extract_account_prefix,
    _load_company_profile_lookup,
)

COMPANY_PROFILE_LOOKUP = _load_company_profile_lookup()


def fetch_all_records(token, page_size=500):
    """分页获取目标表全部记录，返回 (record_id, fields) 列表"""
    records = []
    page_token = None
    while True:
        params = {"page_size": page_size}
        if page_token:
            params["page_token"] = page_token
        r = requests.get(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        j = r.json()
        if j.get("code") != 0:
            print(f"获取记录失败: {j.get('msg', j)}")
            break
        items = j.get("data", {}).get("items", [])
        for it in items:
            records.append((it.get("record_id"), it.get("fields", {})))
        page_token = j.get("data", {}).get("page_token")
        if not page_token or not items:
            break
    return records


def update_record(token, record_id, fields):
    """PUT 更新单条记录"""
    r = requests.put(
        f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records/{record_id}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={"fields": fields},
    )
    return r.json().get("code") == 0, r.json().get("msg", "")


def main():
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv
    if dry_run:
        print("[dry-run 模式，仅预览不执行更新]\n")

    if not COMPANY_PROFILE_LOOKUP:
        print("company_profile.yaml 未加载或为空，无法执行清洗")
        return 1

    token = get_token()
    if not token:
        return 1

    print("1. 获取目标表全部记录...")
    records = fetch_all_records(token)
    print(f"   共 {len(records)} 条")

    to_fix = []
    for record_id, fields in records:
        来源 = str(fields.get("来源", "") or "").strip()
        if not 来源:
            continue
        prefix = _extract_account_prefix(来源)
        if prefix not in COMPANY_PROFILE_LOOKUP:
            continue
        正确账户, 正确账号 = COMPANY_PROFILE_LOOKUP[prefix]
        当前账户 = str(fields.get("我方账户") or fields.get("账户", "") or "").strip()
        当前账号 = str(fields.get("我方账号") or fields.get("账号", "") or "").strip()
        if 当前账户 != 正确账户 or 当前账号 != 正确账号:
            to_fix.append((record_id, fields, 正确账户, 正确账号, 当前账户, 当前账号))

    if not to_fix:
        print("2. 无需修正，所有记录的 我方账户/我方账号 已正确")
        return 0

    print(f"2. 待修正 {len(to_fix)} 条")
    for i, (rid, _, 正确账户, 正确账号, 当前账户, 当前账号) in enumerate(to_fix[:5], 1):
        print(f"   {i}. 我方账户: {当前账户[:20]}... -> {正确账户}")
    if len(to_fix) > 5:
        print(f"   ... 等共 {len(to_fix)} 条")

    if dry_run:
        print("\n[dry-run] 将修正以上记录，实际执行请去掉 --dry-run 参数")
        return 0

    confirm = input("\n确认执行更新？(y/N): ").strip().lower()
    if confirm != "y":
        print("已取消")
        return 0

    ok, fail = 0, 0
    for record_id, fields, 正确账户, 正确账号, _, _ in to_fix:
        new_fields = dict(fields)
        new_fields["我方账户"] = 正确账户
        new_fields["我方账号"] = 正确账号
        new_fields["账户"] = 正确账户
        new_fields["账号"] = 正确账号
        success, msg = update_record(token, record_id, new_fields)
        if success:
            ok += 1
        else:
            fail += 1
            print(f"   更新失败 {record_id}: {msg}")
        time.sleep(0.15)  # 飞书 API 限流约 10 QPS

    print(f"\n完成: 成功 {ok} 条, 失败 {fail} 条")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
