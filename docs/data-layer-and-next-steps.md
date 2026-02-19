# 飞书主数据 + OMS 数据层与下一步建议

## 一、目标与现状对齐

### 1.1 目标（你的要求）

- **飞书为主数据**，OMS 仅通过两种方式获取：
  1. **API**  
     - **订单表**：订单、物流、财务-应收应付（同一张表，字段一致、数据一致）  
     - **财务表**：财务-财务分析、财务-现金流  
  2. **iframe**：仪表盘、客户、产品、供应商（只嵌飞书页面，不拉 API）
- **API 方式**：字段一致、数据一致；页面**动态渲染**（从动态 schema 获取）；**数据层统一**调用飞书并格式化，**页面只负责展示**。

### 1.2 当前实现与偏差

| 项目 | 当前实现 | 偏差 |
|------|----------|------|
| 数据源 | 订单用 `TABLE_IDS.orders`，物流用同一 `/api/orders` 但前端再手写转换 | 数据源一致，但**展示层不一致**：订单用 schema 驱动，物流用硬编码字段名 |
| 财务 | 现金流/应收应付用 `TABLE_IDS.cashFlow` / `TABLE_IDS.finance`，useTableData 却请求 `/api/orders` | **数据错配**：拿到的是订单表数据，不是财务表 |
| Schema | 订单表：syncTableSchema 用 `getDataKey`；getOrders 用 `generateDataKey`；前端 useTableSchema 硬编码 tableId | **dataKey 两套逻辑**可能不一致；订单页 tableId 未走 env |
| 格式化 | getOrders 内按字段名分支做金额/日期/关联解析，与 field-adapters 部分重复 | **格式逻辑分散**，易出现“格式不对” |

---

## 二、问题根因：为什么“显示不全、格式不对”

### 2.1 显示不全

1. **订单页**
   - Schema 来自 `useTableSchema('tbl16urtK2gXVctO')`，**tableId 写死**，未用 `TABLE_IDS.orders`；若换环境或换表会错。
   - 可见列由 `moduleConfig.fieldPermissions` 过滤，若配置把某字段设为不可见会不显示。
   - **Schema 与飞书不同步**：getTableSchema 有内存+文件缓存，若飞书新增/改名字段未重新同步，schema 少字段 → 列不全。
   - **dataKey 不一致**：服务端 schema 用 `getDataKey(field_name)`，getOrders 用 `generateDataKey(rawKey)`。两者逻辑虽类似，但 schema 未走 field-mapping 规则，而 getOrders 会为“未匹配 schema 的字段”用 generateDataKey 挂到 order 上；若某字段只在一边有 dataKey，就会缺列或缺值。

2. **物流页**
   - **完全硬编码**：`transformOrderToLogistics` 里用固定中文 key（如 `rawFields['起运港']`、`rawFields['ETD']`、`rawFields['物流']`）。飞书表字段名一旦不同（如“起运港” vs “起运地”），该列就空。
   - 展示用的 `categorizedFields` 也是静态的（basic/logistics/product/financial），**不是从 schema 来**，所以“有哪些列”和“数据从哪取”都跟飞书真实结构脱节 → 显示不全。

### 2.2 格式不对

1. **订单页**
   - 列渲染用 `createColumnFromField`，按 `field.fieldType` 选 adapter。但 **syncTableSchema 里用了 `field.type`**，而 FeishuClient 返回的是 `field_type`，若未做兼容会导致 fieldType 为 undefined，走 default 分支，格式可能错（如日期、金额未按类型格式化）。
   - 飞书公式、关联、多选等类型若未在 field-adapters 里覆盖，也会格式不对。

2. **物流页**
   - 自己用 `extractFieldValue`、`formatDateYYYYMMDD` 等局部函数，**没有复用** field-adapters / formula-parser，和订单页、useTableData 的格式规则不一致，易出现“同一字段在订单页和物流页显示不一样”。

---

## 三、下一步建议（按优先级）

### 3.1 统一“表 → 模块”的约定（配置层）

- **订单表**（TABLE_IDS.orders）：唯一数据源，对应模块 **订单、物流、财务-应收应付**。  
  - 三个模块同 schema、同接口、同格式化，仅页面视角/筛选不同（如物流只看“在途”、应收应付只看某状态）。
- **财务表**（TABLE_IDS.finance）：唯一数据源，对应 **财务-财务分析、财务-现金流**。  
  - 若业务上“现金流”和“财务分析”是同一张表的不同视图，就共用一个 TABLE_IDS.finance。
- iframe 的：仪表盘 / 客户 / 产品 / 供应商 保持现状，不接入 API 数据层。

建议在 `lib/config/env.ts` 或配置里显式写清“模块 → tableId”的映射，避免再出现物流用订单表但前端当另一张表处理的情况。

### 3.2 数据层：统一出口、统一格式化（核心）

- **单一数据出口**：  
  所有“表数据”请求都经同一套逻辑：**飞书拉原始 records + 当前表的 schema**，用 **field-mapping + field-adapters** 做：
  - 字段名 → dataKey（与 schema 一致）
  - 类型解析（数字、日期、公式、关联等）
  - 展示用 formatted 值
- **推荐形态**：
  - 服务端：  
    - 保留/扩展 **getTableSchema(tableId)**（并修好 field_type 等字段，见下）。  
    - 新增或统一为 **GET /api/table?tableId=xxx**（或按模块 GET /api/module?module=orders|logistics|receivable|finance|cashFlow 内部映射到 tableId），返回：
      - `schema`: 当前表 schema（与飞书同步后的）
      - `records`: 该表的 records，每条为 `{ recordId, fields: { [dataKey]: { raw, parsed, formatted } } }` 或至少包含 **formatted** 供表格直接展示。
  - 这样“订单 / 物流 / 应收应付”都调同一 tableId（订单表），拿到的 schema 和 records 一致；财务两模块同理用财务表 tableId。

- **getOrders 的定位**：  
  可以保留为“订单表”的便捷 API，但**内部实现**应复用上述“按 tableId 拉表 + 统一格式化”的逻辑，而不是单独一套字段解析。这样订单页、物流页、应收应付页都既可以共用一个“订单表 API”，也可以统一走“按 tableId 的通用表 API”，二者在数据层对齐。

- **useTableData**：  
  若继续使用，应改为**按 tableId 请求上述统一 API**（例如 GET /api/table?tableId=xxx），不再写死 `/api/orders`，这样现金流/应收应付用 tableId 就不会拿到订单表数据。

### 3.3 Schema 与 dataKey 一致

- **Schema 同步**：  
  - 同步时使用飞书返回的 **field_type**（以及若有 field_id、ui_type 等一并写入 schema），避免 schema 里 fieldType 为 undefined。  
  - 建议：syncTableSchema 里对 Feishu 返回的字段做明确映射，例如 `fieldType: field.field_type ?? field.type`，并保证 getTableSchema 吐出的 schema 与飞书一致、含全部字段。
- **dataKey 只保留一套**：  
  - 服务端生成 schema 时，**dataKey 统一用 field-mapping 的 applyFieldMappingBatch（或至少用与 getOrders/统一数据层相同的 generateDataKey）**，不要 schema 一套、getOrders 另一套。这样前端列 dataIndex = dataKey 时，order[dataKey] 或 record.fields[dataKey].formatted 一定存在且一致。
- **订单页**：  
  - 使用 **TABLE_IDS.orders**（或从 env/配置读），不要写死 `tbl16urtK2gXVctO`。  
  - 列来源：**仅来自 schema**（+ 模块配置控制显隐），展示用统一数据层返回的 formatted 或 order[dataKey]。

### 3.4 订单页修改要点

- tableId：`useTableSchema(TABLE_IDS.orders ?? '')`，TABLE_IDS 从 env 或配置来。
- 列：继续用 schema.fields + moduleConfig 得到 visibleFields，用 dataKey 做 dataIndex。
- 数据：继续用 `/api/orders` 或改为统一 GET /api/table?tableId=xxx，保证返回的每条记录的 key 与 schema 的 dataKey 一致，且金额/日期等已是格式化后的或由前端用 schema 的 fieldType 再 format 一次（若 API 已返 formatted 则直接展示）。
- 若发现某列有 key 无值：先核对飞书该列字段名是否在 schema 中，且 schema 的 dataKey 与接口返回的 key 是否一致。

### 3.5 物流页改为“同一数据、动态渲染”

- **数据**：与订单页完全一致——同一接口、同一 tableId（订单表）、同一套 schema 和 records。
- **展示**：
  - 不再用 `transformOrderToLogistics` 转成固定 LogisticsOrder 和静态 categorizedFields。
  - 改为：用**同一份 schema + 同一份 records**，按“模块视图”只做**筛选与列选择**：
    - 例如“物流”视图：筛选条件为 物流进度 在 未发货/已订舱/…/已到港 等（字段名或 dataKey 与 field-mapping 中物流进度一致）；
    - 列：从 schema 中按 category 或配置取出“物流视图”要展示的字段（或直接复用订单表全部列），用 **DynamicTable 或同一套“按 schema 生成列”的逻辑**，单元格取 record.fields[dataKey].formatted 或 order[dataKey]。
- 这样“显示不全、格式不对”会随订单表数据层一起修好，且订单/物流/应收应付字段一致、数据一致。

### 3.6 财务表（财务分析 / 现金流）

- 为 **TABLE_IDS.finance**（及若现金流是同一张表则共用）提供与“订单表”同形态的接口：  
  **GET /api/table?tableId=xxx** 或 专用 GET /api/finance/table，返回 schema + records（统一格式化）。
- 财务-应收应付若按你的约定用**订单表**，则和订单/物流一样调订单表 API，只做筛选和列配置。
- 前端：现金流/财务分析页用 **useTableData** 时，请求 **tableId=TABLE_IDS.finance** 的通用表 API，不再请求 `/api/orders`。

### 3.7 小结：落地顺序建议

1. **修 Schema**：syncTableSchema 使用 `field_type` 等，保证 fieldType 正确；schema 的 dataKey 与 field-mapping 一致。  
2. **统一数据 API**：实现 GET /api/table?tableId=xxx（或等价），内部：getRecords(tableId) + getTableSchema(tableId) + 统一 field-mapping + field-adapters 得到 records（含 formatted）。  
3. **订单页**：tableId 改为 TABLE_IDS.orders，数据可仍用 /api/orders 或切到 /api/table，保证列与 dataKey、格式一致。  
4. **物流页**：去掉硬编码 LogisticsOrder 与静态字段列表，改为用订单表 schema + 同一数据源，按“物流”视图筛选 + 动态列。  
5. **财务**：现金流/财务分析走 TABLE_IDS.finance + 统一表 API；应收应付走订单表 + 同一 API，页面只做展示与筛选。  
6. **useTableData**：改为按 tableId 调统一表 API，避免再出现“用订单表数据渲染财务表 schema”的错配。

按上述顺序做，即可达到：**API 方式字段一致、数据一致，页面从动态 schema 渲染，数据层统一调用飞书并格式化，页面只负责展示**，并从根本上缓解“订单/物流显示不全、格式不对”的问题。

---

## 四、附录：统一表 API 与 useTableData 改造要点

### 4.1 统一 GET /api/table 示例

```ts
// app/api/table/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')
  if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

  const schema = await getTableSchema(tableId)
  if (!schema) return NextResponse.json({ error: 'Schema not found' }, { status: 404 })

  const { items } = await feishuClient.getRecords(tableId, { pageSize: 500 })
  const mappedFields = applyFieldMappingBatch(schema.fields)
  const records = items.map((record) => processRecord(record.fields || {}, mappedFields)) // 复用 useTableData 的 processRecord 逻辑，或抽到 lib/feishu 统一方法

  return NextResponse.json({ schema, records })
}
```

- `processRecord` 应对每条 record 的 fields 按 mappedFields 做解析与格式化，输出至少包含 `recordId` 与 `fields[dataKey].formatted`（或 raw/parsed/formatted），以便页面直接展示。

### 4.2 useTableData 改为按 tableId 请求

- 将内部请求从「GET /api/schema + GET /api/orders」改为：
  - 单一请求：**GET /api/table?tableId=xxx**（或 GET /api/table/xxx），
  - 或保留双请求但第二份改为 GET /api/table?tableId=xxx 只拿 records（schema 已有一份）。
- 这样 `useTableData({ tableId: TABLE_IDS.cashFlow })` 会拿到现金流表的数据，而不是订单表。

### 4.3 订单页 tableId 改为 env

```ts
// 订单页
import { TABLE_IDS } from '@/lib/config/env'
const { schema, loading: schemaLoading } = useTableSchema(TABLE_IDS.orders ?? '')
```

- 若 TABLE_IDS.orders 在服务端才存在，需通过接口把当前环境的 tableId 下发给前端，或使用 NEXT_PUBLIC_ 的 table ID 环境变量，保证前端与后端用同一 tableId。
