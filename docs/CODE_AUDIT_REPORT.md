# 代码审计报告（开发规范符合性）

> **审计依据**: `docs/DEVELOPMENT_STANDARDS.md` v2.1  
> **审计日期**: 2026-02-15  
> **范围**: 订单管理及相关数据层、统计逻辑

---

## 一、技术规范检查结果

### 1.1 数据流与网关（符合）

| 检查项 | 要求 | 审计结果 |
|--------|------|----------|
| 前端不直接调用飞书 API | 必须通过 Next.js API Routes | **符合**。订单页通过 `useTableData` → 内部请求 `/api/table`；表 ID 通过 `/api/config/table-ids` 获取；无 `open.feishu.cn` 直连。 |
| 表 ID 来源 | 环境变量或配置 | **符合**。使用 `TABLE_IDS`（来自 `@/lib/config/env`，基于 `process.env.FEISHU_TABLE_*`）。 |

### 1.2 统一数据层（符合）

| 检查项 | 要求 | 审计结果 |
|--------|------|----------|
| 使用 useTableData | 新建/重构页面必须使用 | **符合**。订单页使用 `useTableData({ tableId })`，数据来自统一数据层。 |
| 字段访问方式 | 通过 Schema/映射，避免裸字段名 | **符合**。订单页表格、表单均基于 `schema.fields`、`visibleFields`、`field.fieldId` / `field.fieldName` / `field.dataKey` 动态渲染，无硬编码字段列表。 |

### 1.3 硬编码字段名（部分不符合）

| 位置 | 说明 | 规范要求 | 审计结果 |
|------|------|----------|----------|
| **`lib/feishu/order-stats.ts`** | `getOrderStatus`、`getOrderAmountCNY`、`isCurrencyUSD`、`getOrderAmountOriginal` 中使用 `order['进度']`、`order['订单金额CNY']`、`order['订单金额']`、`order['货币']` 及 `order._raw['进度']` 等 | 所有字段名来自 Schema 或配置，禁止硬编码 | **部分不符合**。统计层为「无飞书依赖」的纯函数，入参为扁平化订单对象，当前通过中文字段名 + dataKey 双写做兼容。 |

**建议**（二选一或分阶段）：

1. **约定数据契约**：统一数据层 / `recordToParsedOrder` 保证输出 **dataKey**（如 `status`、`amountCNY`、`orderAmount`、`currency`），`order-stats` 仅读取 dataKey（及 `order._raw` 的通用遍历），不再写死 `'进度'`、`'订单金额CNY'` 等中文 key。
2. **配置化**：将「进度 / 金额 / 货币」等逻辑名与可能的字段名（含中文）放到配置或常量表，`order-stats` 从配置读取 key 列表，避免散落硬编码。

### 1.4 空值检查与防御性编程（符合）

| 检查项 | 要求 | 审计结果 |
|--------|------|----------|
| 可选属性访问 | 避免 `undefined` 导致运行时错误 | **符合**。订单页对 `field.fieldId`、`field.fieldName` 使用 `field.fieldId \|\| ''`、`field.fieldName \|\| ''` 等默认值。 |
| 统计层 | 对 raw 做空值保护 | **符合**。`order-stats` 中 `String(raw ?? '').trim()`、`(order._raw && order._raw['...'])` 等用法得当。 |

### 1.5 核心文件保护（符合）

| 文件 | 保护级别 | 审计结果 |
|------|----------|----------|
| `app/hooks/useTableData.ts` | 最高 | 未在本次范围内修改，订单页仅调用。 |
| `lib/feishu/field-mapping.ts` | 最高 | 未修改。 |
| `lib/feishu/field-adapters.ts` | 最高 | 未修改。 |
| `lib/feishu/order-stats.ts` | 业务逻辑层 | 含硬编码字段名，见 1.3。 |

---

## 二、代码质量检查

### 2.1 Lint 与类型

- 建议在提交前执行：`npm run lint`，并确认修改文件无新增 Lint/类型错误。

### 2.2 订单页与规范对照

- **表格列**：由 `schema.fields` + `visibleFields` + 列配置动态生成，符合「Schema 驱动、动态渲染」。
- **表单**：由 `renderFormField(field)` 按 `fieldType`/类型推断渲染，无按字段名写死的 switch。
- **统计**：调用 `getOrderStats(orders, ORDER_STATUS_KEYS)`，状态键来自 `order-status.config`，未在页面写死状态列表。

---

## 三、审计结论与行动项

### 符合项摘要

- 数据流经 BFF，无前端直连飞书。
- 表 ID 来自环境变量/配置。
- 订单页使用 `useTableData`，表格/表单基于 Schema 动态渲染。
- 空值检查与防御性编程到位。
- 核心数据层/映射/适配器未被不当修改。

### 不符合项与建议

| 序号 | 项 | 建议 | 状态 |
|------|----|------|------|
| 1 | **order-stats 中硬编码中文字段名** | 与规范「字段名来自 Schema/配置」冲突。 | **已整改**：统计层优先使用与 field-mapping 一致的 dataKey（`status`、`amountCNY`、`amount`、`currency`），仅对 `order._raw` 保留极少中文 key 兜底以兼容 API 原始返回。 |

### 可选后续

- `recordToParsedOrder` 已通过 `flat[pf.meta.dataKey] = val` 写入 dataKey，order-stats 已改为优先使用 dataKey。
- 将本次审计纳入提交前 Checklist（见规范第 10 节）。

---

*审计依据：DEVELOPMENT_STANDARDS.md v2.1*
