"""
外部访问 API：供 bot 和外部系统调用
- 执行同步
- 检索、统计、筛选目标记录
"""
import json
import os
import sys

# 确保可导入 scripts 下模块
_scripts = os.path.join(os.path.dirname(__file__), "..", "scripts")
if _scripts not in sys.path:
    sys.path.insert(0, _scripts)

try:
    from run_workflow_simulation import (
        get_token,
        BASE,
        APP_TOKEN,
        TABLE_ID,
        list_files,
        download_raw,
        parse_csv,
        parse_xls,
        parse_xlsx,
        filter_latest_date_files,
    )
except ImportError:
    get_token = None
    BASE = APP_TOKEN = TABLE_ID = None


def run_sync_api():
    """执行同步，返回 JSON 可序列化的结果"""
    if not get_token:
        return {"ok": False, "msg": "模块未加载"}
    import subprocess
    r = subprocess.run(
        [sys.executable, os.path.join(_scripts, "run_workflow_simulation.py")],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        capture_output=True,
        text=True,
        timeout=300,
    )
    return {
        "ok": r.returncode == 0,
        "stdout": r.stdout or "",
        "stderr": r.stderr or "",
    }


def fetch_target_records(token=None, page_size=100, page_token=None):
    """获取目标表记录，支持分页"""
    if not token:
        token = get_token() if get_token else None
    if not token:
        return []
    import requests
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
        return [], None
    items = j.get("data", {}).get("items", [])
    next_pt = j.get("data", {}).get("page_token")
    return items, next_pt


def records_filter(records, **kwargs):
    """
    内存筛选：按 来源、日期起止、类型、货币、金额范围 等过滤
    kwargs: 来源=xxx, 日期起=20260101, 日期止=20261231, 类型=xxx, 货币=RMB, 支出最小=0
    """
    out = records
    if "来源" in kwargs and kwargs["来源"]:
        out = [r for r in out if str(r.get("fields", {}).get("来源", "")) == str(kwargs["来源"])]
    if "日期起" in kwargs and kwargs["日期起"]:
        d0 = str(kwargs["日期起"])[:8]
        out = [r for r in out if _date_from_record(r) >= d0]
    if "日期止" in kwargs and kwargs["日期止"]:
        d1 = str(kwargs["日期止"])[:8]
        out = [r for r in out if _date_from_record(r) <= d1]
    if "类型" in kwargs and kwargs["类型"]:
        out = [r for r in out if str(r.get("fields", {}).get("类型", "")) == str(kwargs["类型"])]
    if "货币" in kwargs and kwargs["货币"]:
        out = [r for r in out if str(r.get("fields", {}).get("货币", "")) == str(kwargs["货币"])]
    return out


def _date_from_record(rec):
    v = rec.get("fields", {}).get("交易日期")
    if isinstance(v, (int, float)):
        try:
            from datetime import datetime
            return datetime.fromtimestamp(v / 1000).strftime("%Y%m%d")
        except Exception:
            return ""
    return (str(v) or "")[:8].replace("-", "").replace("/", "")


def records_stats(records):
    """统计：按来源、类型、货币汇总笔数和金额"""
    by_source = {}
    by_type = {}
    total_支出 = total_收入 = 0
    for r in records:
        f = r.get("fields", {})
        s = f.get("来源", "")
        t = f.get("类型", "")
        支 = float(f.get("支出") or 0)
        收 = float(f.get("收入") or 0)
        by_source[s] = by_source.get(s, 0) + 1
        by_type[t] = by_type.get(t, 0) + 1
        total_支出 += 支
        total_收入 += 收
    return {
        "total_records": len(records),
        "by_source": by_source,
        "by_type": by_type,
        "total_支出": total_支出,
        "total_收入": total_收入,
    }


# 简单 WSGI 入口，供 gunicorn/uvicorn 挂载
def create_app():
    try:
        from flask import Flask, jsonify, request
    except ImportError:
        return None
    app = Flask("bankflow-api")

    @app.route("/sync", methods=["POST"])
    def do_sync():
        return jsonify(run_sync_api())

    @app.route("/records", methods=["GET"])
    def list_records():
        token = get_token() if get_token else None
        if not token:
            return jsonify({"ok": False, "records": []})
        recs, _ = fetch_target_records(token, page_size=min(500, int(request.args.get("limit", 100))))
        filters = {k: request.args.get(k) for k in ["来源", "日期起", "日期止", "类型", "货币"] if request.args.get(k)}
        if filters:
            recs = records_filter(recs, **filters)
        return jsonify({"ok": True, "count": len(recs), "records": recs[:200]})

    @app.route("/stats", methods=["GET"])
    def stats():
        token = get_token() if get_token else None
        if not token:
            return jsonify({"ok": False})
        all_recs = []
        pt = None
        while True:
            recs, pt = fetch_target_records(token, page_size=500, page_token=pt)
            all_recs.extend(recs)
            if not pt or not recs:
                break
        return jsonify({"ok": True, "stats": records_stats(all_recs)})

    @app.route("/verify", methods=["GET"])
    def verify():
        import subprocess
        r = subprocess.run(
            [sys.executable, os.path.join(_scripts, "validate_bankflow.py")],
            cwd=os.path.dirname(os.path.dirname(__file__)),
            capture_output=True,
            text=True,
            timeout=120,
        )
        return jsonify({"ok": r.returncode == 0, "output": r.stdout or r.stderr})

    return app
