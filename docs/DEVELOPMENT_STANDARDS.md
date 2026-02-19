# OMS 开发规范 - 技术与流程标准

> **版本**: v2.1  
> **创建日期**: 2026-02-12  
> **最后更新**: 2026-02-18  
> **状态**: 强制执行  
> **适用范围**: 所有OMS系统代码修改

---

# 第一部分：技术架构规范

## 1. 核心架构原则

### 1.1 数据流架构（必须遵守）

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   用户界面   │ ←→ │  本地缓存层   │ ←→ │  BFF API网关    │ ←→ │  飞书多维表格    │
│  (Next.js)  │     │ (SWR/内存)   │     │ (Next.js API)   │     │   (主数据源)    │
└─────────────┘     └──────────────┘     └─────────────────┘     └─────────────────┘
     ↑                                                              ↑
     │                                                              │
 【前端页面】          【本地服务层】          【网关/代理层】          【外部服务】
 - UI展示              - SWR缓存           - API路由转发         - 飞书API
 - 用户交互            - 内存缓存          - 数据转换            - 主数据源
 - 调用本地API         - LocalStorage      - 权限校验            - Schema元数据
```

**严格禁止**: 前端页面**直接**调用飞书API  
**必须通过**: Next.js API Routes 作为网关代理

---

## 2. 禁止硬编码清单（零容忍）

### 2.1 绝对禁止项

| 禁止项 | 错误示例 | 正确做法 |
|--------|----------|----------|
| **飞书字段名硬编码** | `fields['订单号']` `fields['客户']` | 通过Schema动态获取字段ID映射 |
| **字段类型硬编码** | `if (field === 'date')` | 读取飞书字段元数据类型 |
| **表ID硬编码** | `const TABLE_ID = 'tbl123'` | 环境变量 `process.env.FEISHU_TABLE_ORDERS` |
| **App凭证硬编码** | `const APP_ID = 'cli_xxx'` | 环境变量 `.env.local` |
| **iframe URL硬编码** | `src="https://feishu.cn/xxx"` | 环境变量配置 |
| **表结构版本硬编码** | `const SCHEMA_VERSION = 'v1'` | 自动同步飞书Schema版本 |
| **组件渲染逻辑硬编码** | 写死的switch case渲染 | Schema驱动的动态组件 |

### 2.2 配置化要求

所有可变配置必须通过以下方式管理：

1. **环境变量** (`.env.local`)
   - 飞书App凭证
   - 表ID
   - iframe嵌入链接
   - 系统级配置

2. **JSON配置文件** (`/config/*.json`)
   - 表结构映射
   - 字段显示配置
   - 权限配置

3. **Schema元数据** (运行时从飞书API获取)
   - 表字段定义
   - 字段类型
   - 关联关系

### 2.3 违规示例 vs 正确示例

#### ❌ 违规示例（禁止）

```typescript
// 硬编码字段名 - 禁止！
const order = {
  id: record.fields['订单号'],
  customer: record.fields['客户'],
  amount: record.fields['订单金额'],
  status: record.fields['商务进度'],
}

// 硬编码表ID - 禁止！
const TABLE_ID = 'tbl16urtK2gXVctO'

// 前端直接调用飞书API - 禁止！
const response = await fetch('https://open.feishu.cn/open-apis/...')

// 硬编码组件渲染 - 禁止！
if (fieldName === '订单号') {
  return <OrderNumberCell value={value} />
} else if (fieldName === '客户') {
  return <CustomerCell value={value} />
}
```

#### ✅ 正确示例（推荐）

```typescript
// 通过Schema动态映射字段
const order = mapRecordToEntity(record, schema.fieldMappings)

// 使用环境变量
const tableId = process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS

// 通过本地API网关调用
const response = await fetch('/api/feishu/tables/${tableId}/records')

// Schema驱动的动态渲染
const columns = schema.fields.map(field => ({
  fieldId: field.fieldId,
  title: getFieldLabel(field),
  render: (value) => <DynamicField field={field} value={value} />
}))
```

---

## 3. 动态组件/动态显示（核心要求）

### 3.1 Schema元数据驱动架构

```typescript
// ✅ 正确做法 - Schema驱动
function DynamicTable({ tableConfig }: { tableConfig: TableConfig }) {
  // 1. 从飞书API获取表结构（运行时）
  const { data: schema, loading: schemaLoading } = useTableSchema(tableConfig.tableId)
  
  // 2. 根据Schema动态生成列定义
  const columns = useMemo(() => {
    if (!schema) return []
    return generateColumnsFromSchema(schema, tableConfig.fieldMappings)
  }, [schema, tableConfig])
  
  // 3. 获取数据
  const { data: records } = useTableRecords(tableConfig.tableId)
  
  // 4. 动态渲染表格（列和组件都动态）
  return <DynamicDataTable columns={columns} data={records} />
}
```

### 3.2 动态表单组件

```typescript
// ✅ 正确做法 - 根据Schema动态渲染表单字段
function DynamicForm({ tableId }: { tableId: string }) {
  const { data: schema } = useTableSchema(tableId)
  
  return (
    <Form>
      {schema?.fields?.map(field => (
        <DynamicFormField 
          key={field.fieldId}
          field={field}  // Schema元数据驱动
          config={getFieldConfig(field.fieldId)}
        />
      ))}
    </Form>
  )
}
```

### 3.3 关键要求

- **飞书表结构更新** → OMS前端**自动更新**
- **无需重新开发、编译、部署**
- **单向同步**：飞书 → OMS（Schema）
- **组件渲染逻辑完全动态**，禁止写死任何字段逻辑

---

## 4. 统一数据架构标准（重构后规范）

> **版本**: v2.1  
> **生效日期**: 2026-02-14  
> **适用范围**: 所有新建页面和重构页面

### 4.1 核心原则：Schema驱动的统一数据层

**架构目标**:
- ✅ 数据一致性 - 同一字段在所有页面显示一致
- ✅ 类型一致性 - 飞书表类型自动映射到前端组件
- ✅ 零硬编码 - 飞书表字段变更无需修改代码
- ✅ 自动适应 - 后台更新后前端自动同步

**架构层级**:
```
┌─────────────────────────────────────────────────────────────┐
│                     页面层 (Pages)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  订单页面    │ │  物流页面    │ │       财务页面          │ │
│  │ (Schema驱动) │ │ (Schema驱动) │ │    (Schema驱动)        │ │
│  └──────┬──────┘ └──────┬──────┘ └───────────┬─────────────┘ │
└─────────┼───────────────┼────────────────────┼───────────────┘
          │               │                    │
          └───────────────┼────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                 统一数据层 (Unified Data Layer)               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  useTableData Hook                                      │  │
│  │  ├─ 整合 Schema 获取                                    │  │
│  │  ├─ 字段自动映射 (field-mapping)                        │  │
│  │  ├─ 类型适配 (field-adapters)                           │  │
│  │  ├─ 自动分类 (basic/logistics/financial/product)        │  │
│  │  └─ 格式化输出 (currency/percentage/date/status)        │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────────┐
│                  飞书 API 层 (Feishu API)                     │
│         /api/orders  /api/schema/[tableId]                   │
└───────────────────────────────────────────────────────────────┘
```

### 4.2 统一数据Hook使用规范

#### ✅ 必须使用 `useTableData` Hook（新建/重构页面）

```typescript
'use client'

import { useTableData } from '@/app/hooks/useTableData'

export default function OrdersPage() {
  // ✅ 正确做法：使用统一数据Hook
  const { 
    records,              // 处理后的记录数组
    schema,               // Schema定义
    mappedFields,         // 映射后的字段列表
    categorizedFields,    // 按分类分组的字段
    loading, 
    error,
    refetch,
    stats                 // 统计信息
  } = useTableData({
    tableId: process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS!,
    moduleId: 'orders'    // 可选，用于权限控制
  })

  // 自动字段分类使用
  const basicFields = categorizedFields.basic      // 基础字段
  const logisticsFields = categorizedFields.logistics  // 物流字段
  const financialFields = categorizedFields.financial  // 财务字段

  return (
    <div>
      <h1>订单列表 ({stats.totalRecords})</h1>
      
      {/* 动态渲染表格 */}
      <DynamicTable 
        fields={mappedFields}
        records={records}
        loading={loading}
      />
    </div>
  )
}
```

#### ❌ 禁止直接访问字段（旧方式）

```typescript
// ❌ 禁止：硬编码字段名
const order = {
  id: record.fields['订单号'],
  customer: record.fields['客户'],
  amount: record.fields['订单金额'],
}

// ❌ 禁止：硬编码字段分类
const basicFields = ['订单号', '客户', '产品']
const financialFields = ['订单金额', '毛利率']
```

### 4.3 字段映射规则系统

#### 智能字段映射 (`lib/feishu/field-mapping.ts`)

**工作原理**:
1. **规则匹配** - 根据字段名正则、类型、UI类型匹配规则
2. **自动映射** - 自动生成 dataKey（驼峰命名）
3. **自动分类** - 自动归类到 basic/logistics/financial/product
4. **自动格式化** - 自动识别 currency/percentage/date/status

**预定义规则示例**:
```typescript
// 订单号规则
{
  match: { fieldName: /^(订单号|id|order.?id|order.?no)$/i },
  mapTo: { dataKey: 'id', category: 'basic', format: 'text', priority: 100 }
}

// 金额字段规则（自动识别）
{
  match: { 
    fieldName: /(金额|amount|price|cost|fee|毛利|退税|保险|杂费)/i,
    fieldType: 2  // 数字类型
  },
  mapTo: { format: 'currency', category: 'financial', priority: 80 }
}

// 日期字段规则（自动识别）
{
  match: {
    fieldName: /(日期|date|时间|time|ETD|ETA)/i,
    fieldType: 5  // 日期类型
  },
  mapTo: { format: 'date', category: 'logistics', priority: 80 }
}
```

**dataKey自动生成规则**:
```typescript
// "订单金额CNY" → "orderAmountCNY"
// "物流进度" → "logisticsProgress"
// "毛利率" → "grossProfitRate"
// "ETD" → "etd"
```

### 4.4 字段分类标准

| 分类 | 说明 | 典型字段 | 用途 |
|------|------|---------|------|
| **basic** | 基础信息 | 订单号、客户、产品、签约日期 | 订单列表、基础信息卡片 |
| **logistics** | 物流信息 | ETD、ETA、物流进度、出发地、目的地 | 物流跟踪页面 |
| **financial** | 财务信息 | 订单金额、毛利率、退税额、费用 | 财务分析、报表 |
| **product** | 产品信息 | 规格、数量、单位、单价 | 产品详情、报价 |
| **other** | 其他字段 | 未分类字段 | 通用显示 |

### 4.5 数据格式化标准

**自动格式化类型**:

| 格式类型 | 输入值 | 显示值 | 说明 |
|---------|--------|--------|------|
| **currency** | 100000 | ¥100,000.00 | 货币格式，自动加¥符号和千分位 |
| **percentage** | 0.25 | 25.00% | 百分比格式，自动转百分比 |
| **date** | 1707868800000 | 2024-02-14 | 日期格式，YYYY-MM-DD |
| **status** | "已签约" | <Tag>已签约</Tag> | 状态标签，带颜色样式 |
| **text** | "文本内容" | "文本内容" | 纯文本，原样显示 |

**使用示例**:
```typescript
const { records } = useTableData({ tableId })

// 自动格式化显示
records[0].fields['orderAmount']?.formatted  // "¥100,000.00"
records[0].fields['grossProfitRate']?.formatted  // "25.00%"
records[0].fields['etd']?.formatted  // "2024-02-14"
```

### 4.6 飞书特殊字段处理

#### 4.6.1 字段类型映射表

| 飞书类型 | type值 | Adapter | 处理方式 |
|---------|--------|---------|---------|
| 文本 | 1 | textAdapter | 直接显示 |
| 数字 | 2 | numberAdapter | 支持 currency/percentage 格式化 |
| 单选 | 3 | singleSelectAdapter | 显示选项文本 |
| 多选 | 4 | multiSelectAdapter | 逗号分隔显示 |
| 日期 | 5 | dateAdapter | YYYY-MM-DD 格式化 |
| 复选框 | 7 | checkboxAdapter | ✓ 或 - |
| 人员 | 11 | userAdapter | 显示用户名 |
| 电话 | 13 | phoneAdapter | 直接显示 |
| 超链接 | 15 | linkAdapter | 可点击链接 |
| 附件 | 17 | attachmentAdapter | 文件名逗号分隔 |
| 关联记录 | 18 | linkRecordAdapter | "N 条记录" |
| 查找引用 | 19 | lookupAdapter | 自动解析显示 |
| **公式** | **20** | **智能推断** | 根据值类型自动格式化 |
| 关联公式 | 21 | 智能推断 | 根据值类型自动格式化 |
| 地理位置 | 22 | locationAdapter | 显示地址名称 |
| 群组 | 23 | groupAdapter | 群组名逗号分隔 |
| **引用** | **24** | **textAdapter** | 降级为文本显示 |
| 创建时间 | 1001 | dateAdapter | 日期时间格式化 |
| 更新时间 | 1002 | dateAdapter | 日期时间格式化 |
| 创建人 | 1003 | userAdapter | 用户名 |
| 更新人 | 1004 | userAdapter | 用户名 |
| 自动编号 | 1005 | autoNumberAdapter | 直接显示 |
| 富文本 | 3001 | textAdapter | 文本显示 |

#### 4.6.2 公式字段处理（核心）

飞书公式字段可能返回两种形式：

**形式一：公式对象结构**
```typescript
// API 返回的公式对象
{ type: 1, value: ["计算结果"] }
{ type: 2, value: [1000] }
{ type: 5, value: [1707868800000] }
```

**形式二：计算后的值**
```typescript
// 直接返回计算结果
1000
"已签约"
"2024-02-14"
```

**处理逻辑** (`useTableData.ts`):
```typescript
function processFieldValue(value: unknown, field: MappedField): ProcessedField {
  // 形式一：检测公式对象结构
  if (isFormulaValue(value)) {
    const parsed = parseFormulaValue(value)
    return { formatted: parsed.formatted, ... }
  }
  
  // 形式二：公式字段类型的值推断
  if (field.fieldType === 20 || field.fieldType === 21) {
    // 数值推断
    if (typeof value === 'number' || !isNaN(Number(value))) {
      return { formatted: formatCurrency(num), ... }
    }
    // 日期推断
    if (typeof value === 'string' && value.includes('-')) {
      return { formatted: formatDate(date), ... }
    }
  }
  
  // 默认使用适配器
  return { formatted: adapter.format(parsed), ... }
}
```

#### 4.6.3 关联字段处理

**关联记录 (Link Record, type 18)**:
```typescript
// 显示为 "N 条记录"
value: { link_record_ids: ['rec1', 'rec2'] }
// 显示: "2 条记录"
```

**查找引用 (Lookup, type 19)**:
```typescript
// 自动解析嵌套对象
value: { value: [{ text: '显示文本' }] }
// 显示: "显示文本"
```

### 4.7 业务展示规范（表格与表单）

> **生效日期**: 2026-02-18  
> **适用范围**: 所有显示详细数据的表格、表单、弹窗

#### 4.7.1 公式字段：只显示不可编辑

飞书表中字段类型为**公式**（fieldType 20/21）或按字段名识别的公式字段（订单金额CNY、毛利、毛利率、退税额、税费等），在前端页面中：

- **表格**：正常显示，参与列展示
- **表单/编辑弹窗**：**仅显示，不可编辑**，不渲染为可输入控件，不提交到飞书 API

**识别规则**：优先依据 fieldType 20/21；未带类型时按字段名兜底（订单金额CNY、毛利、毛利率、退税额、税费等）。

#### 4.7.2 货币符号与「货币」字段一致

所有显示详细记录的表格/表单中，**「货币」字段**与**「单价」「订单金额」**等金额类字段的货币符号必须保持一致：

- 根据当前记录的「货币」字段取值（CNY/RMB → ¥，USD → $）动态显示
- 禁止硬编码单一货币符号（如固定使用 ¥）
- 同一行/同一记录内，货币、单价、订单金额等金额展示必须使用相同符号

**实现示例**：
```typescript
function getCurrencySymbol(currency: unknown): string {
  const s = String(currency ?? '').trim().toUpperCase()
  if (s === 'USD') return '$'
  if (s === 'CNY' || s === 'RMB') return '¥'
  return ''
}
// 表单中：prefix={getCurrencySymbol(record.货币字段值) || '¥'}
```

#### 4.6.4 Fallback 机制

所有未知字段类型都会降级为 textAdapter，确保不会因类型未知导致显示错误：
```typescript
function getFieldAdapter(fieldType: number): FieldAdapter {
  return adapters[fieldType] || textAdapter
}
```

### 4.7 与旧方式对比

| 场景 | 旧方式（禁止） | 新方式（推荐） | 优势 |
|------|---------------|---------------|------|
| **字段访问** | `record.fields['订单号']` | `record.fields['id']?.formatted` | 统一dataKey，自动格式化 |
| **字段分类** | 硬编码数组 `['订单号', '客户']` | `categorizedFields.basic` | 自动分类，动态适应 |
| **金额显示** | 手动格式化 | 自动 `¥100,000.00` | 一致性格式化 |
| **表结构变更** | 需修改代码 | 自动适应 | 零维护成本 |
| **新增字段** | 需手动添加 | 自动识别分类 | 即加即用 |

### 4.8 迁移指南

#### 现有页面迁移步骤

**Step 1**: 替换数据获取Hook
```typescript
// 旧代码
const { orders } = useOrders()  // 或 useLogisticsOrders()

// 新代码
const { records, categorizedFields } = useTableData({ 
  tableId: TABLE_IDS.orders,
  moduleId: 'orders'
})
```

**Step 2**: 更新字段访问方式
```typescript
// 旧代码
order.customer
order.amount

// 新代码
record.fields['customer']?.formatted
record.fields['orderAmount']?.formatted
```

**Step 3**: 更新字段分类（如有）
```typescript
// 旧代码
const basicFields = ['订单号', '客户', '产品']

// 新代码
const { categorizedFields } = useTableData({ tableId })
const basicFields = categorizedFields.basic  // 自动获取
```

---

## 5. 数据同步策略

### 4.1 数据流向（双向同步支持）

```
飞书多维表格 ←────────→ OMS系统
      ↑                      ↑
      │                      │
   主数据源              视图/操作层
   - 订单数据            - 数据展示
   - 客户信息            - 状态更新
   - 产品信息            - 新增记录
   - 物流信息            - 查询筛选
```

**支持双向同步**：
- ✅ **读取**：OMS从飞书读取数据（主要场景）
- ✅ **写入**：OMS向飞书写入数据（新增/更新/删除）

### 4.2 表结构流向（严格单向）

```
飞书多维表格 ────────→ OMS系统
      ↑                      ↑
      │                      │
   表结构定义             Schema缓存
   - 字段名               - 元数据缓存
   - 字段类型             - 动态组件
   - 关联关系             - 配置生成
   - 权限设置             - 权限映射
   
【只允许】：飞书 → OMS
【禁止】：OMS修改飞书表结构
```

### 4.3 Schema同步策略

**Schema同步特点**：
- ❌ **不需要自动同步** - Schema变更不频繁，无需定时检查
- ❌ **不需要定时同步** - 避免不必要的API调用
- ✅ **手动触发即可** - 仅在飞书表结构修改后手动刷新
- ✅ **支持单表/全部刷新** - 可单独刷新某个表，或一次性刷新全部

---

## 6. 文件组织规范

### 动态组件目录

```
src/
├── components/
│   └── dynamic/              # 动态组件（Schema驱动）
│       ├── DynamicTable/     # 动态表格
│       ├── DynamicForm/      # 动态表单
│       ├── DynamicField/     # 动态字段
│       └── DynamicFilter/    # 动态筛选
├── hooks/
│   ├── useTableSchema.ts     # Schema获取Hook
│   ├── useTableRecords.ts    # 数据获取Hook
│   └── useFieldMapping.ts    # 字段映射Hook
├── lib/
│   ├── feishu/
│   │   ├── client.ts         # 飞书客户端（仅API路由使用）
│   │   ├── schema.ts         # Schema解析工具
│   │   └── mapper.ts         # 字段映射工具
│   └── config/
│       ├── tables.config.json    # 表配置
│       └── schema.cache.json     # Schema缓存
└── app/
    └── api/                  # BFF API网关
        └── feishu/
            ├── schema/
            │   └── route.ts      # 获取Schema
            ├── records/
            │   └── route.ts      # CRUD操作
            └── tables/
                └── route.ts      # 表元数据
```

---

# 第二部分：开发流程规范

## 7. 变更防御策略

### 6.1 核心原则

#### 最小修改原则
- **只修改必要的代码**，不进行大规模重构
- **逐个修复问题**，每修复一个验证一个
- **避免一次性修改多个无关问题**

#### 验证驱动开发
```
发现问题 → 定位根因 → 最小修复 → 立即验证 → 提交记录
```

---

## 8. 调试流程

### 7.1 问题定位阶段

| 步骤 | 操作 | 检查点 |
|------|------|--------|
| 1 | 复现问题 | 确认错误可稳定复现 |
| 2 | 定位错误文件 | 读取错误堆栈对应的文件 |
| 3 | 搜索同类问题 | 用 Grep 搜索项目中是否有类似问题 |

**必须执行的搜索**:
```bash
# 检查所有使用 .includes() 的地方，可能存在 undefined 风险
grep -r "\.includes(" --include="*.tsx" src/

# 检查所有使用 .toLowerCase() 的地方
grep -r "\.toLowerCase()" --include="*.tsx" src/

# 检查所有可能为 undefined 的变量调用方法
```

### 7.2 修复执行阶段

**防御性编程规范**:

```typescript
// ❌ 危险：未检查空值
if (fieldId.includes('status') || field.fieldName.includes('状态'))

// ✅ 安全：添加空值检查
const fieldId = field.fieldId || ''
if (!fieldId || fieldId.includes('status') || (field.fieldName || '').includes('状态'))

// ✅ 安全：为可能undefined的属性提供默认值
const fieldName = field.fieldName || '未命名字段'
```

**类型安全规范**:
```typescript
// ❌ 危险：unknown 类型直接操作
order.contractDate >= dateRange[0]

// ✅ 安全：先进行类型检查
if (typeof order.contractDate === 'string') {
  order.contractDate >= dateRange[0]
}
```

### 7.3 验证阶段

**每次修改后必须执行**:

```bash
# 1. Lint 检查
npm run lint

# 2. 本地服务验证
npm run dev
# 访问相关页面确认功能正常
```

---

## 9. 常见问题防御模式

### 8.1 空值检查 (Null Safety)

| 场景 | 风险 | 防御方案 |
|------|------|----------|
| `field.fieldId.includes()` | fieldId 可能为 undefined | `const fieldId = field.fieldId \|\| ''` |
| `field.fieldName.includes()` | fieldName 可能为 undefined | `(field.fieldName \|\| '').includes()` |
| `order.status.toLowerCase()` | status 可能为 undefined | `(order.status \|\| '').toLowerCase()` |
| `array.map(item => item.id)` | item 可能为 null | `array.filter(Boolean).map()` |

### 8.2 类型安全 (Type Safety)

| 场景 | 风险 | 防御方案 |
|------|------|----------|
| API 返回 unknown 类型 | 无法访问属性 | 使用类型守卫 `if (typeof x === 'string')` |
| 可选链深层属性 | 中间层可能不存在 | 使用 `?.` 或提供默认值 |
| 数组元素类型不确定 | forEach/map 类型推断错误 | 使用 `as Type` 或类型守卫 |

### 8.3 状态管理 (State Management)

| 场景 | 风险 | 防御方案 |
|------|------|----------|
| useState 闭包问题 | 事件处理函数引用旧状态 | 使用 `useCallback` 或 `setState(prev => ...)` |
| checkbox onChange | 事件池导致 checked 值错误 | 先提取 `const checked = e.target.checked` |
| 异步状态更新 | 状态更新后立即读取旧值 | 使用 `useEffect` 监听状态变化 |

---

## 9. 重构代码保护机制

### 9.1 核心文件保护

以下文件为 Schema 驱动重构核心代码，修改前必须咨询架构负责人：

| 文件 | 作用 | 保护级别 |
|------|------|---------|
| `app/hooks/useTableData.ts` | 统一数据层 | 🔴 最高 |
| `lib/feishu/field-mapping.ts` | 字段映射系统 | 🔴 最高 |
| `lib/feishu/field-adapters.ts` | 字段类型适配器 | 🔴 最高 |
| `lib/feishu/formula-parser.ts` | 公式解析器 | 🔴 最高 |

### 9.2 Lint 规则保护

已添加 ESLint 规则防止硬编码字段访问：

```javascript
// 禁止直接访问 fields[字段名]
// ❌ 错误示例
const name = record.fields['订单号']
const amount = data.fields['订单金额']

// ✅ 正确示例
const { records } = useTableData({ tableId })
const name = records[0].fields['orderNumber']?.formatted
```

### 9.3 修改流程

```
需要修改核心文件时的流程：

1. 确认问题范围
   ├── 问题是否在核心数据层？
   ├── 能否在页面层解决？

2. 咨询架构负责人
   ├── 说明修改意图
   ├── 提供替代方案（如有）

3. 获得批准后修改
   ├── 最小修改原则
   ├── 立即验证
   ├── 记录变更原因
```

### 9.4 Bug 修复优先级

| 优先级 | 场景 | 处理方式 |
|--------|------|---------|
| P0 | 核心数据层 Bug | 立即修复，但需评审 |
| P1 | 页面层 Bug | 在页面文件内修复 |
| P2 | 优化建议 | 记录但不立即处理 |

---

## 10. 代码审查Checklist

每次提交代码前，必须检查：

### 技术规范检查
- [ ] **没有硬编码字段名** - 所有字段名来自Schema或配置文件
- [ ] **没有硬编码表ID** - 使用环境变量
- [ ] **没有硬编码URL** - 使用环境变量或配置
- [ ] **前端不直接调用飞书API** - 必须通过/api路由
- [ ] **组件支持动态渲染** - 根据Schema动态生成
- [ ] **表结构单向同步** - OMS不修改飞书Schema
- [ ] **配置外部化** - 可变配置在.env或JSON文件
- [ ] **有Schema缓存机制** - 避免重复请求

### 代码质量检查
- [ ] 已运行 `npm run lint`，无新增 Lint 错误
- [ ] 修改的文件已通过 LSP 诊断检查
- [ ] 已检查是否存在同类问题的其他文件
- [ ] 已验证相关页面功能正常工作
- [ ] 如果修改了 API，已验证前后端数据一致性

---

## 11. Git 提交规范

### 提交信息格式

```
[type] [scope] [description]

[body]

[footer]
```

### Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `fix` | Bug 修复 | `fix: 修复订单页 fieldId undefined 错误` |
| `feat` | 新功能 | `feat: 添加动态 schema 支持` |
| `refactor` | 代码重构 | `refactor: 简化字段映射逻辑` |
| `chore` | 构建/工具 | `chore: 更新依赖版本` |

### 示例

```
fix: 修复 orders page fieldId undefined 错误

- 添加 fieldId 空值检查
- 为 fieldName 提供默认值
- 同步修复 logistics page 类似问题
```

---

## 12. 回滚策略

如果修改后出现新问题:

1. **立即停止修改** - 不要继续"修复"
2. **记录已尝试的修改** - 记录哪些改法无效
3. **回滚到上一个稳定版本** - 使用 `git checkout`
4. **咨询 Oracle** - 描述完整的问题上下文

**禁止行为**:
- ❌ 删除失败的测试来"通过"测试
- ❌ 使用 `as any` 或 `@ts-ignore` 抑制错误
- ❌ 猜测性修改（shotgun debugging）

---

# 第三部分：部署规范

## 13. 部署方案

### 12.1 决策结果：Vercel SSR

**选择理由**：
1. ✅ **完整支持 API Routes** - BFF网关层可以正常工作
2. ✅ **避免 CORS 问题** - 服务端调用飞书API，前端调用本地API
3. ✅ **自动部署** - Git push 后自动构建部署
4. ✅ **全球 CDN** - 访问速度快
5. ✅ **免费额度充足** - 小团队完全够用

### 12.2 环境配置

**生产环境变量**（在 Vercel Dashboard 中配置）：
```bash
# 飞书应用配置（服务端）
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_BASE_APP_TOKEN=XXXXXXXXXXXXXXXXXXXX

# 飞书表格ID（服务端）
FEISHU_TABLE_ORDERS=tblXXXXXXXX
FEISHU_TABLE_CUSTOMERS=tblYYYYYYYY
FEISHU_TABLE_PRODUCTS=tblZZZZZZZZ

# 客户端配置（NEXT_PUBLIC_ 前缀）
NEXT_PUBLIC_FEISHU_APP_ID=$FEISHU_APP_ID
NEXT_PUBLIC_FEISHU_TABLE_ORDERS=$FEISHU_TABLE_ORDERS
```

**注意**：
- 敏感信息（App Secret）**不要**加 `NEXT_PUBLIC_` 前缀，只在服务端使用
- 需要在客户端使用的变量才加 `NEXT_PUBLIC_` 前缀

### 12.3 部署流程

```bash
# 1. 开发阶段
npm run dev        # 本地开发，API路由正常工作

# 2. 构建测试
npm run build      # 确保构建成功

# 3. 部署到 Vercel
npx vercel --prod

# 4. 验证
# - 检查所有页面正常
# - 测试 API 路由 (/api/orders, /api/feishu/*)
# - 验证飞书数据连接
```

---

# 第四部分：更新记录

## 更新日志

| 日期 | 版本 | 变更内容 | 负责人 |
|------|------|----------|--------|
| 2026-02-12 | v1.0 | 初始版本 - 技术规范 | 技术负责人 |
| 2026-02-12 | v1.1 | 明确数据同步方向：数据双向 + Schema单向 | 技术负责人 |
| 2026-02-12 | v1.2 | 确定部署方案：Vercel SSR 服务端渲染 | 技术负责人 |
| 2026-02-12 | v1.3 | Schema同步改为手动触发（去掉自动/定时同步） | 技术负责人 |
| 2026-02-13 | v2.0 | 合并技术规范与开发流程规范 | 技术负责人 |
| 2026-02-14 | v2.1 | 新增统一数据层架构：useTableData + field-mapping + field-adapters | 技术负责人 |
| 2026-02-14 | v2.1 | 新增飞书公式/关联/引用字段智能处理机制 | 技术负责人 |
| 2026-02-14 | v2.1 | Bug修复：useTableData无限循环 + data-config Table key错误 | 技术负责人 |
| 2026-02-18 | v2.2 | 新增业务规范 4.7：公式字段只显示不可编辑；货币符号与货币字段一致 | 技术负责人 |

---

**记住：配置优于硬编码，动态优于静态，网关优于直连，SSR优于静态导出！**
**开发阶段简单为主，生产阶段考虑完善！**

*Last Updated: 2026-02-18*
*Version: 2.2*
