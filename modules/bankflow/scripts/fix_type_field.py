#!/usr/bin/env python3
"""
历史数据清洗：修正目标表中错误的「类型」字段。
用 摘要、对方账户、备注 调用 classify_type 得到新类型，若与当前类型不同则更新。
"""
import os
import sys
import time
from collections import Counter

import requests

sys.path.insert(0, os.path.dirname(__file__))
from run_workflow_simulation import (
    get_token,
    BASE,
    APP_TOKEN,
    TABLE_ID,
    classify_type,
)


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


def _extract_summary(摘要字段):
    """目标表 摘要 可能为「对方账户 | 原始摘要」，提取原始摘要用于分类"""
    s = str(摘要字段 or "").strip()
    if " | " in s:
        return s.split(" | ", 1)[1].strip()
    return s


def main():
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv
    if dry_run:
        print("[dry-run 模式，仅预览不执行更新]\n")

    token = get_token()
    if not token:
        return 1

    print("1. 获取目标表全部记录...")
    records = fetch_all_records(token)
    print(f"   共 {len(records)} 条")

    to_update = []
    change_dist = Counter()
    for record_id, fields in records:
        摘要字段 = fields.get("摘要") or ""
        原始摘要 = _extract_summary(摘要字段)
        对方账户 = str(fields.get("对方账户", "") or "").strip()
        备注 = str(fields.get("备注", "") or "").strip()
        当前类型 = str(fields.get("类型", "") or "").strip()
        try:
            支出 = float(fields.get("支出") or 0)
        except (ValueError, TypeError):
            支出 = 0
        是否支出 = 支出 > 0
        来源 = str(fields.get("来源", "") or "").strip()
        货币 = str(fields.get("货币", "") or "").strip()
        新类型 = classify_type(原始摘要, 对方账户, 备注, 是否支出, 来源=来源, 货币=货币)
        if 新类型 != 当前类型:
            to_update.append((record_id, fields, 当前类型, 新类型))
            change_dist[(当前类型 or "(空)", 新类型)] += 1

    if not to_update:
        print("2. 无需修正，所有记录的「类型」已正确")
        return 0

    print(f"2. 待修正 {len(to_update)} 条")
    print("   变更分布:")
    for (旧, 新), cnt in change_dist.most_common(10):
        print(f"      {旧} -> {新}: {cnt} 条")
    if len(change_dist) > 10:
        print(f"      ... 等共 {len(change_dist)} 种变更")
    print("\n   示例（前 5 条）:")
    for i, (rid, fields, 旧, 新) in enumerate(to_update[:5], 1):
        摘要 = (fields.get("摘要") or "")[:40]
        print(f"   {i}. {摘要}... | {旧} -> {新}")

    if dry_run:
        print("\n[dry-run] 将修正以上记录，实际执行请去掉 --dry-run 参数")
        return 0

    confirm = input("\n确认执行更新？(y/N): ").strip().lower()
    if confirm != "y":
        print("已取消")
        return 0

    ok, fail = 0, 0
    for record_id, _, _, 新类型 in to_update:
        # 仅更新「类型」字段，避免 PUT 全量字段导致 NumberFieldConvFail
        success, msg = update_record(token, record_id, {"类型": 新类型})
        if success:
            ok += 1
        else:
            fail += 1
            print(f"   更新失败 {record_id}: {msg}")
        time.sleep(0.15)

    print(f"\n完成: 成功 {ok} 条, 失败 {fail} 条")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
