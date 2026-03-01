#!/usr/bin/env python3
"""
银行流水同步主逻辑
用法:
  python run_workflow_simulation.py           # 仅同步
  python run_workflow_simulation.py --validate  # 同步后校验
  python run_workflow_simulation.py --full    # 全量同步（不检查已有记录）
  python run_workflow_simulation.py -o JH    # 仅同步包含 JH 的文件
"""
import os
import re
import sys
import csv
import io
import requests
from datetime import datetime

BASE = "https://open.feishu.cn"
FOLDER_TOKEN = "F9G4fieXYlS0JqdnDE8c2DqbnFe"
APP_TOKEN = "XeVSbKsMnaXzNNspHGzc9MKsn8d"
TABLE_ID = "tblPWmxgCe22gkqU"

_DEFAULT_FIELD_MAP = {
    "账号": ["账号", "卡号", "查询账号", "account", "Account No", "Account Number"],
    "账户名": ["账户名", "户名", "账户名称", "姓名", "Account Name", "Account Holder"],
    "交易日": ["交易日", "交易时间", "记账日期", "交易日期", "日期", "Date", "Value Date", "Transaction Date"],
    "支取": ["借方发生额（支取）", "借方发生额", "借方金额", "支出", "支取", "支出金额", "借", "Debit", "Withdrawal", "DR"],
    "收入": ["贷方发生额（收入）", "贷方发生额", "贷方金额", "收入金额", "收入", "贷", "Credit", "Deposit", "CR"],
    "币种": ["币种", "货币", "currency", "ccy", "Currency"],
    "对方户名": ["对方户名", "对手方名称", "对方名称", "Counterparty", "Beneficiary", "Payee", "Description"],
    "对方账号": ["对方账号", "对手方账号", "对方账户", "Counterparty Account"],
    "摘要": ["摘要", "交易摘要", "用途", "备注", "Narration", "Particulars", "Remarks"],
    "备注": ["备注", "附言", "memo", "Memo", "Reference"],
    "交易流水号": ["交易流水号", "流水号", "交易编号", "Reference", "Ref No", "Reference No", "交易序号"],
}


def _load_field_map():
    """从 config/field_mapping.yaml 加载 field_map，失败则用默认"""
    try:
        import yaml
    except ImportError:
        return _DEFAULT_FIELD_MAP
    cfg_path = os.path.join(os.path.dirname(__file__), "..", "config", "field_mapping.yaml")
    if not os.path.exists(cfg_path):
        return _DEFAULT_FIELD_MAP
    try:
        with open(cfg_path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        fm = cfg.get("field_map")
        if fm:
            return {k: (v if isinstance(v, list) else [v]) for k, v in fm.items()}
    except Exception:
        pass
    return _DEFAULT_FIELD_MAP


FIELD_MAP = _load_field_map()


def _load_company_profile_lookup():
    """从 config/company_profile.yaml 加载 source_prefix -> (公司名, 账号) 映射"""
    lookup = {}
    try:
        import yaml
    except ImportError:
        return lookup
    cfg_path = os.path.join(os.path.dirname(__file__), "..", "config", "company_profile.yaml")
    if not os.path.exists(cfg_path):
        return lookup
    try:
        with open(cfg_path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        for comp in (cfg.get("companies") or {}).values():
            name = comp.get("name") or ""
            for acc in comp.get("accounts") or []:
                prefix = (acc.get("source_prefix") or "").strip()
                if prefix:
                    lookup[prefix] = (name, str(acc.get("account") or ""))
    except Exception:
        pass
    return lookup


COMPANY_PROFILE_LOOKUP = _load_company_profile_lookup()
_WARNED_UNKNOWN_PREFIX = set()  # 未配置前缀仅警告一次


def _load_type_classification():
    """从 config/type_classification.yaml 加载类型分类规则"""
    try:
        import yaml
    except ImportError:
        return None
    cfg_path = os.path.join(os.path.dirname(__file__), "..", "config", "type_classification.yaml")
    if not os.path.exists(cfg_path):
        return None
    try:
        with open(cfg_path, encoding="utf-8") as f:
            return yaml.safe_load(f)
    except Exception:
        return None


_TYPE_CLASSIFICATION = _load_type_classification()


def classify_type(摘要, 对方户名, 备注="", 是否支出=True, 来源="", 货币=""):
    """根据摘要/对方户名/备注/来源/货币匹配类型。
    优先级：内部结算(对方户名) > 薪酬/分成(对方户名) > 收入按来源 > keywords 顺序。
    未匹配用 其他支出/其他收入。"""
    text = (str(摘要 or "") + " " + str(对方户名 or "") + " " + str(备注 or "")).strip().lower()
    对方户名_str = str(对方户名 or "").strip()
    来源_prefix = _extract_account_prefix(str(来源 or "")) if 来源 else ""
    货币_norm = (str(货币 or "").upper().replace(" ", "")) if 货币 else ""

    cfg = _TYPE_CLASSIFICATION
    if cfg:
        # 1. 内部结算优先：对方户名包含我方公司（青岛/北京/香港瑞拓思互转）
        internal_list = cfg.get("internal_settlement_counterparty") or []
        if internal_list and any(name in 对方户名_str for name in internal_list):
            return "内部结算"
        if 是否支出:
            salary_list = cfg.get("expense_counterparty_salary") or []
            if salary_list and any(name in 对方户名_str for name in salary_list):
                return "薪酬支付"
            rules = cfg.get("expense") or []
        else:
            share_list = cfg.get("income_counterparty_share") or []
            if share_list and any(name in 对方户名_str for name in share_list):
                return "分成到账"
            # 收入按来源默认：HK_OCBC_USD→销售回款，BJ_ZH_RMB→服务回款
            income_by_source = cfg.get("income_by_source") or {}
            if 来源_prefix and 来源_prefix in income_by_source:
                return income_by_source[来源_prefix]
            # 非瑞拓思三公司的美金收入→销售回款（QD/BJ/HK 以外若有）
            if 货币_norm == "USD" and 来源_prefix and not any(
                p in 来源_prefix.upper() for p in ["QD_", "BJ_", "HK_"]
            ):
                return "销售回款"
            rules = cfg.get("income") or []
        for rule in rules:
            kw = rule.get("keywords") or []
            t = rule.get("type")
            if t and any(k in text for k in kw):
                return t
    else:
        # 回退：无 config 时用内置规则（与旧逻辑一致，银行费用在杂费前）
        if 是否支出:
            fallback = [
                (["银行费用", "手续费", "汇费", "年费", "管理费"], "银行费用"),
                (["货款", "采购", "支付货款", "网上支付"], "货款支付"),
                (["货代", "运费", "物流", "运输"], "货代支付"),
                (["保险"], "保险支付"),
                (["提成"], "提成支付"),
                (["税", "缴税", "扣税", "实时缴税"], "税费支付"),
                (["工资", "薪酬", "代发"], "薪酬支付"),
                (["报销"], "报销支付"),
                (["房租", "租金"], "房租费用"),
                (["证照"], "证照费用"),
                (["财务记账"], "财务记账"),
                (["杂费", "收费"], "杂费支付"),
            ]
        else:
            fallback = [
                (["退税", "退税款", "出口退税"], "退税到账"),
                (["货款", "回款", "订单", "销售", "国外汇款", "大额支付", "转账收入"], "销售回款"),
                (["服务费", "服务收入"], "服务回款"),
                (["分成", "代发划转", "代发收费"], "分成到账"),
            ]
        for kw, t in fallback:
            if any(k in text for k in kw):
                return t
    return "其他支出" if 是否支出 else "其他收入"


def normalize_currency(v):
    """货币统一为 RMB 或 USD"""
    s = str(v or "").upper().replace(" ", "")
    if "USD" in s or "美元" in s or "DOLLAR" in s:
        return "USD"
    return "RMB"


def get_token():
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    if not app_id or not app_secret:
        cred = os.path.join(os.path.dirname(__file__), "..", ".feishu_credentials")
        if os.path.exists(cred):
            with open(cred) as f:
                for line in f:
                    if line.startswith("FEISHU_APP_ID="):
                        app_id = line.strip().split("=", 1)[1]
                    elif line.startswith("FEISHU_APP_SECRET="):
                        app_secret = line.strip().split("=", 1)[1]
    if not app_id or not app_secret:
        print("需 FEISHU_APP_ID、FEISHU_APP_SECRET 或 .feishu_credentials")
        return None
    r = requests.post(
        f"{BASE}/open-apis/auth/v3/tenant_access_token/internal",
        json={"app_id": app_id, "app_secret": app_secret},
    )
    j = r.json()
    return j.get("tenant_access_token") if j.get("code") == 0 else None


def list_files(token):
    r = requests.get(
        f"{BASE}/open-apis/drive/v1/files",
        params={"folder_token": FOLDER_TOKEN, "page_size": 200},
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return []
    return j.get("data", {}).get("files", [])


def download_raw(token, file_token):
    r = requests.get(
        f"{BASE}/open-apis/drive/v1/files/{file_token}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    if r.status_code != 200:
        return None
    raw = r.content
    try:
        j = r.json()
        if j.get("code") == 0 and j.get("data", {}).get("url"):
            r2 = requests.get(j["data"]["url"])
            raw = r2.content
    except Exception:
        pass
    return raw


def fetch_sheet_values(token, file_token, file_name, all_sheets=False):
    """通过飞书 Sheets API 获取电子表格数据。all_sheets=True 时合并所有工作表（用于建行多 sheet）"""
    r = requests.get(
        f"{BASE}/open-apis/sheets/v2/spreadsheets/{file_token}/metainfo",
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return []
    sheets = j.get("data", {}).get("sheets", [])
    if not sheets:
        return []
    all_rows = []
    for sh in (sheets if all_sheets else sheets[:1]):
        sheet_id = sh.get("sheetId")
        if not sheet_id:
            continue
        r2 = requests.get(
            f"{BASE}/open-apis/sheets/v2/spreadsheets/{file_token}/values/{sheet_id}!A1:Z500",
            headers={"Authorization": f"Bearer {token}"},
            params={"valueRenderOption": "FormattedValue"},
        )
        j2 = r2.json()
        vals = j2.get("data", {}).get("valueRange", {}).get("values")
        if not vals:
            vals = (j2.get("data", {}).get("valueRanges") or [{}])[0].get("values", [])
        if vals:
            if all_sheets and all_rows:
                all_rows.extend(vals[1:])
            else:
                all_rows.extend(vals)
    return all_rows if isinstance(all_rows, list) else []


def extract_date_from_filename(name):
    """支持 csv/xls/xlsx 后缀及飞书 sheet 无后缀命名（如 QD_VTB_RMB_20260225）"""
    m = re.search(r"_(\d{8})(?:\.(csv|xls|xlsx))?$", name or "", re.I)
    if m:
        return m.group(1)
    m = re.search(r"_(\d{8})$", name or "")
    return m.group(1) if m else None


def normalize_date_str(val):
    """将各种日期格式转为 YYYYMMDD，支持 Excel 序列号"""
    if val is None or val == "":
        return None
    s = str(val).strip()
    m = re.search(r"(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})", s)
    if m:
        return f"{m.group(1)}{int(m.group(2)):02d}{int(m.group(3)):02d}"
    m = re.search(r"(\d{8})", s)
    if m:
        return m.group(1)
    try:
        n = float(s)
        if 30000 < n < 50000:
            try:
                import xlrd
                t = xlrd.xldate_as_tuple(n, 0)
                return f"{t[0]:04d}{t[1]:02d}{t[2]:02d}"
            except Exception:
                pass
    except (ValueError, TypeError):
        pass
    return None


def _is_valid_source_file(f):
    """csv/xls/xlsx 或飞书 sheet（type=sheet，名如 QD_VTB_RMB_20260225、QDJH_20251202）"""
    name = (f.get("name") or "").strip()
    ftype = (f.get("type") or "").lower()
    if ftype == "sheet":
        return bool(re.search(r"_\d{8}$", name)) and any(
            x in name.upper() for x in ["ZH", "JH", "VTB", "OCBC", "RMB", "USD"]
        )
    return bool(re.search(r"\.(csv|xls|xlsx)$", name, re.I))


def _extract_account_prefix(name):
    """提取账户前缀用于分组，如 QD_JH_RMB_20260225 -> QD_JH_RMB"""
    s = str(name or "").strip()
    return re.sub(r"_\d{8}(?:\.[^.]+)?$", "", s, flags=re.I) or s


def filter_latest_date_files(files):
    """按账户组取最新：每组（QD_JH_RMB 等）只保留该组内日期最大的 1 个文件"""
    valid = [f for f in files if _is_valid_source_file(f)]
    by_prefix = {}
    for f in valid:
        prefix = _extract_account_prefix(f.get("name"))
        date = extract_date_from_filename(f.get("name"))
        if not date:
            continue
        if prefix not in by_prefix or date > extract_date_from_filename(by_prefix[prefix].get("name")):
            by_prefix[prefix] = f
    return list(by_prefix.values())


def find_col(row, keys):
    """按 keys 顺序在 row 中查找，支持列名含前后空格/制表符的精确匹配"""
    if not hasattr(row, "items"):
        return ""
    norm = {}
    for k, v in row.items():
        sk = str(k).strip().strip("\t")
        if sk and sk not in norm:
            norm[sk] = str(v or "").strip()
    for c in keys:
        cstr = str(c).strip()
        if cstr in norm:
            v = norm[cstr]
            if v and not v.startswith("["):
                return v
        for sk, v in norm.items():
            if cstr in sk or (len(cstr) >= 2 and cstr in sk):
                if v and not v.startswith("["):
                    return v
    return ""


def _find_header_row_xls(sheet):
    """定位表头行：需同时含日期列+金额列，排除账户信息行"""
    date_hints = ["交易日期", "记账日期", "日期", "Date", "Value Date", "起息日期", "ValueDate"]
    amt_hints = ["支出", "收入", "借方", "贷方", "支取", "Debit", "Credit", "Amount", "交易金额", "Transaction Amount", "Dr", "Cr"]

    # 尝试从账户信息行读取币种（OCBC格式）
    file_currency = None
    for r in range(min(5, sheet.nrows)):
        row_vals = [str(sheet.cell_value(r, c)).strip() for c in range(sheet.ncols)]
        combined = " ".join(row_vals)
        # 检测是否包含币种关键词
        if "币种" in combined or "Currency" in combined or "CCY" in combined.upper():
            # 查找币种值（通常是"美元"、"USD"、"人民币"、"RMB"等）
            for val in row_vals:
                val_upper = val.upper()
                if "USD" in val_upper or "美元" in val or "DOLLAR" in val_upper:
                    file_currency = "USD"
                    break
                elif "CNY" in val_upper or "RMB" in val_upper or "人民币" in val or "元" in val:
                    file_currency = "RMB"
                    break

    for r in range(min(25, sheet.nrows)):
        row_vals = [str(sheet.cell_value(r, c)).strip() for c in range(sheet.ncols)]
        combined = " ".join(row_vals)
        has_date = any(h in combined for h in date_hints)
        has_amt = any(h in combined for h in amt_hints)
        # 额外检查：真正的表头行应该有多个列（至少5列）有值，且不是账户信息行
        non_empty_cols = sum(1 for v in row_vals if v)
        is_likely_header = has_date and has_amt and non_empty_cols >= 5
        # 排除账户信息行（包含"账号"+数字，或"币种"但没有"日期"关键词的行）
        if is_likely_header and ("客户业务编号" in combined or "Transaction" in combined or "Date" in combined or non_empty_cols >= 10):
            headers = [v if v else f"col_{i}" for i, v in enumerate(row_vals)]
            return r, headers, file_currency
    # 默认返回，带上检测到的币种
    headers = [str(sheet.cell_value(0, c)).strip() or f"col_{c}" for c in range(sheet.ncols)]
    return 0, headers, file_currency


def parse_xls(raw, file_name):
    """解析 xls 文件"""
    try:
        import xlrd
    except ImportError:
        return []
    try:
        book = xlrd.open_workbook(file_contents=raw)
        sheet = book.sheet_by_index(0)
    except Exception:
        return []
    if sheet.nrows < 2:
        return []
    header_row_idx, headers, file_currency = _find_header_row_xls(sheet)
    results = []
    for r in range(header_row_idx + 1, sheet.nrows):
        row = {headers[c]: str(sheet.cell_value(r, c)).strip() for c in range(min(sheet.ncols, len(headers)))}
        date_str = normalize_date_str(find_col(row, FIELD_MAP["交易日"]))
        if not date_str:
            continue
        支取 = find_col(row, FIELD_MAP["支取"])
        收入 = find_col(row, FIELD_MAP["收入"])
        if not 支取 and not 收入:
            金额 = find_col(row, ["金额", "交易金额", "Amount", "Transaction Amount"])
            try:
                n = float(str(金额 or "0").replace(",", ""))
                if n < 0:
                    支取 = str(-n)
                elif n > 0:
                    收入 = str(n)
            except Exception:
                pass
        支取 = str(支取 or "").replace(",", "").replace(" ", "").strip()
        收入 = str(收入 or "").replace(",", "").replace(" ", "").strip()
        if not 支取 and not 收入:
            continue
        try:
            支取Num = float(支取) if 支取 else 0
        except Exception:
            支取Num = 0
        摘要 = find_col(row, FIELD_MAP["摘要"])
        对方户名 = find_col(row, FIELD_MAP["对方户名"])
        交易流水号 = find_col(row, FIELD_MAP["交易流水号"])

        # 币种处理：优先使用文件级币种（OCBC格式），其次从行中读取，最后默认RMB
        row_currency = find_col(row, FIELD_MAP["币种"])
        if row_currency:
            币种 = normalize_currency(row_currency)
        elif file_currency:
            币种 = file_currency
        else:
            币种 = "RMB"

        results.append({
            "账号": find_col(row, FIELD_MAP["账号"]),
            "账户名": find_col(row, FIELD_MAP["账户名"]),
            "交易日": date_str,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": 币种,
            "对方户名": 对方户名,
            "对方账号": find_col(row, FIELD_MAP["对方账号"]),
            "摘要": 摘要,
            "备注": find_col(row, FIELD_MAP["备注"]),
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, find_col(row, FIELD_MAP["备注"]), 支取Num > 0),
            "交易流水号": 交易流水号,
        })
    return results


def _find_header_row_xlsx(rows):
    """定位 xlsx 表头行：需同时含日期列+金额列"""
    date_hints = ["交易日期", "记账日期", "日期", "Date", "Value Date", "起息日期", "ValueDate"]
    amt_hints = ["支出", "收入", "借方", "贷方", "支取", "Debit", "Credit", "Amount", "交易金额", "Transaction Amount", "Dr", "Cr"]
    for r in range(min(25, len(rows))):
        row_vals = [str(c or "").strip() for c in rows[r]]
        combined = " ".join(row_vals)
        has_date = any(h in combined for h in date_hints)
        has_amt = any(h in combined for h in amt_hints)
        if has_date and has_amt:
            return r, [v if v else f"col_{i}" for i, v in enumerate(row_vals)]
    return 0, [str(c or "").strip() or f"col_{i}" for i, c in enumerate(rows[0])]


def parse_xlsx(raw, file_name):
    """解析 xlsx 文件"""
    try:
        import openpyxl
        from io import BytesIO
    except ImportError:
        return []
    try:
        wb = openpyxl.load_workbook(BytesIO(raw), read_only=True, data_only=True)
        sheet = wb.active
        rows = list(sheet.iter_rows(values_only=True))
    except Exception:
        return []
    if len(rows) < 2:
        return []
    header_row_idx, headers = _find_header_row_xlsx(rows)
    results = []
    for row in rows[header_row_idx + 1:]:
        row_dict = {headers[i]: str(c or "").strip() for i, c in enumerate(row) if i < len(headers)}
        date_str = normalize_date_str(find_col(row_dict, FIELD_MAP["交易日"]))
        if not date_str:
            continue
        支取 = find_col(row_dict, FIELD_MAP["支取"])
        收入 = find_col(row_dict, FIELD_MAP["收入"])
        if not 支取 and not 收入:
            金额 = find_col(row_dict, ["金额", "交易金额", "Amount", "Transaction Amount"])
            try:
                n = float(str(金额 or "0").replace(",", ""))
                if n < 0:
                    支取 = str(-n)
                elif n > 0:
                    收入 = str(n)
            except Exception:
                pass
        支取 = str(支取 or "").replace(",", "").replace(" ", "").strip()
        收入 = str(收入 or "").replace(",", "").replace(" ", "").strip()
        if not 支取 and not 收入:
            continue
        try:
            支取Num = float(支取) if 支取 else 0
        except Exception:
            支取Num = 0
        摘要 = find_col(row_dict, FIELD_MAP["摘要"])
        对方户名 = find_col(row_dict, FIELD_MAP["对方户名"])
        交易流水号 = find_col(row_dict, FIELD_MAP["交易流水号"])
        results.append({
            "账号": find_col(row_dict, FIELD_MAP["账号"]),
            "账户名": find_col(row_dict, FIELD_MAP["账户名"]),
            "交易日": date_str,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": find_col(row_dict, FIELD_MAP["币种"]) or "RMB",
            "对方户名": 对方户名,
            "对方账号": find_col(row_dict, FIELD_MAP["对方账号"]),
            "摘要": 摘要,
            "备注": find_col(row_dict, FIELD_MAP["备注"]),
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, find_col(row_dict, FIELD_MAP["备注"]), 支取Num > 0),
            "交易流水号": 交易流水号,
        })
    return results


def _norm_header(h):
    """规范化列名：去除前导 tab、引号、尾随 "," 等"""
    s = str(h or "").strip().strip("\t")
    for c in '",\t':
        s = s.strip(c)
    return s


def _clean_amt(v):
    """清理金额字符串中的引号、逗号等，便于 float 解析"""
    s = str(v or "").strip().strip('"').strip(",")
    return re.sub(r"[^\d.\-+]", "", s)


def parse_sheet_zh(rows, file_name):
    """中行 sheet：Row7 表头，Row8+ 数据；Col0 来账/往账，Col10 交易日期，Col13 交易金额(+/-)"""
    if not rows or len(rows) < 9:
        return []
    header_row = 7
    headers = [_norm_header(c) for c in (rows[header_row] if len(rows) > header_row else [])]
    results = []
    for row in rows[header_row + 1:]:
        if not any(c for c in row[:20]):
            continue
        row_dict = {headers[i]: str(c or "").strip() for i, c in enumerate(row) if i < len(headers)}
        交易类型 = str(row[0] or "").strip() if len(row) > 0 else ""
        交易日期 = normalize_date_str(row_dict.get("交易日期[ Transaction Date ]") or (row[10] if len(row) > 10 else ""))
        交易金额_raw = row_dict.get("交易金额[ Trade Amount ]") or (row[13] if len(row) > 13 else "")
        if not 交易日期 or 交易金额_raw is None or 交易金额_raw == "":
            continue
        try:
            amt = float(str(交易金额_raw).replace(",", "").replace(" ", "").strip())
        except (ValueError, TypeError):
            continue
        if 交易类型 == "来账":
            支取, 收入 = "", str(abs(amt)) if amt != 0 else ""
        elif 交易类型 == "往账":
            支取, 收入 = str(abs(amt)) if amt != 0 else "", ""
        else:
            continue
        if not 支取 and not 收入:
            continue
        来账 = 交易类型 == "来账"
        # 来账: 我方=收款人(col8,9) 对方=付款人(col4,5)；往账: 我方=付款人(col4,5) 对方=收款人(col8,9)
        if 来账:
            我方账号 = str(row[8] or "").strip() if len(row) > 8 else ""
            我方户名 = str(row[9] or "").strip() if len(row) > 9 else ""
            对方账号 = str(row[4] or "").strip() if len(row) > 4 else ""
            对方户名 = str(row[5] or "").strip() if len(row) > 5 else ""
        else:
            我方账号 = str(row[4] or "").strip() if len(row) > 4 else ""
            我方户名 = str(row[5] or "").strip() if len(row) > 5 else ""
            对方账号 = str(row[8] or "").strip() if len(row) > 8 else ""
            对方户名 = str(row[9] or "").strip() if len(row) > 9 else ""
        摘要 = str(row[1] or "").strip() if len(row) > 1 else ""
        try:
            支取Num = float(支取) if 支取 else 0
        except Exception:
            支取Num = 0
        results.append({
            "账号": 我方账号,
            "账户名": 我方户名,
            "交易日": 交易日期,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": "RMB",
            "对方户名": 对方户名,
            "对方账号": 对方账号,
            "摘要": 摘要,
            "备注": "",
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, "", 支取Num > 0),
            "交易流水号": "",
        })
    return results


def parse_sheet_ocbc(rows, file_name):
    """华侨银行 sheet：Row2 表头 支出/收入，Row3+ 数据"""
    if not rows or len(rows) < 4:
        return []
    header_row = 2
    headers = [str(c or "").strip() for c in rows[header_row]]
    results = []
    for row in rows[header_row + 1:]:
        row_dict = {headers[i]: str(c or "").strip() for i, c in enumerate(row) if i < len(headers)}
        date_str = normalize_date_str(find_col(row_dict, ["交易日期", "记账日期", "日期"]))
        if not date_str:
            continue
        支取 = str(find_col(row_dict, ["支出"]) or "").replace(",", "").strip()
        收入 = str(find_col(row_dict, ["收入"]) or "").replace(",", "").strip()
        try:
            支取n = float(支取) if 支取 else 0
            收入n = float(收入) if 收入 else 0
        except (ValueError, TypeError):
            continue
        if 支取n == 0 and 收入n == 0:
            continue
        支取 = 支取 or ""
        收入 = 收入 or ""
        摘要 = find_col(row_dict, FIELD_MAP["摘要"])
        对方户名 = find_col(row_dict, FIELD_MAP["对方户名"])
        results.append({
            "账号": find_col(row_dict, FIELD_MAP["账号"]) or "NRA7300079913",
            "账户名": find_col(row_dict, FIELD_MAP["账户名"]),
            "交易日": date_str,
            "支取": 支取,
            "收入": 收入,
            "币种": "USD",
            "对方户名": 对方户名,
            "对方账号": find_col(row_dict, FIELD_MAP["对方账号"]),
            "摘要": 摘要,
            "备注": find_col(row_dict, FIELD_MAP["备注"]),
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, find_col(row_dict, FIELD_MAP["备注"]), 支取n > 0),
            "交易流水号": "",
        })
    return results


def parse_sheet_vtb(rows, file_name):
    """VTB sheet：Row3 表头，Amount of transaction 正=收入负=支出"""
    if not rows or len(rows) < 5:
        return []
    header_row = 3
    headers = [str(c or "").strip() for c in rows[header_row]]
    results = []
    for row in rows[header_row + 1:]:
        if not any(row[:15]):
            continue
        amt_raw = row[9] if len(row) > 9 else None
        if amt_raw is None or amt_raw == "":
            continue
        try:
            amt = float(str(amt_raw).replace(",", ""))
        except (ValueError, TypeError):
            continue
        if amt > 0:
            支取, 收入 = "", str(amt)
        else:
            支取, 收入 = str(abs(amt)), ""
        date_val = row[0] if len(row) > 0 else row[11] if len(row) > 11 else ""
        date_str = normalize_date_str(str(date_val))
        if not date_str:
            continue
        对方户名 = str(row[6] or "").strip() if len(row) > 6 else ""
        摘要 = str(row[12] or "").strip() if len(row) > 12 else ""
        results.append({
            "账号": "40807156000610031039",
            "账户名": "青岛瑞拓思进出口有限公司",
            "交易日": date_str,
            "支取": 支取,
            "收入": 收入,
            "币种": "RMB",
            "对方户名": 对方户名,
            "对方账号": "",
            "摘要": 摘要,
            "备注": "",
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, "", bool(支取)),
            "交易流水号": "",
        })
    return results


def parse_sheet(rows, file_name):
    """解析飞书电子表格（通用/建行）：表头可能含噪声，列名为 借方发生额/贷方发生额"""
    if not rows or len(rows) < 2:
        return []
    header_row_idx, headers = _find_header_row_xlsx(rows)
    headers = [_norm_header(h) for h in headers]
    results = []
    for row in rows[header_row_idx + 1:]:
        row_dict = {headers[i]: str(c or "").strip() for i, c in enumerate(row) if i < len(headers)}
        date_str = normalize_date_str(find_col(row_dict, FIELD_MAP["交易日"]))
        if not date_str:
            continue
        支取 = _clean_amt(find_col(row_dict, FIELD_MAP["支取"]))
        收入 = _clean_amt(find_col(row_dict, FIELD_MAP["收入"]))
        if not 支取 and not 收入:
            金额 = find_col(row_dict, ["金额", "交易金额", "Amount", "Transaction Amount"])
            try:
                n = float(_clean_amt(金额) or "0")
                if n < 0:
                    支取 = str(abs(n))
                elif n > 0:
                    收入 = str(n)
            except Exception:
                pass
        if not 支取 and not 收入:
            continue
        try:
            支取Num = float(支取) if 支取 else 0
        except Exception:
            支取Num = 0
        摘要 = find_col(row_dict, FIELD_MAP["摘要"])
        对方户名 = find_col(row_dict, FIELD_MAP["对方户名"])
        交易流水号 = find_col(row_dict, FIELD_MAP["交易流水号"])
        results.append({
            "账号": find_col(row_dict, FIELD_MAP["账号"]),
            "账户名": find_col(row_dict, FIELD_MAP["账户名"]),
            "交易日": date_str,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": find_col(row_dict, FIELD_MAP["币种"]) or "RMB",
            "对方户名": 对方户名,
            "对方账号": find_col(row_dict, FIELD_MAP["对方账号"]),
            "摘要": 摘要,
            "备注": find_col(row_dict, FIELD_MAP["备注"]),
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, find_col(row_dict, FIELD_MAP["备注"]), 支取Num > 0),
            "交易流水号": 交易流水号,
        })
    return results


def parse_csv(raw, file_name):
    """解析 CSV 文件"""
    for enc in ("utf-8-sig", "utf-8", "gbk"):
        try:
            text = raw.decode(enc) if isinstance(raw, bytes) else raw
            break
        except Exception:
            continue
    else:
        text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
    lines = text.strip().split("\n")
    if len(lines) < 2:
        return []
    results = []
    # 中行来账/往账：用 csv.reader 正确解析带千位逗号的金额（如 +246,000.00）
    _amount_pat = re.compile(r"^([+-]?)[\d,]+\.?\d*$")
    for line in lines:
        if "来账" not in line and "往账" not in line:
            continue
        try:
            parts = next(csv.reader(io.StringIO(line)))
        except Exception:
            parts = [p.strip(' "\t') for p in re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', line) if p.strip()]
        parts = [str(p).strip(' "\t') for p in parts]
        if len(parts) < 14:
            continue
        date_str = next((p for p in parts if re.match(r"^\d{8}$", p)), None)

        def _parse_amt(s):
            s = str(s or "").replace(",", "").replace(" ", "").strip()
            if not s or not _amount_pat.match(s):
                return None
            try:
                n = float(s)
                return n if 0.01 <= abs(n) < 1e8 else None
            except (ValueError, TypeError):
                return None

        amt_val = None
        if len(parts) > 13:
            n = _parse_amt(parts[13])
            if n is not None:
                amt_val = (str(abs(n)) if n < 0 else "", str(n) if n > 0 else "")
        if not amt_val:
            for p in parts:
                n = _parse_amt(p)
                if n is not None:
                    amt_val = (str(abs(n)) if n < 0 else "", str(n) if n > 0 else "")
                    break
        if not date_str or not amt_val:
            continue
        # 中行 CSV：正数=收入、负数=支取（来账/往账均按符号）
        支取, 收入 = amt_val
        来账 = "来账" in line
        摘要 = (parts[1] or "").strip()
        # 来账：我方=parts[8][9], 对方=parts[4][5]；往账：我方=parts[4][5], 对方=parts[8][9]
        if 来账:
            账号 = (parts[8] or "").strip() if len(parts) > 8 else ""
            账户名 = (parts[9] or "").strip() if len(parts) > 9 else ""
            对方户名 = (parts[5] or "").strip()
            对方账号 = (parts[4] or "").strip() if len(parts) > 4 else ""
        else:
            账号 = (parts[4] or "").strip() if len(parts) > 4 else ""
            账户名 = (parts[5] or "").strip()
            对方户名 = (parts[9] or "").strip() if len(parts) > 9 else ""
            对方账号 = (parts[8] or "").strip() if len(parts) > 8 else ""
        results.append({
            "账号": 账号,
            "账户名": 账户名,
            "交易日": date_str,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": "USD" if any("USD" in str(x) or "美元" in str(x) for x in parts) else "RMB",
            "对方户名": 对方户名,
            "对方账号": 对方账号,
            "摘要": 摘要,
            "备注": "",
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, "", float(支取 or 0) > 0),
            "交易流水号": "",  # 中行来账/往账无标准流水号列
        })
    if results:
        # 不做中行去重：以交易流水号为准，无流水号时每行一条
        return results
    
    # 检测是否为VTB格式（多行表头，第4行是真正表头）
    is_vtb = "VTB" in (file_name or "").upper() and "Account No" in text
    
    if is_vtb:
        # VTB格式：跳过前3行（账户信息+空行），从第4行开始
        text_lines = text.split("\n")
        if len(text_lines) >= 4:
            # 找到真正的表头行（包含Date的）
            header_idx = 0
            for i, line in enumerate(text_lines[:5]):
                if "Date" in line or "Transaction Type" in line:
                    header_idx = i
                    break
            # 重新组装CSV内容
            text = "\n".join(text_lines[header_idx:])
    
    # 标准 CSV
    try:
        rows_dict = list(csv.DictReader(io.StringIO(text)))
    except Exception:
        return []
    for row in rows_dict:
        date_str = normalize_date_str(find_col(row, FIELD_MAP["交易日"]))
        if not date_str:
            continue
        支取 = find_col(row, FIELD_MAP["支取"])
        收入 = find_col(row, FIELD_MAP["收入"])
        if not 支取 and not 收入:
            金额 = find_col(row, ["金额", "交易金额", "Amount", "Transaction Amount"])
            try:
                n = float(str(金额 or "0").replace(",", ""))
                if n < 0:
                    支取 = str(-n)
                elif n > 0:
                    收入 = str(n)
            except Exception:
                pass
        支取 = str(支取 or "").replace(",", "").replace(" ", "").strip()
        收入 = str(收入 or "").replace(",", "").replace(" ", "").strip()
        if not 支取 and not 收入:
            continue
        try:
            支取Num = float(支取) if 支取 else 0
        except Exception:
            支取Num = 0
        摘要 = find_col(row, FIELD_MAP["摘要"])
        对方户名 = find_col(row, FIELD_MAP["对方户名"])
        交易流水号 = find_col(row, FIELD_MAP["交易流水号"])
        results.append({
            "账号": find_col(row, FIELD_MAP["账号"]),
            "账户名": find_col(row, FIELD_MAP["账户名"]),
            "交易日": date_str,
            "支取": 支取 or "",
            "收入": 收入 or "",
            "币种": find_col(row, FIELD_MAP["币种"]) or "RMB",
            "对方户名": 对方户名,
            "对方账号": find_col(row, FIELD_MAP["对方账号"]),
            "摘要": 摘要,
            "备注": find_col(row, FIELD_MAP["备注"]),
            "来源文件": file_name,
            "交易类型": classify_type(摘要, 对方户名, find_col(row, FIELD_MAP["备注"]), 支取Num > 0),
            "交易流水号": 交易流水号,
        })
    return results


def _amt_str(v):
    """金额统一为最多2位小数的字符串"""
    try:
        return f"{float(str(v or '0').replace(',', '')):.2f}"
    except Exception:
        return str(v or "0")


def record_key(row):
    """增量去重唯一键：来源+账号+日期+金额+对方户名+行号（交易流水号未写入目标表时暂不使用）"""
    # 有交易流水号且目标表有此字段时可用 ("_flow_no", 来源, 流水号)
    return (
        row.get("来源文件", ""),
        str(row.get("账号", ""))[:30],
        row.get("交易日", ""),
        _amt_str(row.get("支取")),
        _amt_str(row.get("收入")),
        str(row.get("对方户名", ""))[:50],
        row.get("_parse_row", 0),
    )


def fetch_target_field_names(token):
    """获取目标表存在的字段名，用于写入时过滤"""
    r = requests.get(
        f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/fields",
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return None
    return {f.get("field_name") for f in j.get("data", {}).get("items", []) if f.get("field_name")}


def fetch_existing_keys(token):
    """标准4: 获取目标表已有记录的键集合（同基础键多笔用序号区分）"""
    base_keys = []
    page_token = None
    while True:
        params = {"page_size": 500}
        if page_token:
            params["page_token"] = page_token
        r = requests.get(
            f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        j = r.json()
        if j.get("code") != 0:
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
            try:
                支取 = _amt_str(f.get("支出"))
            except Exception:
                支取 = "0"
            try:
                收入 = _amt_str(f.get("收入"))
            except Exception:
                收入 = "0"
            账号 = str(f.get("我方账号") or f.get("账号", ""))[:30]
            对方户名 = str(f.get("对方账户", "") or "")[:50]
            base_keys.append((f.get("来源", ""), 账号, td, 支取, 收入, 对方户名))
        page_token = j.get("data", {}).get("page_token")
        if not page_token or not items:
            break
    from collections import Counter
    cnt = Counter()
    keys = set()
    for bk in base_keys:
        i = cnt[bk]
        cnt[bk] += 1
        keys.add(bk + (i,))
    return keys


def to_bitable_fields(row):
    """标准3: 按目标表字段映射，采用我方/对方命名，类型由摘要分类。
    我方账户/我方账号优先从 company_profile 按来源文件前缀派生，避免 CSV 列解析错误。"""
    prefix = _extract_account_prefix(row.get("来源文件", ""))
    if prefix and prefix in COMPANY_PROFILE_LOOKUP:
        我方账户, 我方账号 = COMPANY_PROFILE_LOOKUP[prefix]
    else:
        我方账户 = "未配置"
        我方账号 = ""
        if prefix and prefix not in COMPANY_PROFILE_LOOKUP and prefix not in _WARNED_UNKNOWN_PREFIX:
            _WARNED_UNKNOWN_PREFIX.add(prefix)
            print(f"   [提示] 来源 {prefix} 未在 company_profile 中配置，我方账户置为「未配置」")
    对方账户 = row.get("对方户名", "") or ""
    对方账号 = row.get("对方账号", "") or ""
    摘要 = row.get("摘要", "") or ""
    try:
        是否支出 = float(str(row.get("支取", "0") or "0").replace(",", "")) > 0
    except (ValueError, TypeError):
        是否支出 = False
    类型 = classify_type(
        摘要, 对方账户, row.get("备注", "") or "", 是否支出,
        来源=row.get("来源文件", "") or "",
        货币=normalize_currency(row.get("币种") or row.get("货币", "")),
    )

    out = {
        "我方账户": 我方账户,
        "我方账号": 我方账号,
        "对方账户": 对方账户,
        "对方账号": 对方账号,
        "类型": 类型,
        "货币": normalize_currency(row.get("币种")),
        "支出": 0.0,
        "收入": 0.0,
        "摘要": (对方账户 + (" | " + 摘要 if 摘要 else "")).strip() or "",
        "备注": row.get("备注", "") or "",
        "来源": row.get("来源文件", "") or "",
    }
    # 交易流水号：若目标表有该字段可写入，用于去重
    if row.get("交易流水号"):
        out["交易流水号"] = str(row.get("交易流水号", "")).strip()
    # 支出/收入
    try:
        out["支出"] = float(str(row.get("支取", "0") or "0").replace(",", ""))
    except (ValueError, TypeError):
        out["支出"] = 0.0
    try:
        out["收入"] = float(str(row.get("收入", "0") or "0").replace(",", ""))
    except (ValueError, TypeError):
        out["收入"] = 0.0
    # 交易日期
    v = row.get("交易日", "")
    if v:
        m = re.search(r"(\d{4})(\d{2})(\d{2})", str(v))
        if m:
            try:
                dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                out["交易日期"] = int(dt.timestamp() * 1000)
            except Exception:
                out["交易日期"] = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
        else:
            out["交易日期"] = v
    else:
        out["交易日期"] = int(datetime.now().timestamp() * 1000)
    # 兼容旧字段（账户=我方账户，账号=我方账号，重复字段）
    out["账户"] = 我方账户
    out["账号"] = 我方账号
    return out


def main():
    only_prefix = None
    full_sync = False
    do_validate = False
    args = sys.argv[1:]
    for i, a in enumerate(args):
        if a in ("--only", "-o") and i + 1 < len(args):
            only_prefix = args[i + 1].upper()
        elif a in ("--full", "-f"):
            full_sync = True
        elif a in ("--validate", "-v"):
            do_validate = True

    token = get_token()
    if not token:
        return 1
    print("1. 列出文件...")
    files = list_files(token)
    source_files = [f for f in files if _is_valid_source_file(f)]
    print(f"   找到 {len(source_files)} 个源文件 (csv/xls/xlsx/sheet)")
    if not source_files:
        print("无源文件，跳过")
        return 0

    # 标准2: 只处理最新日期
    to_process = filter_latest_date_files(source_files)
    if only_prefix:
        to_process = [f for f in to_process if only_prefix in ((f.get("name") or "").upper())]
        print(f"   仅同步包含 '{only_prefix}' 的文件: {len(to_process)} 个")
        if not to_process:
            print("无匹配文件，跳过")
            return 0
    max_d = max((extract_date_from_filename(f.get("name")) for f in to_process), default="")
    print(f"   最新日期: {max_d}，待处理 {len(to_process)} 个文件")

    # 获取目标表字段名，只写入存在的字段
    target_fields = fetch_target_field_names(token)
    if not target_fields:
        print("无法获取目标表字段，写入可能失败")
    else:
        print(f"2. 目标表字段: {len(target_fields)} 个")

    # 标准4: 获取已有记录键（--full 时跳过，全量写入）
    if full_sync:
        print("3. 全量模式，不检查已有记录")
        existing_keys = set()
    else:
        print("3. 获取目标表已有记录（增量去重用）...")
        existing_keys = fetch_existing_keys(token)
        print(f"   已有 {len(existing_keys)} 条")

    written = 0
    total_rows = 0
    for f in to_process:
        name = f.get("name", "")
        ftype = (f.get("type") or "").lower()
        file_token = f.get("token")

        if ftype == "sheet":
            name_upper = (name or "").upper()
            sheet_rows = fetch_sheet_values(
                token, file_token, name,
                all_sheets=("_JH_" in name_upper),
            )
            if not sheet_rows:
                print(f"   获取失败: {name}")
                continue
            if "_ZH_" in name_upper:
                rows = parse_sheet_zh(sheet_rows, name)
            elif "_OCBC_" in name_upper:
                rows = parse_sheet_ocbc(sheet_rows, name)
            elif "_VTB_" in name_upper:
                rows = parse_sheet_vtb(sheet_rows, name)
            else:
                rows = parse_sheet(sheet_rows, name)
        else:
            raw = download_raw(token, file_token)
            if not raw:
                print(f"   下载失败: {name}")
                continue
            ext = (name or "").split(".")[-1].lower()
            if ext == "xls":
                rows = parse_xls(raw, name)
            elif ext == "xlsx":
                rows = parse_xlsx(raw, name)
            else:
                rows = parse_csv(raw, name)
        total_rows += len(rows)
        print(f"3. {name}: 解析 {len(rows)} 条")
        if len(rows) == 0:
            print(f"   [提示] 解析 0 条，请检查文件格式或列名是否在 FIELD_MAP 中")
        # 为同基础键的多笔分配 _parse_row 序号（区分完全相同的多笔如手续费）
        from collections import Counter
        base_cnt = Counter()
        for row in rows:
            bk = (row.get("来源文件",""), str(row.get("账号",""))[:30], row.get("交易日",""),
                  _amt_str(row.get("支取")), _amt_str(row.get("收入")), str(row.get("对方户名",""))[:50])
            row["_parse_row"] = base_cnt[bk]
            base_cnt[bk] += 1
        for row in rows:
            if record_key(row) in existing_keys:
                continue
            fields = to_bitable_fields(row)
            if target_fields:
                fields = {k: v for k, v in fields.items() if k in target_fields}
            r = requests.post(
                f"{BASE}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"fields": fields},
            )
            if r.json().get("code") == 0:
                written += 1
                existing_keys.add(record_key(row))
                print(f"   写入: {row.get('交易日')} {row.get('交易类型','')} {row.get('对方户名','')[:12]}...")
            else:
                print(f"   写入失败: {r.json().get('msg')}")

    print(f"\n共解析 {total_rows} 条，新增写入 {written} 条（增量模式）")

    if do_validate:
        import subprocess
        print("\n" + "=" * 60)
        print("【校验】")
        print("=" * 60)
        r = subprocess.run(
            [sys.executable, os.path.join(os.path.dirname(__file__), "validate_bankflow.py")],
            cwd=os.path.dirname(os.path.dirname(__file__)),
        )
        if r.returncode != 0:
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
