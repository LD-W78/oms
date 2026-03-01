"""
同步模块：增量同步源文件到目标表，并校验
符合 EXECUTION_STANDARDS.md 五大标准
"""
import os
import sys

# 允许从项目根或 scripts 目录调用
for _ in (os.path.dirname(__file__), os.path.join(os.path.dirname(__file__), "..", "scripts")):
    if _ not in sys.path:
        sys.path.insert(0, _)

def run_sync(config_path=None):
    """
    执行增量同步：检查源文件，按字段映射增量写入目标表
    返回 (成功, 解析数, 写入数, 消息)
    """
    try:
        from run_workflow_simulation import main
    except ImportError:
        try:
            sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
            from run_workflow_simulation import main
        except ImportError:
            return False, 0, 0, "无法导入 run_workflow_simulation"
    exit_code = main()
    # main 无返回值时，根据 exit_code 判断；main 返回 0 为成功
    return exit_code == 0, -1, -1, "执行完成" if exit_code == 0 else "执行失败"


def verify_sync():
    """
    校验同步结果：调用 validate_bankflow 进行源 vs 目标比对与去重检测
    返回 (是否通过, 源数, 目标数, 未写入数, 多余数)
    """
    import subprocess
    scripts_dir = os.path.join(os.path.dirname(__file__), "..", "scripts")
    r = subprocess.run(
        [sys.executable, os.path.join(scripts_dir, "validate_bankflow.py")],
        cwd=os.path.dirname(os.path.dirname(__file__)),
        capture_output=True,
        text=True,
        timeout=120,
    )
    return r.returncode == 0, -1, -1, -1, -1
