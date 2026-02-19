# OMS订单管理系统 - 部署指南

## 环境要求

- Node.js 18+
- npm 或 pnpm

## 快速部署到 Vercel

### 1. 准备工作

确保已配置 `.env.local` 文件：

```bash
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_BASE_APP_TOKEN=your_base_token
FEISHU_TABLE_ORDERS=orders_table_id
FEISHU_TABLE_CUSTOMERS=customers_table_id
FEISHU_TABLE_PRODUCTS=products_table_id
```

### 2. 部署步骤

#### 方式一：通过 Vercel CLI

```bash
npm i -g vercel
cd oms
vercel login
vercel deploy
```

#### 方式二：通过 GitHub

1. 将项目推送到 GitHub
2. 登录 [Vercel](https://vercel.com)
3. 点击 "Add New Project"
4. 选择 GitHub 仓库
5. 配置环境变量
6. 点击 "Deploy"

### 3. 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

| 变量名 | 描述 | 必需 |
|--------|------|------|
| FEISHU_APP_ID | 飞书应用ID | 是 |
| FEISHU_APP_SECRET | 飞书应用密钥 | 是 |
| FEISHU_BASE_APP_TOKEN | 飞书应用Token | 是 |
| FEISHU_TABLE_* | 各表ID | 否 |

### 4. 验证部署

部署完成后：
1. 访问部署的URL
2. 确保页面正常加载
3. 测试登录功能
4. 验证数据读取

## 本地开发

```bash
cd oms
npm install
npm run dev
```

访问 http://localhost:3000

## 构建生产版本

```bash
cd oms
npm run build
npm run start
```
