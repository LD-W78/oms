# OMS 订单管理系统

基于 Next.js + 飞书多维表格的订单/物流/财务管理系统。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 配置飞书 App 及表 ID
cp config/users.example.json config/users.json  # 配置用户
npm run dev
```

## 部署到 Vercel

1. 推送至 GitHub，在 Vercel 导入项目
2. 配置环境变量（见 `.env.example`）
3. 部署

详见 [docs/deployment.md](docs/deployment.md)

## 文档

- [技术白皮书](docs/OMS技术白皮书.md)
- [部署指南](docs/deployment.md)
- [飞书配置](docs/feishu-setup.md)
- [用户手册](docs/user-guide.md)
