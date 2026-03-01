# OMS 近期修改代码审查报告

**审查日期**: 2025-02-28  
**审查范围**: 双 Base Token、Bankflow 插件位置、飞书配置页、银行流水表格、同步设置表名

---

## 一、双 Base Token 与现金表替换

### 1.1 `src/lib/config/env.ts`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | `getBaseTokenForTableId` 逻辑清晰：现金表 ID 匹配且配置了 `FEISHU_CASH_FLOW_BASE_TOKEN` 时返回现金表 token，否则返回默认 base token |
| **边界情况** | ⚠️ 注意 | 当 `tableId` 与 `cashFlowId` 均为空字符串时，`tableId === cashFlowId` 为 true，若配置了 `FEISHU_CASH_FLOW_BASE_TOKEN` 会返回现金表 token。实际场景中空 tableId 会在更早阶段报错，影响有限 |
| **类型安全** | ✅ 通过 | 函数签名明确，返回值 `string` |
| **可维护性** | ✅ 通过 | 注释清楚，职责单一 |

**建议**：可在 `getBaseTokenForTableId` 开头增加空 tableId 快速返回，避免边界歧义：

```typescript
if (!tableId?.trim()) return env.FEISHU_BASE_APP_TOKEN || ''
```

### 1.2 `src/lib/feishu/client.ts`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | `getRecords`、`getRecord`、`createRecord`、`updateRecord`、`deleteRecord`、`batchDeleteRecords` 均正确调用 `getBaseTokenForTableId(tableId)` |
| **类型安全** | 🔴 不通过 | 第 112 行 `(f: any)` 违反「禁止 any」规范 |
| **边界情况** | ⚠️ 注意 | `getRecords` 中 `data.data?.items` 若 API 返回 `{ data: null }` 会得到 `undefined`，当前用 `|| []` 可兜底，但 `data.data?.has_more` 同理，建议统一使用可选链 |

**修复建议**：

```typescript
// 第 112 行：为飞书 API 返回的 field 定义接口
interface FeishuApiField {
  field_id?: string
  field_name: string
  field_type?: number
  type?: number
  is_primary?: boolean
  is_extend?: boolean
  ui_type?: string
  property?: Record<string, unknown>
}
fields = (fieldsData.data?.items ?? []).map((f: FeishuApiField) => ({
  field_id: f.field_id,
  field_name: f.field_name,
  // ...
}))
```

---

## 二、Bankflow 插件位置调整

### 2.1 `src/app/logistics/page.tsx`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | 已移除银行流水同步，页面仅保留物流订单相关逻辑 |
| **回归风险** | ✅ 无 | 未发现误删其他功能 |

### 2.2 `src/app/finance/cash-flow/page.tsx`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | 银行流水同步、轮询、预览 Modal 流程完整 |
| **类型安全** | ✅ 通过 | `TableRecord`、`ProcessedField` 使用正确 |
| **潜在 Bug** | ⚠️ 注意 | `handleBankflowSync` 的 `useCallback` 依赖数组未包含 `pollTaskStatus`。`pollTaskStatus` 为独立 `useCallback`，当前实现可用，但若未来在 `handleBankflowSync` 内直接定义内联函数并调用，可能产生闭包陈旧问题 |
| **性能** | ✅ 通过 | `filteredRecords`、`summary`、`columns` 均使用 `useMemo` |
| **record_id 过滤** | ✅ 通过 | 预览 Modal 中 `skipKeys` 包含 `record_id`、`recordId`，正确排除 |

**表格与预览**：

- 行点击预览：`onRow={(record) => ({ onClick: () => setPreviewRecord(record), style: { cursor: 'pointer' } })}` 实现正确
- 去重：当前页面未做前端去重，去重逻辑应在 Bankflow 同步脚本或数据层实现，需在 Python 侧确认

---

## 三、飞书配置页

### 3.1 `src/app/api/config/feishu/route.ts`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | 正确读取 env 并返回配置 |
| **安全** | 🔴 严重 | **将 `appSecret`、`appId` 返回给客户端**，存在凭证泄露风险。飞书 App Secret 不应暴露给前端 |
| **安全** | ⚠️ 注意 | `appToken`、`cashFlowBaseToken` 为 Base 应用 token，虽非 API 密钥，但也不建议暴露给未授权客户端 |

**修复建议**：

- 仅返回非敏感配置（如表 ID、Base URL、iframe URLs）
- 敏感字段（`appId`、`appSecret`、`appToken`、`cashFlowBaseToken`）仅用于服务端，或做脱敏（如 `appId` 显示前 8 位 + `***`）

### 3.2 `src/app/system/feishu-config/page.tsx`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | 通过 API 拉取配置并展示 |
| **安全** | 🔴 严重 | 直接展示 `config.appSecret`，任何可访问该页面的用户都能获取完整凭证 |
| **类型安全** | ✅ 通过 | `FeishuConfig` 接口定义完整 |

**修复建议**：配置页仅展示脱敏信息，或限制为管理员可见，且 API 不返回 `appSecret`。

---

## 四、银行流水表格与预览

### 4.1 表格样式与交互

| 维度 | 评估 | 说明 |
|------|------|------|
| **样式** | ✅ 通过 | Card、Table、Statistic 使用合理，响应式布局正常 |
| **行点击预览** | ✅ 通过 | 实现正确 |
| **record_id 过滤** | ✅ 通过 | 预览时排除 `record_id`、`recordId` |

### 4.2 去重与 record_id

- **去重**：`useTableData` 和 `filteredRecords` 中未见去重逻辑。若需按业务键去重，应在：
  - Bankflow Python 同步脚本写入前去重，或
  - `/api/table` / `getTableData` 层做去重
- **record_id 过滤**：预览 Modal 中已正确过滤，无需调整。

---

## 五、同步设置表名

### 5.1 `src/lib/feishu/schema.ts`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | `SYNC_TABLES`、`tableIdToName` 定义合理，`syncTableSchema` 中 `tableName` 使用 `feishuSchema.name || tableIdToName[tableId] || tableId` 逻辑正确 |
| **getDisplayTableName** | ⚠️ 缺失 | 需求中提到的 `getDisplayTableName` 未在代码中出现。当前表名逻辑内联在 `syncTableSchema` 中，若需复用可抽取为独立函数 |
| **类型安全** | 🔴 不通过 | 第 78 行 `(field: any)` 违反规范 |
| **tableIdToName 键** | ⚠️ 注意 | 当 `TABLE_IDS.orders` 等为 `undefined` 时，`[TABLE_IDS.orders || '']` 会得到 `['']`，多个未配置表会共享同一键。建议仅在 `table.id` 有值时才加入映射 |

**修复建议**：

```typescript
const tableIdToName: Record<string, string> = {}
if (TABLE_IDS.orders) tableIdToName[TABLE_IDS.orders] = 'oms订单表'
if (TABLE_IDS.cashFlow) tableIdToName[TABLE_IDS.cashFlow] = 'oms现金表'
if (TABLE_IDS.finance) tableIdToName[TABLE_IDS.finance] = 'oms财务表'
```

### 5.2 `src/app/api/feishu/schema/sync-all/route.ts`

| 维度 | 评估 | 说明 |
|------|------|------|
| **正确性** | ✅ 通过 | 使用 `syncAllSchemas`、`getTableList` 返回的表名，逻辑正确 |
| **getDisplayTableName** | N/A | 当前未使用独立函数，表名来自 schema 或 `SYNC_TABLES` 的 `name`，行为符合预期 |

---

## 六、其他发现

### 6.1 `src/app/api/bankflow/records/route.ts` — 命令注入风险

| 维度 | 评估 | 说明 |
|------|------|------|
| **安全** | 🔴 严重 | 将 `source`、`dateFrom`、`dateTo`、`type`、`currency` 等用户输入直接拼接到 Python 代码字符串中，存在命令/代码注入风险。例如 `source` 含 `'` 或 `\n` 可破坏字符串并执行任意代码 |

**修复建议**：通过 `child_process.spawn` 将参数作为命令行参数传递，或使用 JSON 文件/环境变量传递，避免字符串拼接。

### 6.2 Bankflow 与 OMS 配置一致性

| 维度 | 评估 | 说明 |
|------|------|------|
| **配置一致性** | ⚠️ 注意 | Bankflow Python 脚本使用硬编码或 YAML 中的 `APP_TOKEN`、`TABLE_ID`，而 OMS 使用 `FEISHU_TABLE_CASH_FLOW`、`FEISHU_CASH_FLOW_BASE_TOKEN`。若两者不一致，同步写入的表与现金流页面读取的表可能不同 |

**建议**：在 `runner.ts` 中向 Python 进程传递 `FEISHU_TABLE_CASH_FLOW`、`FEISHU_CASH_FLOW_BASE_TOKEN` 等环境变量，并让 Python 脚本优先使用这些变量。

### 6.3 `src/lib/bankflow/task-store.ts`

| 维度 | 评估 | 说明 |
|------|------|------------|
| **正确性** | ✅ 通过 | 任务创建、更新、查询逻辑正确 |
| **Vercel 冷启动** | ⚠️ 注意 | 注释已说明：Vercel 冷启动后内存任务会丢失，长时间任务可能查不到状态。可考虑 Redis 或持久化存储 |

---

## 七、审查总结

### 必须修复（P0）

1. **飞书配置 API 暴露 appSecret**：`/api/config/feishu` 不应返回 `appSecret`，配置页不应展示完整 Secret
2. **bankflow/records 命令注入**：用户输入不得直接拼接到 Python 代码字符串，应通过参数或安全方式传递

### 建议修复（P1）

1. **移除 `any` 类型**：`client.ts` 第 112 行、`schema.ts` 第 78 行
2. **tableIdToName 键**：避免 `undefined` 作为键，仅在有有效 tableId 时建立映射

### 可选优化（P2）

1. **getBaseTokenForTableId**：对空 `tableId` 做早期返回
2. **getDisplayTableName**：若需多处复用表名，可抽取为独立函数
3. **Bankflow 与 OMS 配置**：统一 Base Token 与表 ID 的配置来源

---

## 八、与现有代码风格的一致性

| 项目 | 评估 |
|------|------|
| 命名 | 与项目内 `camelCase`、中文注释风格一致 |
| 错误处理 | 使用 `try/catch`、`NextResponse.json` 与现有 API 一致 |
| React 模式 | `useCallback`、`useMemo`、`useEffect` 使用符合项目习惯 |
| 类型定义 | 除 `any` 外，接口与类型使用规范 |
