# 代码规范与数据管理生效检查报告

> 检查日期：2026-02-18

---

## 一、代码规范检查（ESLint）

### 1.1 检查结果概览

| 类型 | 数量 |
|------|------|
| 错误 (error) | 32 |
| 警告 (warning) | 91 |
| **合计** | **123** |

### 1.2 主要问题分类

#### 1.2.1 禁止硬编码 fields 访问（no-restricted-syntax）

开发规范要求：禁止直接访问 `fields[字段名]`，应使用 `useTableData` Hook 获取数据并通过 dataKey 访问。

**涉及文件：**
- `src/app/components/Dynamic/DynamicForm.tsx`
- `src/app/components/DynamicForm/index.tsx`
- `src/app/components/DynamicTable/index.tsx`
- `src/lib/feishu/field-mapping.ts`
- `src/lib/feishu/orders.ts`
- `src/lib/feishu/table-data.ts`

**说明：** 部分为数据层/表单组件内部实现，需评估是否属于「Schema 驱动」场景下的合理用法，或需重构为通过 dataKey 访问。

#### 1.2.2 React Hooks 规则违规（react-hooks/rules-of-hooks）

**涉及文件：** `src/app/components/Layout/MainLayout.tsx`

- 在 early return 之后调用 `useCallback`、`useMemo`，违反 Hooks 调用顺序
- **需优先修复**：可能导致运行时异常

#### 1.2.3 Effect 内同步 setState（react-hooks/set-state-in-effect）

**涉及文件：** `src/app/components/Feishu/FeishuIframe.tsx`

- 在 `useEffect` 内直接调用 `setLoading(true)` 等，可能触发级联渲染

#### 1.2.4 未使用变量/导入（@typescript-eslint/no-unused-vars）

**涉及文件（部分）：**
- `src/app/finance/receivable-payable/page.tsx`：DollarOutlined、dayjs（已修复）
- `src/app/finance/cash-flow/page.tsx`：BankOutlined
- `src/app/api/debug/*`：若干未使用变量
- `src/lib/feishu/*`：若干未使用导入

#### 1.2.5 any 类型（@typescript-eslint/no-explicit-any）

- 多个组件和 lib 中存在 `any` 类型，建议逐步替换为具体类型

### 1.3 建议修复优先级

1. **P0**：MainLayout.tsx 的 Hooks 规则违规
2. **P1**：FeishuIframe.tsx 的 setState-in-effect
3. **P2**：未使用变量/导入（低风险，可批量清理）
4. **P3**：fields 硬编码、any 类型（需结合业务评估）

---

## 二、数据管理设置生效情况

### 2.1 数据管理配置说明

系统管理 → 数据管理 中可配置各模块的字段权限：
- **显示**：控制表格/表单中是否展示该字段
- **查看**：是否允许查看
- **新增**：是否允许新增时填写
- **编辑**：是否允许编辑
- **删除**：是否允许删除

配置存储在 `config/module-fields.json`，通过 `/api/config/modules` 和 `/api/config/modules/[moduleId]` 提供。

### 2.2 各模块生效情况

| 模块 | 路由 | 预定义 moduleId | 是否使用 useModuleConfig | 数据管理是否生效 |
|------|------|-----------------|--------------------------|------------------|
| 订单管理 | /orders | orders | ✅ 是 | ✅ **已生效** |
| 物流跟踪 | /logistics | logistics | ❌ 否 | ❌ **未生效** |
| 应收应付 | /finance/receivable-payable | finance-receivable | ❌ 否 | ❌ **未生效** |
| 银行流水 | /finance/cash-flow | finance-cashflow | ❌ 否 | ❌ **未生效** |
| 经营分析 | /finance/analysis | finance-analysis | - | - |

### 2.3 订单管理（已生效）

- 使用 `useModuleConfig('orders')` 获取配置
- **可见列**：依据 `fieldPermissions[fieldId].visible` 过滤
- **新增**：`canCreate` 依据至少一个字段 `create !== false`
- **编辑**：`canEdit` 依据至少一个字段 `edit !== false`
- **表单字段**：新增/编辑时依据 `create`/`edit` 权限过滤

### 2.4 物流跟踪、应收应付、银行流水（未生效）

- 未调用 `useModuleConfig`
- 字段展示、操作权限均未读取数据管理配置
- 用户在此处修改「显示」「新增」「编辑」等不会影响这些页面

### 2.5 预定义模块与路由映射

`PREDEFINED_MODULES` 中：
- `finance-receivable` 的 route 为 `/finance/receivable`
- 实际应收应付页面路由为 `/finance/receivable-payable`

数据管理中的「应收应付」模块对应 `finance-receivable`，若要在应收应付页生效，需在该页接入 `useModuleConfig('finance-receivable')`。

### 2.6 建议改造方案

为使物流、应收应付、银行流水等页面应用数据管理配置：

1. **物流跟踪**：引入 `useModuleConfig('logistics')`，按 `visible` 过滤展示字段
2. **应收应付**：引入 `useModuleConfig('finance-receivable')`，若页面为卡片/列表形态，可先支持「显示」控制字段展示
3. **银行流水**：引入 `useModuleConfig('finance-cashflow')`，按配置控制字段与操作权限

---

## 三、总结

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 代码规范 | ⚠️ 需改进 | 32 个 error、91 个 warning，建议优先修复 MainLayout Hooks 与 FeishuIframe |
| 数据管理-订单 | ✅ 正常 | 已按配置控制可见列、新增、编辑 |
| 数据管理-物流 | ❌ 未接入 | 需接入 useModuleConfig('logistics') |
| 数据管理-应收应付 | ❌ 未接入 | 需接入 useModuleConfig('finance-receivable') |
| 数据管理-银行流水 | ❌ 未接入 | 需接入 useModuleConfig('finance-cashflow') |
