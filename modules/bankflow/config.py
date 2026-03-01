"""加载字段映射配置"""
import os
import re

try:
    import yaml
except ImportError:
    yaml = None

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "config", "field_mapping.yaml")


def load_config():
    """加载 config/field_mapping.yaml，不存在则返回默认配置"""
    cfg = _default_config()
    if yaml and os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, encoding="utf-8") as f:
                data = yaml.safe_load(f)
            if data:
                cfg.update(_merge(cfg, data))
        except Exception:
            pass
    return cfg


def _default_config():
    return {
        "target": {
            "app_token": "XeVSbKsMnaXzNNspHGzc9MKsn8d",
            "table_id": "tblPWmxgCe22gkqU",
        },
        "source": {"folder_token": "F9G4fieXYlS0JqdnDE8c2DqbnFe"},
        "field_map": {
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
        },
        "zh_parts": {
            "来账": {"账号": 8, "账户名": 9, "对方户名": 5, "对方账号": 4, "摘要": 1, "金额": [13, 14]},
            "往账": {"账号": 4, "账户名": 5, "对方户名": 9, "对方账号": 8, "摘要": 1, "金额": [13, 14]},
        },
    }


def _merge(base, override):
    """递归合并，override 覆盖 base"""
    out = dict(base)
    for k, v in override.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def get_field_map(cfg=None):
    """获取 FIELD_MAP 格式（key -> [source_keys]）"""
    cfg = cfg or load_config()
    return cfg.get("field_map", _default_config()["field_map"])


def get_zh_parts(cfg=None):
    """获取中行列索引配置"""
    cfg = cfg or load_config()
    return cfg.get("zh_parts", _default_config()["zh_parts"])
