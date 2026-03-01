#!/usr/bin/env python3
"""启动 bankflow API 服务（需安装 flask: pip install flask）"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bankflow.api import create_app

app = create_app()
if app is None:
    print("请先安装: pip install flask")
    sys.exit(1)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
