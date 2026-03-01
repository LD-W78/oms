#!/usr/bin/env python3
"""
银行流水数据校验脚本
源文件与目标表逐记录、逐字段比对，确保目标记录来自正确源文件与字段。
用法:
  python scripts/validate_bankflow.py       # 逐字段详细校验
  python scripts/validate_bankflow.py -q   # 静默模式，只输出JSON结果
"""
import sys
import os

# 添加 bankflow 模块根目录到路径（scripts 的上级）
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from validator import BankFlowValidator, main

if __name__ == "__main__":
    sys.exit(main())
