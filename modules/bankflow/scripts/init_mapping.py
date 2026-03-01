#!/usr/bin/env python3
"""
初始化：交互式建立目标-源 字段映射配置
1. 用户输入：我方公司名、开户行、开户账号（可按源文件分别输入）
2. 拉取源文件表头与目标表字段，自动生成字段映射规则
3. 展示完整映射供用户确认，确认无误后保存，init 方视为完成
"""
import os
import re
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, "config", "field_mapping.yaml")
PROFILE_PATH = os.path.join(BASE_DIR, "config", "company_profile.yaml")
DOC_PATH = os.path.join(BASE_DIR, "docs", "TARGET_SOURCE_FIELD_MAP.md")

# 默认配置（首次运行无配置文件时使用）
DEFAULT_APP_TOKEN = "XeVSbKsMnaXzNNspHGzc9MKsn8d"
DEFAULT_TABLE_ID = "tblPWmxgCe22gkqU"
DEFAULT_FOLDER_TOKEN = "F9G4fieXYlS0JqdnDE8c2DqbnFe"

# 解析层 -> 源列名候选（用于自动匹配）
FIELD_MAP_CANDIDATES = {
    "账号": ["账号", "卡号", "查询账号", "account", "Account No", "Account Number"],
    "账户名": ["账户名", "户名", "账户名称", "姓名", "Account Name", "Account Holder"],
    "交易日": ["交易日", "交易时间", "记账日期", "交易日期", "日期", "Date", "Value Date", "Transaction Date"],
    "支取": ["支取", "支出", "借方发生额（支取）", "借方发生额", "借方金额", "支出金额", "借", "Debit", "Withdrawal", "DR"],
    "收入": ["收入", "贷方发生额（收入）", "贷方发生额", "贷方金额", "收入金额", "贷", "Credit", "Deposit", "CR"],
    "币种": ["币种", "货币", "currency", "ccy", "Currency"],
    "对方户名": ["对方户名", "对手方名称", "对方名称", "Counterparty", "Beneficiary", "Payee", "Description"],
    "对方账号": ["对方账号", "对手方账号", "对方账户", "Counterparty Account"],
    "摘要": ["摘要", "交易摘要", "用途", "备注", "Narration", "Particulars", "Remarks"],
    "备注": ["备注", "附言", "memo", "Memo", "Reference"],
    "交易流水号": ["交易流水号", "流水号", "交易编号", "Reference", "Ref No", "Reference No", "交易序号"],
}

ZH_PARTS = {
    "来账": {"账号": 8, "账户名": 9, "对方户名": 5, "对方账号": 4, "摘要": 1, "金额": [13, 14]},
    "往账": {"账号": 4, "账户名": 5, "对方户名": 9, "对方账号": 8, "摘要": 1, "金额": [13, 14]},
}


def _load_existing_config():
    """加载已有配置"""
    cfg = {}
    if os.path.exists(CONFIG_PATH):
        try:
            import yaml
            with open(CONFIG_PATH, encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
        except Exception:
            pass
    return cfg


def _get_token():
    """获取飞书 token，失败返回 None"""
    try:
        import requests
        BASE = "https://open.feishu.cn"
        app_id = os.environ.get("FEISHU_APP_ID")
        app_secret = os.environ.get("FEISHU_APP_SECRET")
        if not app_id or not app_secret:
            cred = os.path.join(BASE_DIR, ".feishu_credentials")
            if os.path.exists(cred):
                with open(cred) as f:
                    for line in f:
                        if line.startswith("FEISHU_APP_ID="):
                            app_id = line.strip().split("=", 1)[1]
                        elif line.startswith("FEISHU_APP_SECRET="):
                            app_secret = line.strip().split("=", 1)[1]
        if not app_id or not app_secret:
            return None
        r = requests.post(
            f"{BASE}/open-apis/auth/v3/tenant_access_token/internal",
            json={"app_id": app_id, "app_secret": app_secret},
        )
        j = r.json()
        return j.get("tenant_access_token") if j.get("code") == 0 else None
    except Exception:
        return None


def _list_files(token, folder_token):
    """列出目录内文件"""
    import requests
    BASE = "https://open.feishu.cn"
    r = requests.get(
        f"{BASE}/open-apis/drive/v1/files",
        params={"folder_token": folder_token, "page_size": 200},
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return []
    return j.get("data", {}).get("files", [])


def _fetch_sheet_values(token, file_token):
    """通过飞书 Sheets API 获取电子表格数据，返回行列表"""
    import requests
    BASE = "https://open.feishu.cn"
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
    sheet_id = sheets[0].get("sheetId")
    if not sheet_id:
        return []
    r2 = requests.get(
        f"{BASE}/open-apis/sheets/v2/spreadsheets/{file_token}/values/{sheet_id}!A1:Z200",
        headers={"Authorization": f"Bearer {token}"},
        params={"valueRenderOption": "FormattedValue"},
    )
    j2 = r2.json()
    vals = j2.get("data", {}).get("valueRange", {}).get("values")
    if not vals:
        vals = (j2.get("data", {}).get("valueRanges") or [{}])[0].get("values", [])
    return vals if isinstance(vals, list) else []


def _download_file(token, file_token):
    """下载文件内容"""
    import requests
    BASE = "https://open.feishu.cn"
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


def _extract_source_prefix(name):
    """从文件名提取源前缀：QD_ZH_RMB_20260225.csv -> QD_ZH_RMB；QD_VTB_RMB_20260225(sheet) -> QD_VTB_RMB；QDJH_20251202 -> QDJH"""
    m = re.match(r"^(.+)_(\d{8})(?:\.(csv|xls|xlsx))?$", (name or "").strip(), re.I)
    return m.group(1) if m and m.group(1) else None


def _extract_headers_from_sheet(rows):
    """从飞书 sheet 行数据提取表头（与 xlsx 相同逻辑）"""
    if not rows or len(rows) < 2:
        return None
    date_hints = ["交易日期", "记账日期", "日期", "Date", "Value Date"]
    amt_hints = ["支出", "收入", "借方", "贷方", "支取", "Debit", "Credit", "Amount"]
    for r in range(min(25, len(rows))):
        row_vals = [str(c or "").strip() for c in (rows[r] if r < len(rows) else [])]
        combined = " ".join(row_vals)
        if any(h in combined for h in date_hints) and any(h in combined for h in amt_hints):
            return [v if v else f"col_{i}" for i, v in enumerate(row_vals)]
    return [v if v else f"col_{i}" for i, v in enumerate(rows[0])] if rows else None


def _extract_headers_from_file(raw, name):
    """从文件提取表头（列名）。中行格式返回 None（用 zh_parts）"""
    ext = ((name or "").split(".")[-1] or "").lower()
    is_zh_file = "_ZH_" in (name or "").upper()
    if ext == "csv":
        for enc in ("utf-8-sig", "utf-8", "gbk"):
            try:
                text = raw.decode(enc) if isinstance(raw, bytes) else raw
                break
            except Exception:
                continue
        else:
            text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else raw
        lines = text.strip().split("\n")
        if not lines:
            return None
        # 中行文件：存在含「来账」或「往账」且列数>=14 的行
        if is_zh_file:
            for line in lines[:50]:
                if ("来账" in line or "往账" in line) and len(line.split(",")) >= 14:
                    return None
        first = lines[0]
        if "来账" in first or "往账" in first:
            return None
        import csv
        import io
        try:
            reader = csv.reader(io.StringIO(first))
            row = next(reader)
            return [c.strip().strip('"\t') for c in row if c.strip()]
        except Exception:
            return None
    if ext in ("xls", "xlsx"):
        try:
            if ext == "xls":
                import xlrd
                book = xlrd.open_workbook(file_contents=raw)
                sheet = book.sheet_by_index(0)
                rows = [[str(sheet.cell_value(r, c)).strip() for c in range(sheet.ncols)] for r in range(min(15, sheet.nrows))]
            else:
                import openpyxl
                from io import BytesIO
                wb = openpyxl.load_workbook(BytesIO(raw), read_only=True, data_only=True)
                sheet = wb.active
                rows = [[str(c or "").strip() for c in row] for row in list(sheet.iter_rows(values_only=True))[:15]]
            date_hints = ["交易日期", "记账日期", "日期", "Date", "Value Date"]
            amt_hints = ["支出", "收入", "借方", "贷方", "支取", "Debit", "Credit", "Amount"]
            for r, row_vals in enumerate(rows):
                combined = " ".join(row_vals)
                if any(h in combined for h in date_hints) and any(h in combined for h in amt_hints):
                    return [v if v else f"col_{i}" for i, v in enumerate(row_vals)]
            return [v if v else f"col_{i}" for i, v in enumerate(rows[0])] if rows else None
        except Exception:
            return None
    return None


def _get_target_fields(token, app_token, table_id):
    """获取目标表字段名列表"""
    import requests
    BASE = "https://open.feishu.cn"
    r = requests.get(
        f"{BASE}/open-apis/bitable/v1/apps/{app_token}/tables/{table_id}/fields",
        headers={"Authorization": f"Bearer {token}"},
    )
    j = r.json()
    if j.get("code") != 0:
        return []
    return [f.get("field_name") for f in j.get("data", {}).get("items", [])]


def _match_headers_to_field_map(headers):
    """将源表头匹配到解析层，返回 field_map（解析层->[匹配到的源列名]+候选）"""
    norm_headers = {str(h).strip().strip("\t"): h for h in (headers or []) if h}
    field_map = {}
    for parse_key, candidates in FIELD_MAP_CANDIDATES.items():
        matched = []
        for c in candidates:
            cstr = str(c).strip()
            for nh, orig in norm_headers.items():
                if cstr == nh and orig not in matched:
                    matched.append(orig)
                    break
        result = [m for m in matched] + [c for c in candidates if c not in matched]
        field_map[parse_key] = result[:12]
    return field_map


def _interactive_input_accounts(discovered_prefixes):
    """交互式输入公司/开户行/账号，按源文件前缀"""
    print("\n" + "=" * 50)
    print("请输入我方账户信息（每个源文件类型对应一个账户）")
    print("源文件命名：{公司}_{银行}_{货币}_{日期}.csv，如 QD_ZH_RMB_20260225.csv")
    print("=" * 50)
    accounts = []
    seen = set()
    for prefix in discovered_prefixes:
        if prefix in seen:
            continue
        seen.add(prefix)
        print(f"\n--- 源文件前缀: {prefix} ---")
        company = input("  公司名称（我方账户名）: ").strip() or None
        bank = input("  开户行: ").strip() or None
        account = input("  开户账号: ").strip() or None
        currency = "RMB" if "USD" not in prefix.upper() else "USD"
        accounts.append({
            "prefix": prefix,
            "company": company,
            "bank": bank,
            "account": account,
            "currency": currency,
        })
    return accounts


def _accounts_to_profile(accounts):
    """将输入的账户列表转为 company_profile 结构"""
    companies = {}
    bank_codes = {"中国银行": "ZH", "建设银行": "JH", "华侨银行": "OCBC", "工商银行": "GS"}
    for acc in accounts:
        code = acc["prefix"].split("_")[0] if "_" in acc["prefix"] else "DEFAULT"
        if code not in companies:
            companies[code] = {"name": acc.get("company") or "", "accounts": []}
        bank_code = bank_codes.get(acc.get("bank", ""), "?")
        companies[code]["accounts"].append({
            "bank": acc.get("bank") or "",
            "bank_code": bank_code,
            "account": acc.get("account") or "",
            "currency": acc.get("currency", "RMB"),
            "source_prefix": acc["prefix"],
        })
    return {"companies": companies}


def _build_source_file_mapping(prefix_to_format, prefix_to_headers):
    """根据源类型和表头生成 source_file_mapping"""
    sfm = {}
    for prefix, fmt in prefix_to_format.items():
        if fmt == "zh":
            sfm[prefix] = {
                "format": "zh",
                "我方账户": {"from": "parts", "来账": 9, "往账": 5},
                "我方账号": {"from": "parts", "来账": 8, "往账": 4},
                "对方账户": {"from": "parts", "来账": 5, "往账": 9},
                "对方账号": {"from": "parts", "来账": 4, "往账": 8},
                "交易日期": {"from": "regex", "pattern": r"\d{8}"},
                "支出": {"from": "parts", "index": [13, 14]},
                "收入": {"from": "parts", "index": [13, 14]},
                "摘要": {"from": "parts", "index": 1},
                "备注": "",
            }
        else:
            headers = prefix_to_headers.get(prefix) or []
            fm = _match_headers_to_field_map(headers)
            sfm[prefix] = {
                "format": "standard",
                "我方账户": "field_map.账户名",
                "我方账号": "field_map.账号",
                "对方账户": "field_map.对方户名",
                "对方账号": "field_map.对方账号",
                "交易日期": "field_map.交易日",
                "支出": "field_map.支取",
                "收入": "field_map.收入",
                "摘要": "field_map.摘要",
                "备注": "field_map.备注",
                "_detected_columns": list(headers),
                "_field_map_used": fm,
            }
    return sfm


def _merge_field_map(detected_map, default_candidates):
    """合并检测到的 field_map 与默认候选"""
    merged = {}
    for k, default_list in default_candidates.items():
        detected = detected_map.get(k, [])
        seen = set()
        result = []
        for c in detected:
            if c and c not in seen:
                result.append(c)
                seen.add(c)
        for c in default_list:
            if c not in seen:
                result.append(c)
                seen.add(c)
        merged[k] = result[:12]
    return merged


def main():
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    cfg = _load_existing_config()
    app_token = (cfg.get("target") or {}).get("app_token") or DEFAULT_APP_TOKEN
    table_id = (cfg.get("target") or {}).get("table_id") or DEFAULT_TABLE_ID
    folder_token = (cfg.get("source") or {}).get("folder_token") or DEFAULT_FOLDER_TOKEN

    print("银行流水汇总 - 初始化配置")
    print("-" * 50)

    # 1. 获取 token 并拉取源文件、目标表结构
    try:
        token = _get_token()
    except Exception as e:
        print(f"连接飞书失败: {e}")
        token = None
    offline = False
    if not token:
        print("无法连接飞书（请配置 FEISHU_APP_ID、FEISHU_APP_SECRET 或 .feishu_credentials）")
        offline = input("是否离线模式继续（使用默认源前缀与映射）？(y/n): ").strip().lower() == "y"
        if not offline:
            return 1
        token = None
        print("离线模式")
    else:
        print("已连接飞书")

    prefixes = []
    prefix_to_headers = {}
    prefix_to_format = {}
    detected_field_map = {}

    if token:
        files = _list_files(token, folder_token)
        csv_xls = [f for f in files if re.search(r"\.(csv|xls|xlsx)$", f.get("name") or "", re.I)]
        sheet_files = [f for f in files if (f.get("type") or "").lower() == "sheet" and re.search(r"_\d{8}$", f.get("name") or "")]
        source_files = csv_xls + sheet_files
        prefixes = sorted(set(p for p in (_extract_source_prefix(f.get("name")) for f in source_files) if p))
        if prefixes:
            print("发现源文件前缀:", ", ".join(prefixes))
            prefix_to_file = {}
            for f in source_files:
                p = _extract_source_prefix(f.get("name"))
                if p and p not in prefix_to_file:
                    prefix_to_file[p] = f
            for prefix in prefixes:
                f = prefix_to_file.get(prefix)
                if f:
                    ftype = (f.get("type") or "").lower()
                    if ftype == "sheet":
                        rows = _fetch_sheet_values(token, f.get("token"))
                        headers = _extract_headers_from_sheet(rows) if rows else None
                    else:
                        raw = _download_file(token, f.get("token"))
                        headers = _extract_headers_from_file(raw, f.get("name")) if raw else None
                    if headers is None:
                        prefix_to_format[prefix] = "zh"
                    else:
                        prefix_to_format[prefix] = "standard"
                        prefix_to_headers[prefix] = headers
                        fm = _match_headers_to_field_map(headers)
                        for k, v in fm.items():
                            if k not in detected_field_map or len(v) > len(detected_field_map.get(k, [])):
                                detected_field_map[k] = v
                else:
                    prefix_to_format[prefix] = "zh" if "_ZH_" in prefix else "standard"
                    if prefix_to_format[prefix] == "standard":
                        prefix_to_headers[prefix] = []
        target_fields = _get_target_fields(token, app_token, table_id)
        if target_fields:
            print("目标表字段:", ", ".join(target_fields[:15]), ("..." if len(target_fields) > 15 else ""))
        else:
            print("无法获取目标表字段")

    if not prefixes:
        prefixes = ["QD_ZH_RMB", "BJ_ZH_RMB", "QD_JH_RMB", "QD_JH_USD", "HK_OCBC_USD", "QD_VTB_RMB"]
        print("使用默认源前缀列表:", ", ".join(prefixes))
        for p in prefixes:
            prefix_to_format[p] = "zh" if "_ZH_" in p else "standard"
            if prefix_to_format[p] == "standard":
                prefix_to_headers[p] = []

    # 2. 交互输入公司/开户行/账号（若已有 profile 可跳过）
    profile = None
    if os.path.exists(PROFILE_PATH):
        try:
            import yaml
            with open(PROFILE_PATH, encoding="utf-8") as f:
                profile = yaml.safe_load(f)
        except Exception:
            profile = None
    reinput = input("\n是否重新输入公司/开户行/账号？(y 重新输入 / 回车 使用现有配置): ").strip().lower() == "y"
    if reinput or not profile or not (profile.get("companies")):
        accounts = _interactive_input_accounts(prefixes)
        profile = _accounts_to_profile(accounts)
    else:
        print("使用已有 company_profile")

    # 3. 生成 field_map 与 source_file_mapping
    field_map = _merge_field_map(detected_field_map, FIELD_MAP_CANDIDATES) if detected_field_map else FIELD_MAP_CANDIDATES
    sfm = _build_source_file_mapping(prefix_to_format, prefix_to_headers)

    # 4. 输出完整映射供确认
    print("\n" + "=" * 50)
    print("生成的配置预览（请仔细核对）")
    print("=" * 50)

    print("\n【公司基础信息 company_profile】")
    for code, comp in profile.get("companies", {}).items():
        print(f"  {code}: {comp.get('name', '')}")
        for acc in comp.get("accounts", []):
            print(f"    - {acc.get('bank')} {acc.get('currency')} 账号={acc.get('account') or '(空)'} <- {acc.get('source_prefix')}")

    print("\n【field_map 解析层->源列名优先列表】")
    for k, v in field_map.items():
        print(f"  {k}: {v[:5]}{'...' if len(v) > 5 else ''}")

    print("\n【zh_parts 中行列索引】")
    for direction, m in ZH_PARTS.items():
        print(f"  {direction}: {m}")

    print("\n【source_file_mapping 目标字段<-源取值】")
    for prefix, m in sfm.items():
        fmt = m.get("format", "")
        print(f"  {prefix} [{fmt}]:")
        for k, v in m.items():
            if k not in ("format", "_detected_columns", "_field_map_used"):
                print(f"    {k} <- {v}")

    print("\n" + "=" * 50)
    confirm = input("请确认以上配置是否正确？(y 确认保存 / 其他 取消): ").strip().lower()
    if confirm != "y":
        print("已取消，未保存。可手动编辑 config/*.yaml 后重新运行 init。")
        return 1

    # 5. 保存配置
    try:
        import yaml
        with open(PROFILE_PATH, "w", encoding="utf-8") as f:
            yaml.dump(profile, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        print(f"\n已保存: {PROFILE_PATH}")
        field_mapping = {
            "target": {"app_token": app_token, "table_id": table_id},
            "source": {"folder_token": folder_token},
            "field_map": field_map,
            "zh_parts": ZH_PARTS,
            "source_file_mapping": {p: {k: v for k, v in m.items() if not k.startswith("_")} for p, m in sfm.items()},
        }
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            f.write("# 银行流水 目标-源 字段映射配置\n# 公司基础信息见 config/company_profile.yaml\n\n")
            yaml.dump(field_mapping, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        print(f"已保存: {CONFIG_PATH}")
    except Exception as e:
        print(f"保存失败: {e}")
        return 1

    print("\ninit 完成。详细映射说明:", DOC_PATH)
    return 0


if __name__ == "__main__":
    sys.exit(main())
