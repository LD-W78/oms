#!/usr/bin/env python3
"""检查源文件中是否存在与校验结果相同的重复交易（来源+账号+日期+金额+对方户名）"""
import sys
import os
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from validator import BankFlowValidator
from scripts.run_workflow_simulation import _extract_account_prefix, COMPANY_PROFILE_LOOKUP, _amt_str


def src_base_key(row):
    """与 validator _detect_duplicates 一致的 base_key（目标表格式）"""
    来源 = str(row.get("来源文件", ""))
    prefix = _extract_account_prefix(来源)
    _, 我方账号 = COMPANY_PROFILE_LOOKUP.get(prefix, ("", str(row.get("账号", ""))[:30]))
    账号 = (我方账号 or str(row.get("账号", "")))[:30]
    return (
        来源,
        账号,
        str(row.get("交易日", "")),
        _amt_str(row.get("支取")),
        _amt_str(row.get("收入")),
        str(row.get("对方户名", ""))[:50],
    )


def main():
    v = BankFlowValidator()
    all_src, src_by_file = v._fetch_source_records(use_cache=False)

    # 源文件中的 base_key 统计
    src_keys = [src_base_key(r) for r in all_src]
    cnt = Counter(src_keys)
    dup_in_src = [(bk, cnt[bk]) for bk in cnt if cnt[bk] > 1]

    print("=" * 80)
    print("【源文件重复检查】与校验中「重复记录」使用相同 base_key：来源+账号+日期+支出+收入+对方户名")
    print("=" * 80)
    print(f"\n源文件总记录数: {len(all_src)}")
    print(f"源文件中 base_key 重复的组数: {len(dup_in_src)}")

    if dup_in_src:
        total_dup = sum(c - 1 for _, c in dup_in_src)
        print(f"源文件中多出的重复条数: {total_dup}")
        print("\n【源文件中的重复组】")
        for i, (bk, c) in enumerate(dup_in_src[:15], 1):
            来源, 账号, 日期, 支出, 收入, 对方 = bk
            print(f"\n  {i}. 来源={来源}")
            print(f"     账号={账号[:25]}... | 日期={日期} | 支出={支出} 收入={收入} | 对方={对方[:25]}...")
            print(f"     源文件中出现 {c} 次")
            # 列出源文件中匹配的记录
            matches = [r for r in all_src if src_base_key(r) == bk]
            for j, r in enumerate(matches, 1):
                print(f"       [{j}] 账号={str(r.get('账号',''))[:20]} 对方={str(r.get('对方户名',''))[:20]} 支取={r.get('支取')} 收入={r.get('收入')}")
    else:
        print("\n源文件中无 base_key 重复。目标表的重复可能来自：")
        print("  - 同步时 record_key 含 _parse_row 区分了源中多笔，但目标表无此字段")
        print("  - 或多次同步导致重复写入")

    return 0


if __name__ == "__main__":
    sys.exit(main())
