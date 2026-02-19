# OMS 项目变更记录

> 记录用户在会话中提出的所有需求变更

---

## 2026-02-12 动态字段配置系统

### 新增功能

#### useTableConfig Hook

提供表格配置管理功能，支持：
- 从 API 加载表格配置
- 本地 localStorage 持久化
- 配置变更自动保存
- 默认配置回退机制

```typescript
const { config, loading, saveFieldConfig, toggleFieldVisibility } = useTableConfig('/orders')
```

#### useDynamicColumns Hook

动态生成 Ant Design Table 列配置：
- 根据字段配置自动生成列
- 支持排序、筛选功能
- 支持自定义渲染器
- 动态固定列

```typescript
const { buildColumns } = useDynamicColumns({
  additionalRenderers: {
    id: (value) => <a>{value}</a>,
    status: (value) => <Tag>{value}</Tag>,
  },
})
const columns = buildColumns(fields)
```

#### 默认字段配置

| 字段 | 标签 | 宽度 | 可见 | 可排序 | 可筛选 | 类型 |
|------|------|------|------|--------|--------|------|
| id | 订单号 | 220 | ✅ | ✅ | ❌ | text |
| customer | 客户 | 150 | ✅ | ✅ | ❌ | customer |
| product | 产品 | 180 | ✅ | ✅ | ❌ | product |
| mts | 数量(MTS) | 100 | ✅ | ✅ | ❌ | text |
| amount | 订单金额 | 120 | ✅ | ✅ | ❌ | currency |
| contractDate | 签约日期 | 120 | ✅ | ✅ | ✅ | date |
| status | 商务进度 | 100 | ✅ | ✅ | ✅ | select |

### 状态卡片统计修复

修复了状态卡片显示"0"的问题：
- 在 `getOrderStats` 函数中添加 per-status 计数
- 移除硬编码的静态数据
- 实时从 API 统计数据动态生成卡片

```typescript
// 修复前 - 只计算总数
stats.all.count++

// 修复后 - 同时计算各状态计数
stats.all.count++
if (stats[order.status]) {
  stats[order.status].count++
}
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `src/lib/feishu/orders.ts` | 添加 per-status 计数逻辑 |
| `src/app/orders/page.tsx` | 使用动态配置替代硬编码 |
| `src/app/hooks/useTableConfig.ts` | 新增配置管理 Hook |
| `src/app/hooks/useDynamicColumns.ts` | 新增列生成 Hook |

---

## 2024-02-11 物流跟踪页面优化

### 状态标签改进

| 修改项 | 原效果 | 新效果 |
|--------|--------|--------|
| 布局 | Ant Design Tabs 组件 | 自定义 div，flex: 1 充满区域 |
| 边框 | 无边框设计 | 底部 2px 边框指示器 |
| 点击效果 | 简单切换 | 再次点击取消选中 |
| 背景色 | 默认背景 | 选中时蓝色背景 #f0f7ff |

### 状态统计卡片

| 卡片 | 统计项 | 描述 |
|------|--------|------|
| 在途订单总数 | 7 | 点击查看全部 |
| 即将到港 | 0 | 未来7天内到港 |
| 延误预警 | 6 | 需要立即关注 |
| 清关处理中 | 5 | 已发货未发船 |

---

## 2024-02-11 飞书 URL 配置优化

### 环境变量更新

从构造 URL 方式改为使用专用 URL 变量：

| 变量名 | 用途 |
|--------|------|
| NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL | 客户管理页面 iframe URL |
| NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL | 供应商管理页面 iframe URL |
| NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL | 产品管理页面 iframe URL |

### 配置示例 (.env.local)

```bash
NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL=https://bj-ritos.feishu.cn/share/base/view/shrcnExBw0R4bj9N55wq0KYZ7tf
NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL=https://bj-ritos.feishu.cn/share/base/view/shrcnZnSVXjiwbEBTKm5n5HfzUb
NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS_URL=https://bj-ritos.feishu.cn/share/base/view/shrcnu2qkBSYNXRDVgppUAIdMqJ
```

---

## 2024-02-11 订单管理页面优化

### 订单状态标签卡

| 修改项 | 原效果 | 新效果 |
|--------|--------|--------|
| 布局 | Card 组件，有圆角和阴影 | 自定义 div，flex: 1 充满区域 |
| 边框 | 四周 2px 边框 | 底部 2px 边框指示器 |
| 点击效果 | 简单切换 | 再次点击取消选中 |
| 间隙 | gap: 12px | gap: 0 无缝连接 |

### 订单表格增强

| 功能 | 说明 |
|------|------|
| 字段排序 | 订单号、客户、产品、金额、签约日期支持点击排序 |
| 状态筛选 | 状态列支持下拉筛选（签约中/已签约/已收款/已结款/待退税/已退税） |
| 左右滚动 | scroll={{ x: 1200 }} 启用横向滚动 |
| 固定操作列 | fixed: 'right' 操作列固定右侧 |

---

## 2024-02-11 iframe 页面布局修复

### 问题描述

飞书 iframe 内容显示异常（组件重叠、文字错位），原因是：
1. 外部 CSS 样式与飞书内部样式冲突
2. 容器尺寸计算错误
3. iframe 周围有多余的边框和 padding

### 解决方案

#### FeishuIframe 组件简化

```typescript
// 简化后的核心结构
<div style={{ height, width: '100%', position: 'relative', background: '#fff' }}>
  <iframe
    src={currentSrc}
    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    frameBorder={0}
    allowFullScreen
  />
</div>
```

#### MainLayout Content 区域优化

```typescript
<Content
  style={{
    background: '#f5f5f7',
    padding: 0,
    margin: 0,
    flex: 'auto',
    height: 'calc(100vh - 56px)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }}
>
```

#### 页面容器简化

```typescript
// 订单管理、客户管理、供应商管理、产品管理、仪表盘页面
<div style={{ height: '100%', width: '100%', background: '#fff' }}>
  <FeishuIframe src={feishuUrl} title="页面标题" />
</div>
```

### 环境变量配置

| 变量名 | 用途 |
|--------|------|
| NEXT_PUBLIC_FEISHU_DASHBOARD_URL | 仪表盘飞书数据驾驶舱URL |
| NEXT_PUBLIC_FEISHU_BASE_URL | 飞书域名 (https://bj-ritos.feishu.cn) |
| NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS | 客户表ID |
| NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS | 供应商表ID |
| NEXT_PUBLIC_FEISHU_TABLE_PRODUCTS | 产品表ID |

### 已修复的页面

| 页面 | 状态 |
|------|------|
| 仪表盘 | ✅ 已修复 |
| 客户管理 | ✅ 已修复 |
| 供应商管理 | ✅ 已修复 |
| 产品管理 | ✅ 已修复 |

### 已知问题

**Safari Cookie 错误**
```
ERROR: Not allowed to get config "ccm_bitable_bas..."
    at https://bj-ritos.feishu.cn/...
```

这是飞书服务端的跨域 cookie 配置问题，非代码问题。解决方案：
1. 飞书服务端需设置 `SameSite=None; Secure` cookie
2. 或 Safari 设置中关闭"阻止跨站跟踪"
3. 使用飞书公开分享链接（无需登录认证）

---

## 2024-02-11 技术变更

### 环境变量迁移

| 原变量名 | 新变量名 |
|----------|----------|
| FEISHU_APP_ID | NEXT_PUBLIC_FEISHU_APP_ID |
| FEISHU_APP_SECRET | NEXT_PUBLIC_FEISHU_APP_SECRET |
| FEISHU_BASE_APP_TOKEN | NEXT_PUBLIC_FEISHU_APP_TOKEN |
| FEISHU_SALES_DASHBOARD_URL | NEXT_PUBLIC_FEISHU_DASHBOARD_URL |
| FEISHU_TABLE_XXX | NEXT_PUBLIC_FEISHU_TABLE_XXX |

> 注：需添加 `NEXT_PUBLIC_` 前缀以支持客户端访问

### 新增配置项

| 变量名 | 用途 | 默认值 |
|--------|------|--------|
| NEXT_PUBLIC_FEISHU_BASE_URL | 飞书域名 | https://open.feishu.cn |

---

## 设计规范

### 颜色系统

| 用途 | 颜色值 |
|------|--------|
| 主色 | #1976d2 |
| 主色hover | #1565c0 |
| 页面背景 | #f5f5f7 |
| 侧边栏背景 | #ffffff |
| 主要文字 | #111827 |
| 次要文字 | #6b7280 |
| 边框颜色 | #e5e7eb |

### 布局尺寸

| 元素 | 尺寸 |
|------|------|
| 侧边栏宽度 | 240px |
| 头部高度 | 56px |
| 菜单项高度 | 40px |
| 圆角 | 8px |

### 图标系统

使用 Heroicons 风格SVG图标：
- 仪表盘：grid布局图标
- 订单管理：购物车图标
- 客户管理：用户组图标
- 供应商管理：房屋图标
- 产品管理：方块图标
- 报价核算：表格图标
- 物流跟踪：卡车图标
- 系统管理：齿轮图标
- 财务管理：图表图标

---

## 待确认事项

1. ✅ 仪表盘/客户/供应商/产品页面：右侧全屏iframe
2. ✅ 白色侧边栏 + 灰色图标
3. ✅ 移除飞书表格菜单
4. ✅ 订单管理页面优化（状态标签、表格排序滚动）
5. ✅ 物流跟踪页面设计
6. ✅ 系统管理页面设计
7. ⏳ 飞书 iframe Safari Cookie 问题（需飞书服务端配合）
8. ✅ 动态字段配置系统

---

## 后续任务

1. ⏳ Safari Cookie 问题跟进（需飞书配合）
2. ⏳ 生产环境部署测试
3. ⏳ 完善系统管理-数据配置页面功能

---

*文档创建时间：2024-02-11*
*最后更新：2026-02-12*