# OMS 代码审计与性能优化报告

> **日期**: 2026-02-20  
> **范围**: 订单/物流/财务模块、数据层、API

---

## 一、规范符合性检查

### 1.1 数据流架构 ✅

- 前端通过 `useTableData` 调用 `/api/table`，未直接访问飞书 API
- BFF 层 (`/api/table` → `getTableData`) 正确代理飞书请求

### 1.2 禁止硬编码 ✅

- 表 ID 通过 `TABLE_IDS` / 环境变量获取
- 字段通过 Schema 动态映射，无硬编码字段名

### 1.3 统一数据层 ✅

- 订单、物流、财务均使用 `useTableData`
- 字段格式化由 `field-adapters` / `field-mapping` 统一处理

### 1.4 待改进

- 部分页面存在 `isCurrencyField` / `isDateField` 等基于字段名的推断逻辑，建议逐步迁移到 Schema 的 `format` 字段

---

## 二、性能优化实施

### 2.1 服务端：getTableData 优化

**问题**: 每次请求都先调用 `syncTableSchema`（2 次飞书 API），再拉取 records。

**优化**:
- 优先使用文件缓存的 schema（`getTableSchema`），无网络请求
- 仅当缓存未命中时才 `syncTableSchema`
- 减少重试延迟：300ms → 200ms

**预期效果**: 首次加载后，再次打开页面可减少 2 次飞书 API 调用。

### 2.2 客户端：useTableData 缓存

**问题**: 每次进入页面都发起完整请求，订单/物流共用同一表却重复拉取。

**优化**:
- 增加内存缓存，TTL 45 秒
- 同 tableId 在 TTL 内复用数据（订单 ↔ 物流切换即生效）
- `refetch()` 强制刷新时跳过缓存

### 2.3 useModuleConfig 缓存

**问题**: 模块配置每次加载都请求 API。

**优化**:
- 内存缓存 60 秒
- 配置保存时通过 BroadcastChannel 失效缓存

### 2.4 Schema 缓存路径

**变更**: `/tmp/oms-schema-cache` → `config/.schema-cache`  
- 与项目配置目录一致
- 已加入 `.gitignore`

---

## 三、修改文件清单

| 文件 | 变更 |
|------|------|
| `src/lib/feishu/table-data.ts` | 优先缓存 schema，减少 syncTableSchema 调用 |
| `src/app/hooks/useTableData.ts` | 客户端缓存 45s，订单/物流同表复用 |
| `src/app/hooks/useModuleConfig.ts` | 配置缓存 60s |
| `src/lib/feishu/schema-cache.ts` | 缓存目录改为 config/.schema-cache |
| `.gitignore` | 忽略 config/.schema-cache |

---

## 四、使用建议

1. **首次使用**: 在「系统管理 → 同步设置」中同步表结构，生成 schema 缓存
2. **刷新数据**: 点击页面「刷新」按钮会强制拉取最新数据
3. **快速切换**: 订单 ↔ 物流 45 秒内切换将使用缓存，无需重新请求
