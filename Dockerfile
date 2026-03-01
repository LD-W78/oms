# OMS: Next.js + Python (bankflow 同步脚本)
FROM node:20-bookworm-slim

# 安装 Python 3 及依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# 安装 Python 依赖（bankflow 需要）
RUN pip3 install --no-cache-dir requests pyyaml

WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# 安装 Node 依赖
RUN npm ci 2>/dev/null || npm install

# 复制应用代码
COPY . .

# 复制 bankflow 模块
COPY modules ./modules

# 构建 Next.js
ENV NODE_ENV=production
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
