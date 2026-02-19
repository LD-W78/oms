# 订单/物流模块数据层统一性检查

## 结论：已统一通过数据层访问读数据

- **订单模块**：列表与 Schema 均通过 `useTableData` → `GET /api/table?tableId=xxx` → `getTableData(tableId)` 获取，与物流一致。
- **物流模块**：列表与 Schema 通过 `useTableData` → `GET /api/table?tableId=xxx` → `getTableData(tableId)` 获取，未改动。

## 数据流

### 读（列表 + Schema）

| 模块   | 前端                     | API              | 数据层           |
|--------|--------------------------|------------------|------------------|
| 订单   | `useTableData({ tableId })` | `GET /api/table` | `getTableData(tableId)` |
| 物流   | `useTableData({ tableId, filter })` | `GET /api/table` | `getTableData(tableId)` |

- 统一入口：`src/lib/feishu/table-data.ts` 的 `getTableData(tableId)`。
- 返回：`{ schema, records }`，其中 `records` 为 `TableRecord[]`（已按 field-mapping 格式化）。
- 订单页将 `records` 转为 `ParsedOrderLike` 用于展示与统计；物流页将 `records` 转为 `LogisticsOrder` 用于展示。

### 写（创建 / 更新 / 删除）

| 操作   | API                        | 实现                     |
|--------|----------------------------|--------------------------|
| 创建订单 | `POST /api/orders`         | `createOrder()` → `feishuClient.createRecord` |
| 更新订单 | `PUT /api/orders/[recordId]` | `feishuClient.updateRecord` |
| 删除订单 | `DELETE /api/orders/[recordId]` | `feishuClient.deleteRecord` |

- 写操作不经过 `table-data` 的 processRecord，由 API 直接调飞书客户端，符合当前设计（写无需同一套格式化）。

## 关键文件

- 数据层读：`src/lib/feishu/table-data.ts`（`getTableData`、`tableRecordToParsedOrder`）
- 统一 API：`src/app/api/table/route.ts`（`GET ?tableId=xxx`）
- 前端 Hook：`src/app/hooks/useTableData.ts`（仅请求 `/api/table`）
- 订单统计（前后端共用）：`src/lib/feishu/order-stats.ts`（`getOrderStats`）
- 订单页 TableRecord→订单形态：`src/app/utils/recordToOrder.ts`（`recordToParsedOrder`）

## 历史说明

- 此前订单页通过 `fetch('/api/orders')` 拉列表，`/api/orders` 内部已使用 `getOrders()` → `getTableData()`，服务端数据来源已统一，但前端入口与物流不一致。
- 本次将订单页改为 `useTableData`，与物流共用同一读路径（`/api/table` + `getTableData`），统计改为前端用 `getOrderStats(recordToParsedOrder(records))` 计算；`GET /api/orders` 仍保留供其他调用方使用。
