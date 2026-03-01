#!/usr/bin/env python3
"""
Bank Flow Validator Module - 银行流水校验模块
提供完整的源文件与目标表数据校验功能
"""
import os
import sys
import re
import csv
import io
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Tuple, Optional, Callable

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from scripts.run_workflow_simulation import (
    get_token,
    list_files,
    download_raw,
    parse_csv,
    parse_xls,
    parse_xlsx,
    filter_latest_date_files,
    record_key,
    _amt_str,
    _extract_account_prefix,
    COMPANY_PROFILE_LOOKUP,
    APP_TOKEN,
    TABLE_ID,
    BASE,
    FIELD_MAP,
)


class ValidationResult:
    """校验结果类"""
    def __init__(self):
        self.total_source = 0
        self.total_target = 0
        self.matched = 0
        self.mismatched = 0
        self.source_only = 0
        self.target_only = 0
        self.differences = []
        self.file_stats = {}
        self.date_range = ""  # 本次同步时间范围，如 "20260104 ~ 20260227"
        self.type_updates = []  # 类型按规则更新（源≠目标，属正常）
        self.is_valid = True
        self.errors = []
        # 金额汇总（核心校验）
        self.src_exp_total = 0.0
        self.src_inc_total = 0.0
        self.tgt_exp_total = 0.0
        self.tgt_inc_total = 0.0
        # 去重检测（仅作参考，不影响 is_valid）
        self.duplicate_count = 0
        self.duplicate_groups = []

    def to_dict(self):
        # 核心校验：记录数一致 + 金额统计一致
        count_ok = self.total_source == self.total_target
        exp_ok = abs(getattr(self, 'src_exp_total', 0) - getattr(self, 'tgt_exp_total', 0)) < 0.01
        inc_ok = abs(getattr(self, 'src_inc_total', 0) - getattr(self, 'tgt_inc_total', 0)) < 0.01
        is_valid = count_ok and exp_ok and inc_ok
        return {
            'total_source': self.total_source,
            'total_target': self.total_target,
            'src_exp_total': getattr(self, 'src_exp_total', 0),
            'src_inc_total': getattr(self, 'src_inc_total', 0),
            'tgt_exp_total': getattr(self, 'tgt_exp_total', 0),
            'tgt_inc_total': getattr(self, 'tgt_inc_total', 0),
            'date_range': getattr(self, 'date_range', ''),
            'is_valid': is_valid,
            'duplicate_count': getattr(self, 'duplicate_count', 0),
            'duplicate_groups_count': len(getattr(self, 'duplicate_groups', [])),
            'duplicate_record_ids': [
                rid for _, rids in getattr(self, 'duplicate_groups', [])
                for rid in rids[1:]
            ],
            'differences_count': len(self.differences),
            'type_updates_count': len(getattr(self, 'type_updates', [])),
            'file_stats': getattr(self, 'file_stats', {}),
        }


class BankFlowValidator:
    """银行流水校验器：源文件与目标表逐记录、逐字段比对，确保目标记录来自正确源文件与字段"""

    def __init__(self, token: Optional[str] = None):
        self.token = token or get_token()
        self.result = ValidationResult()
        self._target_cache = None
        self._source_cache = None

    def _fetch_target_records(self, use_cache: bool = True) -> List[Dict]:
        """获取目标表所有记录"""
        if use_cache and self._target_cache is not None:
            return self._target_cache

        import requests
        all_rec = []
        pt = None

        while True:
            params = {"page_size": 500}
            if pt:
                params["page_token"] = pt

            r = requests.get(
                f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
                params=params,
                headers={"Authorization": f"Bearer {self.token}"},
            )
            j = r.json()

            if j.get("code") != 0:
                self.result.errors.append(f"查询目标表失败: {j.get('msg')}")
                break

            items = j.get("data", {}).get("items", [])
            for it in items:
                f = it.get("fields", {})
                td = f.get("交易日期")
                if isinstance(td, (int, float)):
                    try:
                        dt = datetime.fromtimestamp(td / 1000)
                        td = dt.strftime("%Y%m%d")
                    except Exception:
                        td = str(td)[:8]
                else:
                    td = re.sub(r"\D", "", str(td or ""))[:8]

                all_rec.append({
                    "record_id": it.get("record_id"),
                    "来源": str(f.get("来源", "") or ""),
                    "账号": str(f.get("我方账号") or f.get("账号", "") or "").strip(),
                    "我方账户": str(f.get("我方账户") or f.get("账户", "") or "").strip(),
                    "我方账号": str(f.get("我方账号") or f.get("账号", "") or "").strip(),
                    "对方账户": str(f.get("对方账户", "") or "").strip(),
                    "对方账号": str(f.get("对方账号", "") or "").strip(),
                    "交易日": td,
                    "支出": f.get("支出"),
                    "收入": f.get("收入"),
                    "货币": str(f.get("货币", "") or "").strip(),
                    "类型": str(f.get("类型", "") or "").strip(),
                    "摘要": str(f.get("摘要", "") or ""),
                    "备注": str(f.get("备注", "") or ""),
                    "交易流水号": str(f.get("交易流水号", "") or "").strip(),
                })

            pt = j.get("data", {}).get("page_token")
            if not pt or not items:
                break

        if use_cache:
            self._target_cache = all_rec
        return all_rec

    def _fetch_source_records(self, use_cache: bool = True) -> Tuple[List[Dict], Dict]:
        """获取并解析所有源文件记录"""
        if use_cache and self._source_cache is not None:
            return self._source_cache

        files = list_files(self.token)
        source_files = [f for f in files if (f.get("name") or "").lower().endswith((".csv", ".xls", ".xlsx"))]
        to_process = filter_latest_date_files(source_files)

        all_src_rows = []
        src_by_file = defaultdict(list)

        for f in to_process:
            name = f.get("name", "")
            ext = (name or "").split(".")[-1].lower()
            raw = download_raw(self.token, f.get("token"))
            if not raw:
                self.result.errors.append(f"下载失败: {name}")
                continue

            if ext == "xls":
                rows = parse_xls(raw, name)
            elif ext == "xlsx":
                rows = parse_xlsx(raw, name)
            else:
                rows = parse_csv(raw, name)

            for r in rows:
                r["来源文件"] = name
                src_key = self._build_fingerprint(r, is_source=True)
                r["_fingerprint"] = src_key

            src_by_file[name] = rows
            all_src_rows.extend(rows)

        result = (all_src_rows, dict(src_by_file))
        if use_cache:
            self._source_cache = result
        return result

    def _build_fingerprint(self, row: Dict, is_source: bool = True) -> Tuple:
        """构建记录指纹用于匹配。源与目标均使用 company_profile 的 我方账号，确保可正确对应"""
        if is_source:
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
                str(row.get("对方户名", ""))[:50]
            )
        else:
            return (
                str(row.get("来源", "")),
                str(row.get("账号", "") or row.get("我方账号", ""))[:30],
                str(row.get("交易日", "")),
                _amt_str(row.get("支出")),
                _amt_str(row.get("收入")),
                str(row.get("对方账户", ""))[:50]
            )

    def _detect_duplicates(self, tgt_rows: List[Dict]):
        """检测目标表中 record_key 重复的记录（与 sync 的 record_key 一致）"""
        from collections import Counter
        base_keys = []
        for r in tgt_rows:
            bk = (
                str(r.get("来源", "")),
                str(r.get("账号", "") or r.get("我方账号", ""))[:30],
                str(r.get("交易日", "")),
                _amt_str(r.get("支出")),
                _amt_str(r.get("收入")),
                str(r.get("对方账户", ""))[:50],
            )
            base_keys.append((bk, r.get("record_id")))
        cnt = Counter(bk for bk, _ in base_keys)
        dup_groups = []
        seen = set()
        for bk, rid in base_keys:
            if cnt[bk] > 1 and bk not in seen:
                seen.add(bk)
                rids = [rid for b, rid in base_keys if b == bk]
                dup_groups.append((bk, rids))
        self.result.duplicate_groups = dup_groups
        self.result.duplicate_count = sum(len(rids) - 1 for _, rids in dup_groups)

    def _compare_single_record(self, src_row: Dict, tgt_row: Dict) -> Tuple[bool, List[Dict]]:
        """逐字段比对单条记录，返回 (是否匹配, 差异列表)"""
        differences = []
        source_name = src_row.get("来源文件", "")

        # 1. 货币字段
        src_currency = str(src_row.get("币种", "") or "").strip()
        tgt_currency = str(tgt_row.get("货币", "") or "").strip()
        src_norm = self._normalize_currency(src_currency)
        tgt_norm = self._normalize_currency(tgt_currency)

        if src_norm != tgt_norm:
            differences.append({
                "字段": "货币",
                "源值": src_currency,
                "目标值": tgt_currency,
                "严重程度": "高" if "OCBC" in source_name or "USD" in source_name else "中"
            })

        # 2. 我方账号（期望值来自 company_profile，非源文件解析）
        prefix = _extract_account_prefix(source_name or src_row.get("来源文件", ""))
        expected_name, expected_account = COMPANY_PROFILE_LOOKUP.get(prefix, ("", ""))
        tgt_account = str(tgt_row.get("我方账号") or tgt_row.get("账号", "") or "").strip()
        if expected_account and expected_account != tgt_account:
            differences.append({"字段": "我方账号", "源值": expected_account, "目标值": tgt_account, "严重程度": "高"})

        # 3. 我方账户（期望值来自 company_profile，非源文件解析）
        tgt_name = str(tgt_row.get("我方账户") or tgt_row.get("账户", "") or "").strip()
        if expected_name and expected_name != tgt_name:
            differences.append({"字段": "我方账户", "源值": expected_name, "目标值": tgt_name, "严重程度": "中"})

        # 4. 对方户名
        src_cp = str(src_row.get("对方户名", "") or "").strip()
        tgt_cp = str(tgt_row.get("对方账户", "") or "").strip()
        if src_cp != tgt_cp:
            differences.append({"字段": "对方账户", "源值": src_cp, "目标值": tgt_cp, "严重程度": "中"})

        # 5. 对方账号
        src_cp_acc = str(src_row.get("对方账号", "") or "").strip()
        tgt_cp_acc = str(tgt_row.get("对方账号", "") or "").strip()
        if src_cp_acc != tgt_cp_acc:
            differences.append({"字段": "对方账号", "源值": src_cp_acc, "目标值": tgt_cp_acc, "严重程度": "低"})

        # 6. 日期
        src_date = str(src_row.get("交易日", "") or "").strip()
        tgt_date = str(tgt_row.get("交易日", "") or "").strip()
        if src_date != tgt_date:
            differences.append({"字段": "交易日", "源值": src_date, "目标值": tgt_date, "严重程度": "高"})

        # 7. 支出金额
        src_exp = _amt_str(src_row.get("支取"))
        tgt_exp = _amt_str(tgt_row.get("支出"))
        if src_exp != tgt_exp:
            differences.append({"字段": "支出", "源值": src_row.get("支取"), "目标值": tgt_row.get("支出"), "严重程度": "高"})

        # 8. 收入金额
        src_inc = _amt_str(src_row.get("收入"))
        tgt_inc = _amt_str(tgt_row.get("收入"))
        if src_inc != tgt_inc:
            differences.append({"字段": "收入", "源值": src_row.get("收入"), "目标值": tgt_row.get("收入"), "严重程度": "高"})

        # 9. 摘要（目标表可能是"对方户名 | 摘要"格式）
        src_summary = str(src_row.get("摘要", "") or "").strip()
        tgt_summary = str(tgt_row.get("摘要", "") or "").strip()
        if src_summary and src_summary not in tgt_summary:
            differences.append({"字段": "摘要", "源值": src_summary[:50], "目标值": tgt_summary[:50], "严重程度": "低"})

        # 10. 备注
        src_remark = str(src_row.get("备注", "") or "").strip()
        tgt_remark = str(tgt_row.get("备注", "") or "").strip()
        if src_remark != tgt_remark:
            differences.append({"字段": "备注", "源值": src_remark[:50], "目标值": tgt_remark[:50], "严重程度": "低"})

        # 11. 交易流水号
        src_ref = str(src_row.get("交易流水号", "") or "").strip()
        tgt_ref = str(tgt_row.get("交易流水号", "") or "").strip()
        if src_ref != tgt_ref:
            differences.append({"字段": "交易流水号", "源值": src_ref, "目标值": tgt_ref, "严重程度": "中"})

        # 12. 类型：同步时按 type_classification 规则重算，源与目标不一致属正常，不计入差异
        src_type = str(src_row.get("交易类型", "") or "").strip()
        tgt_type = str(tgt_row.get("类型", "") or "").strip()
        if src_type != tgt_type:
            differences.append({
                "字段": "类型",
                "源值": src_type,
                "目标值": tgt_type,
                "严重程度": "正常",
                "按规则更新": True,
            })

        # 13. 来源
        src_source = str(src_row.get("来源文件", "") or "").strip()
        tgt_source = str(tgt_row.get("来源", "") or "").strip()
        if src_source != tgt_source:
            differences.append({"字段": "来源", "源值": src_source, "目标值": tgt_source, "严重程度": "高"})

        # 类型按规则更新不计入差异
        real_diffs = [d for d in differences if not d.get("按规则更新")]
        return len(real_diffs) == 0, differences

    def _normalize_currency(self, val: str) -> str:
        """标准化货币"""
        s = str(val or "").upper().replace(" ", "")
        if "USD" in s or "美元" in s or "DOLLAR" in s:
            return "USD"
        if "CNY" in s or "RMB" in s or "人民币" in s or "元" in s:
            return "RMB"
        return s

    def validate_detailed(self, verbose: bool = True) -> ValidationResult:
        """
        详细校验：逐字段比对源文件和目标表
        
        Args:
            verbose: 是否输出详细信息
            
        Returns:
            ValidationResult 校验结果对象
        """
        self.result = ValidationResult()

        # 1. 获取数据
        all_src_rows, src_by_file = self._fetch_source_records()
        tgt_rows = self._fetch_target_records()

        self.result.total_source = len(all_src_rows)
        self.result.total_target = len(tgt_rows)

        if verbose:
            print("=" * 100)
            print("【银行流水数据校验 - 逐字段详细比对】")
            print("=" * 100)
            print(f"\n源文件记录数: {self.result.total_source}")
            print(f"目标表记录数: {self.result.total_target}")
            print(f"\n按文件统计:")
            for name, rows in sorted(src_by_file.items()):
                print(f"  - {name}: {len(rows)} 条")

        # 2. 建立索引
        src_by_fp = defaultdict(list)
        for r in all_src_rows:
            src_by_fp[r["_fingerprint"]].append(r)

        tgt_by_fp = defaultdict(list)
        for r in tgt_rows:
            tgt_key = self._build_fingerprint(r, is_source=False)
            r["_fingerprint"] = tgt_key
            tgt_by_fp[tgt_key].append(r)

        # 2.5 去重检测：目标表中 record_key 重复的记录
        self._detect_duplicates(tgt_rows)

        # 3. 逐条比对
        all_differences = []

        for fp, src_records in src_by_fp.items():
            tgt_records = tgt_by_fp.get(fp, [])

            for i, src_rec in enumerate(src_records):
                if i < len(tgt_records):
                    tgt_rec = tgt_records[i]
                    is_match, diffs = self._compare_single_record(src_rec, tgt_rec)

                    if is_match:
                        self.result.matched += 1
                        # 记录类型按规则更新（正常，不计入差异）
                        type_diffs = [d for d in diffs if d.get("按规则更新")]
                        for d in type_diffs:
                            self.result.type_updates.append({
                                "来源": src_rec.get("来源文件"),
                                "我方账号": src_rec.get("账号", "")[:20],
                                "日期": src_rec.get("交易日"),
                                "源类型": d.get("源值"),
                                "目标类型": d.get("目标值"),
                            })
                    else:
                        self.result.mismatched += 1
                        all_differences.append({
                            "源文件": src_rec.get("来源文件"),
                            "源记录": src_rec,
                            "目标记录": tgt_rec,
                            "差异": diffs
                        })
                else:
                    self.result.source_only += 1

        # 目标表有但源文件无的记录
        for fp, tgt_records in tgt_by_fp.items():
            src_records = src_by_fp.get(fp, [])
            if len(tgt_records) > len(src_records):
                self.result.target_only += len(tgt_records) - len(src_records)

        self.result.differences = all_differences

        # 4. 金额汇总（核心校验）
        for r in all_src_rows:
            try:
                self.result.src_exp_total += float(str(r.get("支取") or "0").replace(",", ""))
            except (ValueError, TypeError):
                pass
            try:
                self.result.src_inc_total += float(str(r.get("收入") or "0").replace(",", ""))
            except (ValueError, TypeError):
                pass
        for r in tgt_rows:
            try:
                self.result.tgt_exp_total += float(str(r.get("支出") or "0").replace(",", ""))
            except (ValueError, TypeError):
                pass
            try:
                self.result.tgt_inc_total += float(str(r.get("收入") or "0").replace(",", ""))
            except (ValueError, TypeError):
                pass

        # 5. 按文件统计（用于输出）
        self._compute_file_stats(src_by_fp, tgt_by_fp)

        # 5.5 核心校验结论
        count_ok = self.result.total_source == self.result.total_target
        exp_ok = abs(self.result.src_exp_total - self.result.tgt_exp_total) < 0.01
        inc_ok = abs(self.result.src_inc_total - self.result.tgt_inc_total) < 0.01
        self.result.is_valid = count_ok and exp_ok and inc_ok

        # 6. 计算本次同步时间范围（交易日 min ~ max）
        dates = []
        for r in all_src_rows:
            d = re.sub(r"\D", "", str(r.get("交易日", "") or ""))[:8]
            if len(d) == 8:
                dates.append(d)
        if dates:
            dmin, dmax = min(dates), max(dates)
            # 格式化为 YYYY-MM-DD 便于阅读
            fmt = lambda d: f"{d[:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 else d
            self.result.date_range = f"{fmt(dmin)} ~ {fmt(dmax)}"
        else:
            self.result.date_range = "-"

        # 7. 输出结果
        if verbose:
            self._print_detailed_result(src_by_fp, tgt_by_fp)

        return self.result

    def _compute_file_stats(self, src_by_fp: Dict, tgt_by_fp: Dict):
        """按文件统计记录数、金额"""
        by_file = defaultdict(lambda: {"记录数": 0, "支出": 0.0, "收入": 0.0, "匹配": 0, "差异": 0})
        for fp, src_records in src_by_fp.items():
            fname = fp[0] if isinstance(fp, tuple) else str(fp)
            for r in src_records:
                by_file[fname]["记录数"] += 1
                try:
                    by_file[fname]["支出"] += float(str(r.get("支取") or "0").replace(",", ""))
                except (ValueError, TypeError):
                    pass
                try:
                    by_file[fname]["收入"] += float(str(r.get("收入") or "0").replace(",", ""))
                except (ValueError, TypeError):
                    pass
            tgt_records = tgt_by_fp.get(fp, [])
            for i, src_rec in enumerate(src_records):
                if i < len(tgt_records):
                    is_match, _ = self._compare_single_record(src_rec, tgt_records[i])
                    if is_match:
                        by_file[fname]["匹配"] += 1
                    else:
                        by_file[fname]["差异"] += 1
        self.result.file_stats = dict(by_file)

    def _print_detailed_result(self, src_by_fp: Dict, tgt_by_fp: Dict):
        """打印详细比对结果，核心：记录数+金额统计"""
        count_ok = self.result.total_source == self.result.total_target
        exp_ok = abs(self.result.src_exp_total - self.result.tgt_exp_total) < 0.01
        inc_ok = abs(self.result.src_inc_total - self.result.tgt_inc_total) < 0.01

        print("\n" + "=" * 100)
        print("【校验结果 - 核心】")
        print("=" * 100)
        print(f"  记录数: 源={self.result.total_source} vs 目标={self.result.total_target} {'✓' if count_ok else '✗'}")
        print(f"  支出合计: 源={self.result.src_exp_total:,.2f} vs 目标={self.result.tgt_exp_total:,.2f} {'✓' if exp_ok else '✗'}")
        print(f"  收入合计: 源={self.result.src_inc_total:,.2f} vs 目标={self.result.tgt_inc_total:,.2f} {'✓' if inc_ok else '✗'}")
        print(f"  本次同步时间范围: {self.result.date_range}")
        print(f"\n  （参考）完全匹配: {self.result.matched} | 存在差异: {self.result.mismatched} | 仅源有: {self.result.source_only} | 仅目标有: {self.result.target_only} | 重复: {self.result.duplicate_count} 条")

        if self.result.type_updates:
            print("\n" + "=" * 100)
            print(f"【类型按规则更新】共 {len(self.result.type_updates)} 条（同步时按 type_classification 重算，属正常）")
            print("=" * 100)
            for i, t in enumerate(self.result.type_updates[:15], 1):
                print(f"  {i}. {t['来源']} | 账号={t['我方账号']}... | 日期={t['日期']} | 源类型={t['源类型']} -> 目标类型={t['目标类型']}")
            if len(self.result.type_updates) > 15:
                print(f"  ... 等共 {len(self.result.type_updates)} 条")

        if self.result.duplicate_groups:
            print("\n" + "=" * 100)
            print("【重复记录详情】同一 record_key 出现多次（来源+账号+日期+金额+对方户名）")
            print("=" * 100)
            for i, (bk, rids) in enumerate(self.result.duplicate_groups[:10], 1):
                来源, 账号, 日期, 支出, 收入, 对方 = bk
                print(f"  {i}. 来源={来源} | 账号={账号[:20]}... | 日期={日期} | 支出={支出} 收入={收入} | 对方={对方[:20]}...")
                print(f"     重复 {len(rids)} 条，record_id: {rids}")
            if len(self.result.duplicate_groups) > 10:
                print(f"  ... 等共 {len(self.result.duplicate_groups)} 组重复")

        # 按文件汇总：文件/记录/金额
        if self.result.file_stats:
            print("\n" + "=" * 100)
            print("【按文件汇总】文件 | 记录数 | 支出 | 收入 | 匹配 | 差异")
            print("=" * 100)
            total_exp, total_inc = 0.0, 0.0
            for fname, st in sorted(self.result.file_stats.items()):
                exp, inc = st.get("支出", 0), st.get("收入", 0)
                total_exp += exp
                total_inc += inc
                print(f"  {fname[:50]:50} | {st.get('记录数', 0):>6} | {exp:>12.2f} | {inc:>12.2f} | {st.get('匹配', 0):>4} | {st.get('差异', 0):>4}")
            print(f"  {'合计':50} | {self.result.total_source:>6} | {total_exp:>12.2f} | {total_inc:>12.2f} | {self.result.matched:>4} | {self.result.mismatched:>4}")

        if self.result.matched > 0:
            print("\n" + "=" * 100)
            print("【逐字段匹配详情示例（前3条）】")
            print("=" * 100)

            shown = 0
            for fp, src_records in src_by_fp.items():
                tgt_records = tgt_by_fp.get(fp, [])
                for i, src_rec in enumerate(src_records):
                    if i < len(tgt_records):
                        tgt_rec = tgt_records[i]
                        is_match, _ = self._compare_single_record(src_rec, tgt_rec)
                        if is_match:
                            shown += 1
                            if shown <= 3:
                                print(f"\n【匹配记录 {shown}】来源: {src_rec.get('来源文件')}")
                                print(f"  1. 来源:       源='{src_rec.get('来源文件')}' -> 目标='{tgt_rec.get('来源')}' ✓")
                                print(f"  2. 我方账号:   源='{src_rec.get('账号')}' -> 目标='{tgt_rec.get('我方账号')}' ✓")
                                print(f"  3. 我方账户:   源='{src_rec.get('账户名')}' -> 目标='{tgt_rec.get('我方账户')}' ✓")
                                print(f"  4. 对方账户:   源='{src_rec.get('对方户名')}' -> 目标='{tgt_rec.get('对方账户')}' ✓")
                                print(f"  5. 对方账号:   源='{src_rec.get('对方账号')}' -> 目标='{tgt_rec.get('对方账号')}' ✓")
                                print(f"  6. 交易日:     源='{src_rec.get('交易日')}' -> 目标='{tgt_rec.get('交易日')}' ✓")
                                print(f"  7. 支出:       源='{src_rec.get('支取')}' -> 目标='{tgt_rec.get('支出')}' ✓")
                                print(f"  8. 收入:       源='{src_rec.get('收入')}' -> 目标='{tgt_rec.get('收入')}' ✓")
                                print(f"  9. 货币:       源='{src_rec.get('币种')}' -> 目标='{tgt_rec.get('货币')}' ✓")
                                print(f"  10. 摘要:      源='{src_rec.get('摘要')}' -> 目标='{tgt_rec.get('摘要')}' ✓")
                                print(f"  11. 备注:      源='{src_rec.get('备注')}' -> 目标='{tgt_rec.get('备注')}' ✓")
                                print(f"  12. 交易流水号: 源='{src_rec.get('交易流水号')}' -> 目标='{tgt_rec.get('交易流水号')}' ✓")
                                print(f"  13. 类型:      源='{src_rec.get('交易类型')}' -> 目标='{tgt_rec.get('类型')}' ✓")
                if shown >= 3:
                    break

        if self.result.differences:
            print("\n" + "=" * 100)
            print(f"【差异详情】共 {len(self.result.differences)} 条")
            print("=" * 100)

            for i, diff in enumerate(self.result.differences[:10], 1):
                src_rec = diff["源记录"]
                print(f"\n  {i}. 来源: {diff['源文件']}")
                print(f"     我方账号: {src_rec.get('账号', 'N/A')} | 对方: {src_rec.get('对方户名', 'N/A')[:30]}")
                print(f"     日期: {src_rec.get('交易日', 'N/A')} | 支出: {src_rec.get('支取', 'N/A')} | 收入: {src_rec.get('收入', 'N/A')}")
                print(f"     差异字段 ({len(diff['差异'])} 个):")
                for d in diff["差异"]:
                    if d.get("按规则更新"):
                        print(f"       ℹ️ {d['字段']}: 源='{d['源值']}' -> 目标='{d['目标值']}'（按规则更新，正常）")
                    else:
                        marker = "🔴" if d.get("严重程度") == "高" else ("🟡" if d.get("严重程度") == "中" else "🟢")
                        print(f"       {marker} {d['字段']}: 源='{d['源值']}' -> 目标='{d['目标值']}'")

        print("\n" + "=" * 100)
        if count_ok and exp_ok and inc_ok:
            print("✅ 校验通过：记录数一致、支出/收入金额统计一致")
        else:
            reasons = []
            if not count_ok:
                reasons.append("记录数不一致")
            if not exp_ok:
                reasons.append("支出合计不一致")
            if not inc_ok:
                reasons.append("收入合计不一致")
            print(f"⚠️ 校验未通过：{', '.join(reasons)}")
        print("=" * 100)

def main():
    """命令行入口：源文件与目标表逐记录、逐字段比对"""
    import argparse

    parser = argparse.ArgumentParser(description='银行流水数据校验：源文件与目标表逐记录逐字段比对')
    parser.add_argument('--quiet', '-q', action='store_true', help='静默模式，只输出结果摘要')

    args = parser.parse_args()

    validator = BankFlowValidator()
    result = validator.validate_detailed(verbose=not args.quiet)

    # 输出JSON格式结果
    import json
    print("\n" + "=" * 100)
    print("【校验结果摘要(JSON)】")
    print("=" * 100)
    print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))

    return 0 if result.is_valid else 1


if __name__ == "__main__":
    sys.exit(main())
