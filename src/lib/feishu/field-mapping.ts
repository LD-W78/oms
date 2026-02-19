/**
 * ============================================================
 * 智能字段映射系统 (Field Mapping System) - 核心重构代码
 * 
 * ⚠️ 警告：此文件处理字段名→dataKey映射，请勿直接修改
 * 
 * 允许修改的场景：
 *   - 新增字段映射规则
 *   - 调整分类优先级
 *   - 新增格式化规则
 * 
 * 禁止修改的场景：
 *   - 硬编码特定字段
 *   - 添加页面特定逻辑
 * ============================================================
 */

import type { FieldSchema } from './types'

export type FieldCategory = 'basic' | 'logistics' | 'financial' | 'product' | 'other'
export type FieldFormat = 'currency' | 'percentage' | 'date' | 'status' | 'text' | 'number' | 'rate'

export interface MappedField extends FieldSchema {
  dataKey: string
  category: FieldCategory
  format: FieldFormat
  displayName: string
  priority: number
}

export interface FieldMappingRule {
  match: {
    fieldName?: RegExp
    fieldType?: number
    uiType?: string
    property?: Record<string, unknown>
  }
  mapTo: {
    dataKey?: string
    category?: FieldCategory
    format?: FieldFormat
    priority?: number
  }
}

// 默认映射规则 - 按优先级排序
const DEFAULT_MAPPING_RULES: FieldMappingRule[] = [
  // ========== 基础字段 (高优先级) ==========
  // 订单号
  {
    match: { fieldName: /^(订单号|id|order.?id|order.?no)$/i },
    mapTo: { dataKey: 'id', category: 'basic', format: 'text', priority: 100 }
  },
  // RITOS编号
  {
    match: { fieldName: /^(RITOS|ritos|编号|no)$/i },
    mapTo: { dataKey: 'ritos', category: 'basic', format: 'text', priority: 100 }
  },
  // 客户
  {
    match: { fieldName: /^(客户|customer|client|company)$/i },
    mapTo: { dataKey: 'customer', category: 'basic', format: 'text', priority: 100 }
  },
  // 状态/进度
  {
    match: { fieldName: /^(进度|状态|status|progress)$/i, fieldType: 3 },
    mapTo: { dataKey: 'status', category: 'basic', format: 'status', priority: 95 }
  },
  // 产品
  {
    match: { fieldName: /^(产品|product|货品|goods)$/i },
    mapTo: { dataKey: 'product', category: 'product', format: 'text', priority: 95 }
  },
  // 规格
  {
    match: { fieldName: /^(详细规格|规格|spec|specification)$/i },
    mapTo: { dataKey: 'spec', category: 'product', format: 'text', priority: 90 }
  },
  // 供应商
  {
    match: { fieldName: /^(供应商|supplier|厂商|vendor)$/i },
    mapTo: { dataKey: 'supplier', category: 'basic', format: 'text', priority: 90 }
  },
  // 签约日
  {
    match: { fieldName: /^(签约日|签约日期|contract.?date|sign.?date)$/i },
    mapTo: { dataKey: 'contractDate', category: 'basic', format: 'date', priority: 90 }
  },

  // ========== 物流字段 ==========
  // 物流进度
  {
    match: { fieldName: /^(物流进度|物流状态|logistics.?progress|logistics.?status)$/i },
    mapTo: { dataKey: 'logisticsProgress', category: 'logistics', format: 'status', priority: 95 }
  },
  // 物流
  {
    match: { fieldName: /^(物流|运输|shipping|logistics)$/i },
    mapTo: { dataKey: 'logisticsProgress', category: 'logistics', format: 'status', priority: 90 }
  },
  // 提单号
  {
    match: { fieldName: /^(提单|提单号|BL|bill|bill.?of.?lading)$/i },
    mapTo: { dataKey: 'blNumber', category: 'logistics', format: 'text', priority: 90 }
  },
  // ETD
  {
    match: { fieldName: /^(ETD|预计离港|离港日期|departure.?date)$/i },
    mapTo: { dataKey: 'etd', category: 'logistics', format: 'date', priority: 90 }
  },
  // ETA
  {
    match: { fieldName: /^(ETA|预计到港|到港日期|arrival.?date)$/i },
    mapTo: { dataKey: 'eta', category: 'logistics', format: 'date', priority: 90 }
  },
  // 出发地
  {
    match: { fieldName: /^(出发地|起运港|origin|departure|from)$/i },
    mapTo: { dataKey: 'origin', category: 'logistics', format: 'text', priority: 85 }
  },
  // 目的地
  {
    match: { fieldName: /^(目的地|目的港|目的国|destination|to|country)$/i },
    mapTo: { dataKey: 'destination', category: 'logistics', format: 'text', priority: 85 }
  },
  // 货代
  {
    match: { fieldName: /^(货代|货代公司|forwarder|freight|carrier)$/i },
    mapTo: { dataKey: 'forwarder', category: 'logistics', format: 'text', priority: 85 }
  },
  // 货代杂费（费用类，归入财务信息）
  {
    match: { fieldName: /^(货代杂费|货代费用|forwarder.?fee|forwarder.?cost)$/i, fieldType: 2 },
    mapTo: { dataKey: 'forwarderFees', category: 'financial', format: 'currency', priority: 85 }
  },
  // 日期字段（通用物流日期）
  {
    match: {
      fieldName: /(日期|date|时间|time)/i,
      fieldType: 5
    },
    mapTo: { category: 'logistics', format: 'date', priority: 70 }
  },

  // ========== 财务字段 ==========
  // 报价类型
  {
    match: { fieldName: /^(报价类型|quote.?type|quotation.?type)$/i },
    mapTo: { dataKey: 'quoteType', category: 'financial', format: 'text', priority: 90 }
  },
  // MTs
  {
    match: { fieldName: /^(MTs|mts|数量|quantity|amount.?mt)$/i, fieldType: 2 },
    mapTo: { dataKey: 'mts', category: 'product', format: 'number', priority: 85 }
  },
  // 货币/币种
  {
    match: { fieldName: /^(货币|币种|currency|money.?type)$/i },
    mapTo: { dataKey: 'currency', category: 'financial', format: 'text', priority: 90 }
  },
  // 汇率（数字保留 2 位小数）
  {
    match: { fieldName: /^(汇率|exchange.?rate)$/i },
    mapTo: { dataKey: 'exchangeRate', category: 'financial', format: 'rate', priority: 85 }
  },
  // 单价
  {
    match: { fieldName: /^(单价|unit.?price|price.?unit)$/i, fieldType: 2 },
    mapTo: { dataKey: 'unitPrice', category: 'financial', format: 'currency', priority: 85 }
  },
  // 订单金额
  {
    match: { fieldName: /^(订单金额|amount|order.?amount|total.?amount)$/i, fieldType: 2 },
    mapTo: { dataKey: 'amount', category: 'financial', format: 'currency', priority: 90 }
  },
  // 订单金额CNY
  {
    match: { fieldName: /^(订单金额CNY|amountCNY|amount.?cny|cny.?amount)$/i, fieldType: 2 },
    mapTo: { dataKey: 'amountCNY', category: 'financial', format: 'currency', priority: 90 }
  },
  // 应收款额
  {
    match: { fieldName: /^(应收款额|应收|应收款|receivable)$/i, fieldType: 2 },
    mapTo: { dataKey: 'receivable', category: 'financial', format: 'currency', priority: 90 }
  },
  // 累计回款
  {
    match: { fieldName: /^(累计回款|已收|已收款|received)$/i, fieldType: 2 },
    mapTo: { dataKey: 'received', category: 'financial', format: 'currency', priority: 90 }
  },
  // 毛利
  {
    match: { fieldName: /^(毛利|gross.?profit|profit)$/i, fieldType: 2 },
    mapTo: { dataKey: 'grossProfit', category: 'financial', format: 'currency', priority: 85 }
  },
  // 毛利率
  {
    match: { fieldName: /^(毛利率|gross.?profit.?rate|profit.?rate|margin)$/i, fieldType: 2 },
    mapTo: { dataKey: 'grossProfitRate', category: 'financial', format: 'percentage', priority: 85 }
  },
  // 开票税率（不限制 fieldType，公式/数字都按百分比）
  {
    match: { fieldName: /^(开票税率|tax.?rate|invoice.?rate)$/i },
    mapTo: { dataKey: 'invoiceTaxRate', category: 'financial', format: 'percentage', priority: 80 }
  },
  // 退税
  {
    match: { fieldName: /^(退税|tax.?refund|refund)$/i, fieldType: 2 },
    mapTo: { dataKey: 'taxRefund', category: 'financial', format: 'currency', priority: 85 }
  },
  // 退税额
  {
    match: { fieldName: /^(退税额|退税金额|tax.?refund.?amount|refund.?amount)$/i, fieldType: 2 },
    mapTo: { dataKey: 'taxRefundAmount', category: 'financial', format: 'currency', priority: 85 }
  },
  // 采购成本
  {
    match: { fieldName: /^(采购成本|purchase.?cost|cost|采购价)$/i, fieldType: 2 },
    mapTo: { dataKey: 'purchaseCost', category: 'financial', format: 'currency', priority: 85 }
  },
  // 税费
  {
    match: { fieldName: /^(税费|tax|taxes|duty)$/i, fieldType: 2 },
    mapTo: { dataKey: 'tax', category: 'financial', format: 'currency', priority: 80 }
  },
  // 海运及保险
  {
    match: { fieldName: /^(海运|海运及保险|shipping|insurance|freight)$/i, fieldType: 2 },
    mapTo: { dataKey: 'shippingInsurance', category: 'financial', format: 'currency', priority: 80 }
  },
  // 其他费用
  {
    match: { fieldName: /^(其他费用|other.?fee|other.?cost|misc)$/i, fieldType: 2 },
    mapTo: { dataKey: 'otherFees', category: 'financial', format: 'currency', priority: 75 }
  },
  // 付款类型
  {
    match: { fieldName: /^(付款|付款类型|payment|payment.?type)$/i },
    mapTo: { dataKey: 'paymentType', category: 'financial', format: 'text', priority: 80 }
  },
  // 付款状态（优先于通用状态规则，归入财务）
  {
    match: { fieldName: /^(付款[：:]?状态|payment.?status|paymentStatus)$/i },
    mapTo: { dataKey: 'paymentStatus', category: 'financial', format: 'status', priority: 85 }
  },
  // 更新日期
  {
    match: { fieldName: /^(UpdateDate|updateate|update.?date|更新日期|更新时间)$/i },
    mapTo: { dataKey: 'updateDate', category: 'basic', format: 'date', priority: 70 }
  },

  // ========== 通用规则（低优先级，兜底） ==========
  // 金额字段（通用）
  {
    match: {
      fieldName: /(金额|amount|price|cost|fee|费用)/i,
      fieldType: 2
    },
    mapTo: { format: 'currency', category: 'financial', priority: 60 }
  },
  // 百分比字段（通用）
  {
    match: {
      fieldName: /(率|rate|percent|percentage)/i,
      fieldType: 2
    },
    mapTo: { format: 'percentage', category: 'financial', priority: 60 }
  },
  // 日期字段（通用）
  {
    match: {
      fieldName: /(日期|date|时间|time)/i,
      fieldType: 5
    },
    mapTo: { format: 'date', category: 'basic', priority: 50 }
  },
  // 状态字段（通用）
  {
    match: {
      fieldName: /(状态|status|进度|progress)/i,
      fieldType: 3
    },
    mapTo: { format: 'status', category: 'basic', priority: 60 }
  }
]

/**
 * 检查字段是否匹配规则
 */
function matchesRule(field: FieldSchema, rule: FieldMappingRule): boolean {
  const { match } = rule

  // 匹配字段名
  if (match.fieldName && !match.fieldName.test(field.fieldName)) {
    return false
  }

  // 匹配字段类型
  if (match.fieldType !== undefined && field.fieldType !== match.fieldType) {
    return false
  }

  // 匹配UI类型
  if (match.uiType && field.uiType !== match.uiType) {
    return false
  }

  // 匹配属性
  if (match.property) {
    for (const [key, value] of Object.entries(match.property)) {
      if (field.property?.[key] !== value) {
        return false
      }
    }
  }

  return true
}

/**
 * 自动推断dataKey（驼峰转换）
 * 将字段名转换为驼峰格式的dataKey
 * 
 * 示例:
 * - "订单号" -> "订单号" (保留中文)
 * - "Order Number" -> "orderNumber"
 * - "order_number" -> "orderNumber"
 * - "Order:ID" -> "orderId"
 */
export function generateDataKey(fieldName: string): string {
  // 如果字段名主要是中文，直接返回（保留中文key）
  const chineseCharCount = (fieldName.match(/[\u4e00-\u9fa5]/g) || []).length
  const totalCharCount = fieldName.replace(/\s/g, '').length
  
  if (chineseCharCount > totalCharCount * 0.5) {
    // 主要是中文，移除特殊字符后返回
    return fieldName.replace(/[:：]/g, '').trim()
  }

  // 英文/混合字段名，转换为驼峰格式
  return fieldName
    .replace(/[：:]/g, ' ')
    .split(/[\s_\-]+/)
    .map((word, i) => {
      if (i === 0) {
        return word.toLowerCase()
      }
      // 保留全大写的缩写（如ID、CNY）
      if (word.length > 1 && word === word.toUpperCase()) {
        return word
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

/**
 * 根据字段类型推断格式
 */
function inferFormatFromType(fieldType: number, fieldName: string): FieldFormat {
  // 先判「率」类（毛利率、开票税率等），避免被后面的「毛利」判成 currency
  if (/^(率|rate|percent)/i.test(fieldName) || fieldName.includes('率')) {
    return 'percentage'
  }
  if (/^(汇率|exchange.?rate)$/i.test(fieldName)) {
    return 'rate'
  }
  // 根据字段名特征推断（含订单金额CNY、货代杂费、海运及保险、其他费用等；不含毛利率等已在上方按「率」处理）
  if (/(订单金额|单价|金额|amount|price|cost|fee|毛利|退税|费用|杂费|保险|采购成本|税费|海运)/i.test(fieldName)) {
    return 'currency'
  }
  if (/^(签约日|签约日期|日期|date|时间|time|ETD|ETA|UpdateDate|update)/i.test(fieldName)) {
    return 'date'
  }
  if (/^(状态|进度|status|progress)/i.test(fieldName)) {
    return 'status'
  }

  // 根据字段类型推断
  switch (fieldType) {
    case 2: // 数字
      return 'number'
    case 3: // 单选
      return 'status'
    case 5: // 日期
      return 'date'
    default:
      return 'text'
  }
}

/**
 * 根据字段名推断分类
 */
function inferCategory(fieldName: string, format: FieldFormat): FieldCategory {
  // 物流相关
  if (/^(物流|运输|货代|提单|ETD|ETA|出发地|目的地|离港|到港|departure|arrival|forwarder|shipping|logistics)/i.test(fieldName)) {
    return 'logistics'
  }
  
  // 财务相关
  if (/^(金额|价格|成本|毛利|汇率|退税|税费|费用|付款|invoice|payment|tax|cost|price|amount|rate|fee)/i.test(fieldName)) {
    return 'financial'
  }
  
  // 产品相关
  if (/^(产品|规格|MTs|数量|product|spec|quantity)/i.test(fieldName)) {
    return 'product'
  }
  
  return 'basic'
}

/**
 * 应用字段映射规则
 * 将飞书字段Schema映射为带元数据的字段
 * 
 * @param field - 飞书字段Schema
 * @returns 映射后的字段，包含dataKey、category、format等元数据
 */
export function applyFieldMapping(field: FieldSchema): MappedField {
  // 1. 查找所有匹配的规则
  const matchingRules = DEFAULT_MAPPING_RULES.filter(rule => matchesRule(field, rule))
  
  // 2. 按优先级排序，取最高优先级的规则
  const bestRule = matchingRules.length > 0
    ? matchingRules.reduce((best, current) => 
        (current.mapTo.priority || 0) > (best.mapTo.priority || 0) ? current : best
      )
    : null
  
  // 3. 生成或获取dataKey
  const dataKey = bestRule?.mapTo.dataKey || generateDataKey(field.fieldName)
  
  // 4. 推断格式
  const format = bestRule?.mapTo.format || inferFormatFromType(field.fieldType, field.fieldName)
  
  // 5. 确定分类
  const category = bestRule?.mapTo.category || inferCategory(field.fieldName, format)
  
  // 6. 确定优先级
  const priority = bestRule?.mapTo.priority || 0

  return {
    ...field,
    dataKey,
    category,
    format,
    displayName: field.fieldName,
    priority
  }
}

/**
 * 批量应用字段映射
 */
export function applyFieldMappingBatch(fields: FieldSchema[]): MappedField[] {
  return fields.map(field => applyFieldMapping(field))
}

/**
 * 按分类分组字段
 */
export function categorizeFields(fields: MappedField[]): Record<FieldCategory, MappedField[]> {
  const categories: Record<FieldCategory, MappedField[]> = {
    basic: [],
    logistics: [],
    financial: [],
    product: [],
    other: []
  }

  fields.forEach(field => {
    const category = field.category
    if (!categories[category]) {
      categories.other.push(field)
    } else {
      categories[category].push(field)
    }
  })

  // 每个分类内按优先级排序
  Object.keys(categories).forEach(key => {
    const category = key as FieldCategory
    categories[category].sort((a, b) => b.priority - a.priority)
  })

  return categories
}

/**
 * 获取字段映射统计信息
 */
export function getMappingStats(fields: FieldSchema[]): {
  total: number
  mapped: number
  autoGenerated: number
  byCategory: Record<FieldCategory, number>
} {
  const mappedFields = applyFieldMappingBatch(fields)
  const total = fields.length
  const mapped = mappedFields.filter(f => f.priority >= 50).length
  const autoGenerated = total - mapped

  const byCategory: Record<FieldCategory, number> = {
    basic: 0,
    logistics: 0,
    financial: 0,
    product: 0,
    other: 0
  }

  mappedFields.forEach(field => {
    byCategory[field.category]++
  })

  return {
    total,
    mapped,
    autoGenerated,
    byCategory
  }
}

/**
 * 创建自定义映射规则
 * 用于扩展默认规则或覆盖特定字段的映射
 */
export function createCustomRule(
  pattern: string | RegExp,
  mapping: Partial<Pick<MappedField, 'dataKey' | 'category' | 'format'>>,
  priority: number = 100
): FieldMappingRule {
  const fieldName = typeof pattern === 'string' 
    ? new RegExp(`^${pattern}$`, 'i')
    : pattern

  return {
    match: { fieldName },
    mapTo: {
      dataKey: mapping.dataKey,
      category: mapping.category,
      format: mapping.format,
      priority
    }
  }
}
