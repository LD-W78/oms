# OMSv2 技术架构 / 数据流 / 功能模块 分析

## 一、技术架构

### 1.1 整体架构模式

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              浏览器 (Client)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Next.js App Router (React 19)                                               │
│  ├── layout.tsx → AntdProvider → MainLayout → children (page)               │
│  ├── 路由: / → redirect /dashboard                                           │
│  └── 页面: /dashboard | /orders | /customers | ... | /login                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  UI 层                                                                       │
│  ├── 布局: MainLayout (Sider + Header + Content + Footer)                    │
│  ├── 导航: navConfig → 菜单项 (dashboard/orders/customers/...)                │
│  ├── 组件: DynamicForm / DynamicTable / FeishuIframe / AuthGuard             │
│  └── 主题: theme/index + globals.css + Tailwind                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  状态与数据 Hook 层                                                          │
│  ├── useAuthStore (Zustand + persist) — 登录态、角色、权限                    │
│  ├── useModuleConfig(moduleId) — 模块字段配置、权限 (API + localStorage)     │
│  ├── useTableConfig(route) — 表格列配置 (API + localStorage)                 │
│  ├── useTableSchema(tableId) — Schema 拉取与同步                             │
│  ├── useTableData({ tableId, filter, transform }) — 统一数据层               │
│  └── useDynamicColumns / useDynamicForm — 动态列/表单生成                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Next.js API Routes (BFF 层，仅服务端)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/orders           GET→getOrders+getOrderStats  POST→createOrder         │
│  /api/orders/[recordId] GET/PUT/DELETE 单条订单                              │
│  /api/schema/[tableId] GET→getTableSchema  POST→syncTableSchema              │
│  /api/table-data       GET route→schema+records (orders/logistics/finance)  │
│  /api/tables           GET route→表格数据 (useTableConfig 用)                │
│  /api/config/modules   GET/POST 模块字段配置 (JSON 文件)                     │
│  /api/config/modules/[moduleId] GET 单模块配置                               │
│  /api/feishu/*         schema/sync-all, sync/[tableId], tables, records      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  业务与数据抽象层 (lib，服务端 + 部分同构)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  lib/feishu/                                                                 │
│  ├── client.ts        FeishuClient: getAppToken, getTableSchema,             │
│  │                    getRecords, getRecord, create/update/deleteRecord     │
│  ├── schema.ts        getTableSchema(tableId), syncTableSchema,              │
│  │                    syncAllSchemas, 内存+文件 Schema 缓存                  │
│  ├── schema-cache.ts   Schema 文件缓存读写                                    │
│  ├── orders.ts        getOrders, getOrderStats, createOrder (TABLE_IDS)      │
│  ├── field-mapping.ts 字段名→dataKey 映射、分类、格式化规则                  │
│  ├── field-adapters.ts 按 fieldType 解析/格式化 (公式、金额、日期等)         │
│  ├── formula-parser.ts 飞书公式值解析                                        │
│  └── types.ts         TableSchema, FieldSchema 等类型                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  lib/config/                                                                 │
│  ├── env.ts           Zod 校验 env，导出 TABLE_IDS (orders/logistics/...)   │
│  ├── table-metadata.ts 表格元数据                                            │
│  └── module-fields.ts  读写 config/module-fields.json，模块字段权限           │
├─────────────────────────────────────────────────────────────────────────────┤
│  lib/auth/           store (Zustand 登录/权限), PermissionGuard              │
│  lib/cache/          IndexedDB (localforage): orders/customers/schema/...     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  外部数据源                                                                  │
│  └── 飞书开放平台 (Bitable 多维表格): app_access_token → 表/字段/记录 CRUD   │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **前端**: Next.js 16 App Router + React 19，单页应用式路由与布局；UI 为 Ant Design + Tailwind。
- **BFF**: 所有业务数据经 Next.js API Routes 访问，前端不直连飞书；API 内调用 `lib/feishu`、`lib/config` 等。
- **数据抽象**: 飞书表统一为「表 ID + Schema + 记录」模型；通过 `field-mapping` + `field-adapters` 做字段映射与解析，形成「统一数据层」供 `useTableData` 消费。
- **配置与权限**: 表 ID 来自 `lib/config/env`（TABLE_IDS）；模块级字段配置与权限来自 `config/module-fields.json` + `/api/config/modules`；表格列配置可由 useTableConfig 从 API 或 localStorage 读取。

### 1.2 技术栈小结

| 层级     | 技术选型 |
|----------|----------|
| 框架     | Next.js 16.1.6 (App Router), React 19.2.3 |
| 语言     | TypeScript 5 (strict) |
| UI       | Ant Design 6, Tailwind CSS 4 |
| 状态     | Zustand 5 (auth persist), 服务端无全局状态 |
| 数据请求 | fetch → /api/* (无 SWR/React Query 在核心数据流) |
| 校验     | Zod (env) |
| 本地存储 | localStorage (配置), IndexedDB/localforage (缓存) |
| 部署     | Vercel (vercel.json), 未用 Docker/K8s |

### 1.3 目录与职责

| 路径 | 职责 |
|------|------|
| `src/app/` | 路由、布局、页面、API 路由、共享组件、Hooks |
| `src/app/api/` | BFF：orders / schema / table-data / config / feishu |
| `src/app/components/` | Layout、Providers、Feishu、DynamicForm/Table、Auth |
| `src/app/hooks/` | useTableData, useTableSchema, useTableConfig, useModuleConfig, useDynamicColumns, useDynamicForm |
| `src/lib/` | feishu 客户端与 schema/orders/field-*、config、auth、cache |
| `src/types/` | 模块字段、业务类型等 |
| `config/` | 运行时配置 (如 module-fields.json)，非环境变量 |

---

## 二、数据流

### 2.1 以「订单列表」为例的读写流

**读（列表 + 统计）：**

1. 页面：`/orders` 使用 `useModuleConfig('orders')`、`useTableSchema(tableId)`，并直接调 `/api/orders` 取列表与统计（订单页未用 useTableData，而是用 orders 专用 API）。
2. 请求：`GET /api/orders`。
3. 服务端：`getOrders()` → `feishuClient.getRecords(TABLE_IDS.orders)`；`getOrderStats(orders)` 在内存中算各状态数量与金额。
4. 响应：`{ orders, stats }`。
5. 页面：用 schema 做列定义与展示，用 stats 渲染状态卡片。

**写（创建/更新订单）：**

1. 页面：提交表单或表格内编辑。
2. 请求：`POST /api/orders`（body 为字段对象）或 `PUT /api/orders/[recordId]`。
3. 服务端：`createOrder(fields)` / 更新逻辑 → `feishuClient.createRecord` / `updateRecord`。
4. 响应：返回新记录或成功状态；前端需自行 refetch 或跳转。

### 2.2 以「通用表格页」为例（物流/现金流/应收应付）

**读：**

1. 页面：例如 `finance/cash-flow`、`finance/receivable-payable`、`logistics` 使用 `useTableData({ tableId, ... })`。
2. useTableData 内部并行请求：
   - `GET /api/schema/${tableId}` → `getTableSchema(tableId)`（内存/文件缓存）；
   - `GET /api/orders?tableId=${tableId}`（注意：**当前 GET /api/orders 未使用 query 的 tableId**，始终返回 TABLE_IDS.orders 的订单数据；因此对物流/现金流/应收应付等 tableId 使用 useTableData 时，会拿到订单表的 records + 当前 tableId 的 schema，存在数据与表不一致的风险。通用表数据应走 `/api/table-data?route=xxx` 或为各表提供独立 GET API。）
3. 订单页专用 `/api/orders`；`/api/table-data?route=xxx` 被 useTableConfig 等使用，返回 schema + records，且 ROUTE_TO_TABLE_ID 仅覆盖 orders/logistics/finance 等部分 route。
4. 数据处理：Schema 的 fields 经 `applyFieldMappingBatch` → MappedField；每条 record 经 `processRecord`（field-adapters + formula-parser）→ `TableRecord`（含 `fields[dataKey].raw/parsed/formatted`）。
5. 页面：用 `records`、`mappedFields`、`categorizedFields` 渲染表格或表单。

**数据层约束：**  
`useTableData` 被设计为「统一数据层」：禁止页面直接调飞书 API，字段逻辑只通过 field-mapping / field-adapters 扩展。

### 2.3 Schema 与配置流

- **Schema 来源**  
  - 飞书：`feishuClient.getTableSchema(tableId)` → 表名 + 字段列表（field_name, type 等）。  
  - 服务端：`syncTableSchema(tableId)` 写内存 + 文件缓存；`getTableSchema(tableId)` 先内存再文件。  
  - 前端：`GET /api/schema/[tableId]` 只读；`POST` 触发同步。

- **模块配置（字段权限、可见性等）**  
  - 存储：`config/module-fields.json`。  
  - API：`GET/POST /api/config/modules`、`GET /api/config/modules/[moduleId]`。  
  - 前端：`useModuleConfig(moduleId)` 拉取并写 localStorage 备份，用于权限判断与可见字段。

- **表格列配置（列显隐、顺序等）**  
  - 存储：localStorage 键 `oms_table_configs` 或服务端（若 tables API 支持）。  
  - 前端：`useTableConfig(route)` 读/写，供 `useDynamicColumns` 生成 Ant Design 列配置。

### 2.4 数据流小结图

```
飞书 Bitable
      │
      ▼
FeishuClient (getAppToken, getRecords, getTableSchema, create/update/deleteRecord)
      │
      ├──► schema.ts (getTableSchema / syncTableSchema) ──► 内存 + 文件缓存
      │
      ├──► orders.ts (getOrders, getOrderStats, createOrder) ──► TABLE_IDS from env
      │
      └──► 其他表 ──► /api/table-data?route= 或直接 getRecords
      │
      ▼
Next.js API (GET/POST /api/orders, /api/schema/[tableId], /api/table-data, /api/config/modules...)
      │
      ▼
前端 Hooks
  ├── useTableSchema(tableId)        → /api/schema/[tableId]
  ├── useTableData({ tableId })      → /api/schema + /api/orders?tableId (或 table-data)
  ├── useModuleConfig(moduleId)      → /api/config/modules/[moduleId] + localStorage
  ├── useTableConfig(route)          → /api/tables?route= + localStorage
  └── 订单页单独 fetch /api/orders   → orders + stats
      │
      ▼
页面组件 (Table / Form / FeishuIframe)
```

---

## 三、功能模块

### 3.1 按路由划分

| 路由 | 功能 | 实现方式 | 数据来源 |
|------|------|----------|----------|
| `/` | 首页重定向 | redirect('/dashboard') | - |
| `/login` | 登录 | 表单 + useAuthStore.login | Mock 用户 |
| `/dashboard` | 仪表盘 | FeishuIframe 或统计卡片 | NEXT_PUBLIC_FEISHU_DASHBOARD_URL |
| `/orders` | 订单管理 | 状态卡 + Table，增删改查 | useTableSchema + /api/orders |
| `/customers` | 客户管理 | FeishuIframe | NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL |
| `/products` | 产品管理 | FeishuIframe | NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL |
| `/suppliers` | 供应商 | FeishuIframe | NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL |
| `/quotation` | 报价管理 | 页面 (逻辑待查) | - |
| `/logistics` | 物流跟踪 | 若用 useTableData 则 tableId=logistics | TABLE_IDS.logistics / table-data |
| `/feishu-sheet` | 飞书表格 | 内嵌飞书 | 环境变量 URL |
| `/finance/cash-flow` | 现金流 | useTableData(tableId: cashFlow) | TABLE_IDS.cashFlow |
| `/finance/receivable-payable` | 应收应付 | useTableData(tableId: finance) | TABLE_IDS.finance |
| `/finance/business-analysis` | 业务分析 | 页面 | - |
| `/finance/reports` | 报表 | 页面 | - |
| `/system` | 系统管理入口 | 子菜单 | - |
| `/system/users` | 用户管理 | 页面 | - |
| `/system/roles` | 角色管理 | 页面 | - |
| `/system/alerts` | 告警 | 页面 | - |
| `/system/sync` | 数据同步 | 同步 Schema 等 | /api/feishu/schema/sync-all 等 |
| `/system/feishu-config` | 飞书配置 | 配置项展示/编辑 | 环境变量或 API |
| `/system/data-config` | 数据配置 | 模块/字段配置 | /api/config/modules |

### 3.2 按实现模式分类

- **飞书 iframe 页**  
  仪表盘、客户、产品、供应商、飞书表格等：仅用 `FeishuIframe` + 环境变量中的飞书多维表格/仪表盘 URL，无自管表结构，数据完全在飞书侧。

- **自管列表/表格页（对接 Bitable 记录）**  
  订单、物流、现金流、应收应付：通过 TABLE_IDS 对应到飞书表，经 API 拉取 schema 与 records，用 useTableSchema + /api/orders 或 useTableData 做统一解析与展示；订单有独立统计与状态卡。

- **配置与系统**  
  模块字段配置、表格列配置、同步、飞书配置等：读写 config 文件或 API，前端用 useModuleConfig / useTableConfig 等。

### 3.3 权限与多租户

- **前端权限**：`lib/auth/store` 中角色 (admin/manager/sales/viewer) 与 `permissions`（resource + actions）；`hasPermission(resource, action)`；登录态 Zustand persist。
- **模块/字段级**：`useModuleConfig` 的 `checkPermission(fieldId, action)`、`getVisibleFields()`，数据来自 config/module-fields.json。
- 当前无租户隔离；表 ID 与配置均为全局。

---

## 四、小结

- **技术架构**：Next.js BFF + 飞书 Bitable 单数据源；前端 Ant Design + 统一数据 Hook（useTableData / useTableSchema）+ 模块/表配置（useModuleConfig / useTableConfig）；服务端 lib/feishu + lib/config 抽象表与配置。
- **数据流**：飞书 → FeishuClient → schema/orders 等 → API Routes → useTableData/useTableSchema/useModuleConfig/useTableConfig → 页面；Schema 与字段解析集中在 field-mapping + field-adapters，保证统一数据层。
- **功能模块**：分为 iframe 嵌入页（仪表盘、客户、产品、供应商）、自管表格页（订单、物流、财务相关）、系统与配置页（用户/角色/告警/同步/飞书配置/数据配置）；订单为最重业务，其余表格页可复用 useTableData + TABLE_IDS。

若你希望，我可以再针对「订单模块」或「财务模块」画更细的时序图，或列出可改进点（例如 API 与 Hook 的命名统一、table-data 与 orders 的职责拆分等）。
