# OMS 对外 API 接口文档

> **文档版本**: v1.0  
> **更新日期**: 2026-02-25  
> **生产环境**: https://oms-ritos.vercel.app  
> **API 基础路径**: `https://oms-ritos.vercel.app/api`

---

## 1. 概述

OMS（Order Management System）基于 Next.js API Routes 提供 BFF 网关层，所有接口均以 JSON 格式交互。数据主源为飞书多维表格，API 负责转发请求、权限校验及数据转换。

### 1.1 通用说明

| 项目 | 说明 |
|------|------|
| 请求格式 | `Content-Type: application/json` |
| 响应格式 | `application/json` |
| 字符编码 | UTF-8 |
| 错误响应 | `{ "error": "错误描述" }`，HTTP 状态码 4xx/5xx |

### 1.2 认证说明

- 登录接口返回 `user` 及 `logId`，前端通常将登录状态存于 localStorage
- 业务接口**当前未强制校验登录态**，由前端在登录后调用
- 对外集成时建议在网关层增加 API Key 或 Token 校验

---

## 2. 认证接口

### 2.1 用户登录

**POST** `/api/auth/login`

**请求体**:
```json
{
  "username": "string",
  "password": "string"
}
```

**成功响应** (200):
```json
{
  "success": true,
  "logId": "string",
  "user": {
    "id": "string",
    "username": "string",
    "name": "string",
    "role": "admin | sales | finance | view",
    "moduleKeys": ["string"],
    "permissions": []
  }
}
```

**错误响应**:
- `401`: `{ "success": false, "error": "用户名或密码错误" }`
- `403`: `{ "success": false, "error": "该账号已被停用，请联系管理员" }`
- `500`: `{ "error": "登录失败" }`

---

### 2.2 修改密码

**POST** `/api/auth/change-password`

**请求体**:
```json
{
  "userId": "string",
  "oldPassword": "string",
  "newPassword": "string"
}
```

**约束**: `newPassword` 长度 ≥ 6

**成功响应** (200): `{ "success": true }`

**错误响应**:
- `400`: `{ "success": false, "error": "参数无效" }`
- `401`: `{ "success": false, "error": "原密码错误" }`
- `404`: `{ "success": false, "error": "用户不存在" }`
- `500`: `{ "error": "修改失败" }`

---

## 3. 订单接口

### 3.1 获取订单列表（含统计）

**GET** `/api/orders`

**成功响应** (200):
```json
{
  "orders": [
    {
      "id": "string",
      "recordId": "string",
      "customer": "string",
      "product": "string",
      "mts": "string",
      "amount": "string",
      "contractDate": "string",
      "status": "签约中 | 已签约 | 已收款 | 已结款 | 待退税 | 已退税",
      "ritos": "string",
      "_raw": {},
      "_parsed": {}
    }
  ],
  "stats": {
    "all": { "count": 0, "amount": "¥0" },
    "签约中": { "count": 0, "amount": "¥0" },
    "已签约": { "count": 0, "amount": "¥0" },
    "已收款": { "count": 0, "amount": "¥0" },
    "已结款": { "count": 0, "amount": "¥0" },
    "待退税": { "count": 0, "amount": "¥0" },
    "已退税": { "count": 0, "amount": "¥0" }
  }
}
```

**异常时**: 仍返回 200，`orders` 为空数组，`stats` 为默认值，`error` 字段包含错误信息。

---

### 3.2 创建订单

**POST** `/api/orders`

**请求体**: 字段名与飞书多维表格列名一致，按 Schema 类型转换（数字、日期等）

```json
{
  "订单号": "string",
  "RITOS": "string",
  "客户": "string",
  "产品": "string",
  "详细规格": "string",
  "数量": 0,
  "单价": 0,
  "货币": "CNY | USD",
  "商务进度": "string",
  "签约日": "2026-02-25"
}
```

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "record_id": "string",
    "fields": {}
  }
}
```

**错误响应**:
- `400`: 表未配置 / 无可提交字段 / Schema 未同步
- `500`: `{ "error": "Failed to create order: ..." }`

---

### 3.3 更新订单

**PUT** `/api/orders/{recordId}`

**请求体**:
```json
{
  "recordId": "string",
  "fields": {
    "字段名": "值"
  }
}
```

**成功响应** (200): `{ "success": true, "data": { "record_id": "...", "fields": {} } }`

**错误响应**:
- `400`: `recordId` 或 `fields` 缺失 / 无可更新字段
- `503`: Schema 未同步
- `500`: 更新失败

---

### 3.4 删除订单

**DELETE** `/api/orders/{recordId}`

**路径参数**: `recordId` - 飞书记录 ID

**成功响应** (200): `{ "success": true, "message": "Order deleted successfully" }`

**错误响应**:
- `400`: `recordId` 缺失
- `500`: 删除失败

---

## 4. 飞书通用记录接口

适用于任意已配置的飞书多维表格，需传入 `tableId`。

### 4.1 获取记录列表

**GET** `/api/feishu/records?tableId={tableId}&pageSize=100&pageToken=&filter=`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| tableId | string | 是 | 多维表格表 ID |
| pageSize | number | 否 | 每页条数，默认 100 |
| pageToken | string | 否 | 分页令牌 |
| filter | string | 否 | 飞书过滤表达式 |

**成功响应** (200):
```json
{
  "items": [
    {
      "record_id": "string",
      "fields": {}
    }
  ],
  "has_more": false,
  "page_token": "string"
}
```

---

### 4.2 创建记录

**POST** `/api/feishu/records?tableId={tableId}`

**请求体**:
```json
{
  "fields": {
    "字段名": "值"
  }
}
```

**成功响应** (201): `{ "record_id": "string", "fields": {} }`

---

### 4.3 获取单条记录

**GET** `/api/feishu/records/{id}?tableId={tableId}`

**成功响应** (200): `{ "record_id": "string", "fields": {} }`

---

### 4.4 更新记录

**PUT** `/api/feishu/records/{id}?tableId={tableId}`

**请求体**: `{ "fields": { "字段名": "值" } }`

**成功响应** (200): `{ "record_id": "string", "fields": {} }`

---

### 4.5 删除记录

**DELETE** `/api/feishu/records/{id}?tableId={tableId}`

**成功响应** (200): `{ "success": true }`

---

## 5. 统一数据接口

### 5.1 按路由获取表数据

**GET** `/api/table-data?route={route}`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| route | string | 是 | `/orders` \| `/logistics` \| `/finance/receivable-payable` \| `/finance/cash-flow` |

**成功响应** (200):
```json
{
  "success": true,
  "data": {
    "records": [{}],
    "schema": {},
    "fieldNameToId": {}
  }
}
```

**错误响应**:
- `400`: `route` 缺失或未配置
- `500`: 获取失败

---

## 6. Schema 接口

### 6.1 获取表 Schema

**GET** `/api/schema/{tableId}`

返回表结构（含字段定义、类型等），缺失时自动尝试同步。

**成功响应** (200):
```json
{
  "tableId": "string",
  "tableName": "string",
  "fields": [
    {
      "fieldId": "string",
      "fieldName": "string",
      "dataKey": "string",
      "fieldType": 0,
      "uiType": "string",
      "isPrimary": false,
      "isExtend": false,
      "property": {}
    }
  ],
  "syncedAt": "string"
}
```

---

### 6.2 同步单表 Schema

**POST** `/api/schema/{tableId}`

**成功响应** (200): 返回同步后的 Schema 对象

---

### 6.3 同步单表 Schema（飞书路径）

**POST** `/api/feishu/schema/sync/{tableId}`

**成功响应** (200):
```json
{
  "success": true,
  "message": "表名 Schema已更新",
  "table": {
    "tableId": "string",
    "tableName": "string",
    "fieldCount": 0
  },
  "updatedAt": "string"
}
```

**GET** `/api/feishu/schema/sync/{tableId}`: 获取当前 Schema

---

### 6.4 同步全部表 Schema

**POST** `/api/feishu/schema/sync-all`

**成功响应** (200):
```json
{
  "success": true,
  "message": "已同步 N 个表",
  "tables": [
    {
      "tableId": "string",
      "tableName": "string",
      "fieldCount": 0,
      "lastSyncedAt": "string",
      "status": "已同步 | 未同步 | 未配置"
    }
  ],
  "failed": [{ "tableName": "string", "error": "string" }],
  "unconfigured": [{ "tableName": "string" }]
}
```

**GET** `/api/feishu/schema/sync-all`: 获取表列表

---

## 7. 配置接口

### 7.1 获取表 ID 配置

**GET** `/api/config/table-ids`

**成功响应** (200):
```json
{
  "orders": "tblxxx",
  "cashFlow": "tblxxx",
  "finance": "tblxxx"
}
```

---

### 7.2 模块字段配置

**GET** `/api/config/modules`

**成功响应** (200): 返回 `{ version, lastUpdated, modules: [...] }`

**POST** `/api/config/modules`

**请求体**:
```json
{
  "action": "save | updateModule | batchUpdatePermissions",
  "data": {}
}
```

- `save`: `data` 为完整 `ModuleFieldsConfig`
- `updateModule`: `data` 含 `moduleId`, `updates`
- `batchUpdatePermissions`: `data` 含 `moduleId`, `permissions`

---

### 7.3 单模块配置

**GET** `/api/config/modules/{moduleId}`

**成功响应** (200): `{ moduleId, moduleName, fieldPermissions: {} }`

---

## 8. 飞书表与诊断

### 8.1 获取表信息

**GET** `/api/feishu/tables`

无参数时返回已配置表 ID 列表；带 `?tableId=xxx` 时返回单表 Schema。

---

### 8.2 同步诊断

**GET** `/api/feishu/sync-diagnostic`

逐步测试飞书 API 连通性，用于排查 Vercel 部署同步问题。

**成功响应** (200):
```json
{
  "steps": [
    { "step": "环境变量", "ok": true, "message": "..." },
    { "step": "获取 Token", "ok": true },
    { "step": "获取表列表", "ok": true, "message": "..." }
  ],
  "summary": "诊断通过，同步应可正常执行"
}
```

---

## 9. 用户与访问日志

### 9.1 用户列表

**GET** `/api/users`

**成功响应** (200): `{ "users": [{ id, username, name, role, enabled, moduleKeys }] }`

**POST** `/api/users`

**请求体**: `{ "action": "save", "data": [用户数组] }`

---

### 9.2 访问日志

**GET** `/api/access-logs`

**成功响应** (200): `{ "logs": [...] }`

**POST** `/api/access-logs`

**请求体**: `{ "action": "logout", "logId": "string" }`

---

## 10. 接口汇总表

| 分类 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 认证 | POST | /api/auth/login | 用户登录 |
| 认证 | POST | /api/auth/change-password | 修改密码 |
| 订单 | GET | /api/orders | 订单列表+统计 |
| 订单 | POST | /api/orders | 创建订单 |
| 订单 | PUT | /api/orders/{recordId} | 更新订单 |
| 订单 | DELETE | /api/orders/{recordId} | 删除订单 |
| 飞书 | GET | /api/feishu/records | 记录列表 |
| 飞书 | POST | /api/feishu/records | 创建记录 |
| 飞书 | GET | /api/feishu/records/{id} | 单条记录 |
| 飞书 | PUT | /api/feishu/records/{id} | 更新记录 |
| 飞书 | DELETE | /api/feishu/records/{id} | 删除记录 |
| 数据 | GET | /api/table-data | 按路由获取表数据 |
| Schema | GET | /api/schema/{tableId} | 获取 Schema |
| Schema | POST | /api/schema/{tableId} | 同步 Schema |
| Schema | POST | /api/feishu/schema/sync/{tableId} | 同步单表 |
| Schema | GET/POST | /api/feishu/schema/sync-all | 表列表/全部同步 |
| 配置 | GET | /api/config/table-ids | 表 ID 配置 |
| 配置 | GET/POST | /api/config/modules | 模块配置 |
| 配置 | GET | /api/config/modules/{moduleId} | 单模块配置 |
| 飞书 | GET | /api/feishu/tables | 表信息 |
| 诊断 | GET | /api/feishu/sync-diagnostic | 同步诊断 |
| 系统 | GET | /api/users | 用户列表 |
| 系统 | POST | /api/users | 保存用户 |
| 系统 | GET | /api/access-logs | 访问日志 |
| 系统 | POST | /api/access-logs | 登出记录 |

---

## 11. 附录

### 11.1 飞书字段类型说明

- 单行文本、多行文本: `string`
- 数字: `number`
- 日期: 毫秒时间戳 `number` 或 `"YYYY-MM-DD"` 字符串
- 单选/多选: 按飞书 API 格式（含 `text` / `name` 等）

### 11.2 环境变量依赖

API 依赖以下环境变量（见 `.env.example`）：

- `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_BASE_APP_TOKEN`
- `FEISHU_TABLE_ORDERS` / `FEISHU_TABLE_CASH_FLOW` / `FEISHU_TABLE_FINANCE`
- `NEXT_PUBLIC_FEISHU_TABLE_*`（客户端表 ID，可选）
