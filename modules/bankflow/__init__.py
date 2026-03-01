"""
银行流水自动汇总 - 三部分架构
1. 初始化：目标-源映射配置
2. 同步：增量同步与校验
3. 外部访问：API 接口
"""
from .config import load_config
from .sync import run_sync, verify_sync

__all__ = ["load_config", "run_sync", "verify_sync"]
