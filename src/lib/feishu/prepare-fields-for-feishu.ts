/**
 * 按数据册（schema）的飞书字段类型，将前端提交的 fields 转为飞书写入 API 所需格式。
 * 供创建订单（POST）、更新订单（PUT）共用，保证一致转换。
 *
 * 核心原则（与飞书官方 node-sdk 示例一致）：
 * 1. 数字字段 → number 类型（示例：工时 10、评分 3、货币 3、进度 0.25），移除千分位分隔符
 * 2. 日期字段 → 毫秒时间戳 number（示例：日期 1674206443000），不是字符串
 * 3. 超链接 → 不提交（type 15 易报 LinkFieldConvFail）；若需提交格式为 { text, link } 对象
 *
 * 参考：open.feishu.cn 多维表格「新增记录」API 调试台 / node-sdk 示例
 * - client.bitable.v1.appTableRecord.create({ data: { fields: { 日期: 1674206443000, 工时: 10, ... } } })
 */

export interface SchemaField {
  fieldId: string
  fieldName: string
  fieldType: number
}

export interface SchemaLike {
  fields: SchemaField[]
}

/** 允许写入的字段类型（白名单）。链接(15) 不提交：飞书易报 LinkFieldConvFail。数字(2)=number 去千分位，日期(5)=毫秒时间戳 number */
const UPDATABLE_FIELD_TYPES = [1, 2, 3, 4, 5, 7] as const

/** 飞书公式字段类型（不提交） */
const FORMULA_FIELD_TYPES = [20, 21]

/** 按字段名识别的公式字段（与订单页 isFormulaField 一致，不提交） */
const FORMULA_FIELD_NAME_PATTERNS = [
  /^(订单金额CNY|订单金额.*CNY)$/i,
  /^(毛利|gross.?profit)$/i,
  /^(毛利率|gross.?profit.?rate|profit.?rate)$/i,
  /^(退税额|退税金额|tax.?refund.?amount)$/i,
  /^(税费|tax|taxes|duty)$/i,
]

function isFormulaFieldByName(fieldName: string): boolean {
  const name = fieldName.trim()
  return FORMULA_FIELD_NAME_PATTERNS.some((p) => p.test(name))
}

/** 移除公式字段：按 fieldType 20/21 及按字段名（订单金额CNY/毛利/毛利率/退税额/税费），不提交 */
function stripFormulaFields(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const nameToMeta = new Map(schema.fields.map((f) => [f.fieldName, f]))
  const out = { ...fields }
  for (const [name] of Object.entries(out)) {
    const t = nameToType.get(name)
    if (t != null && FORMULA_FIELD_TYPES.includes(t)) {
      delete out[name]
      continue
    }
    const meta = nameToMeta.get(name)
    if (meta && isFormulaFieldByName(meta.fieldName)) delete out[name]
  }
  return out
}

/** 将 fieldId 键转为 fieldName 键 */
function mapToFieldNames(
  body: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return body
  const byId = new Map(schema.fields.map((f) => [f.fieldId, f.fieldName]))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    const name = byId.get(key) ?? key
    out[name] = value
  }
  return out
}

/** 移除“链接形状”的字段值（含 link/text 的对象），避免在 schema 为空时仍提交导致 LinkFieldConvFail */
function stripLinkShapedFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>
      if ('link' in obj || 'text' in obj) delete out[name]
    }
  }
  return out
}

/** 只保留可更新类型的字段 */
function allowOnlyUpdatable(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name] of Object.entries(out)) {
    const t = nameToType.get(name)
    if (t == null || !UPDATABLE_FIELD_TYPES.includes(t as (typeof UPDATABLE_FIELD_TYPES)[number])) delete out[name]
  }
  return out
}

/** 数字(2)：必须为 number 类型，移除千分位分隔符；空/NaN/Infinity 不提交 */
function convertNumber(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 2) continue
    if (value == null || value === '') {
      delete out[name]
      continue
    }
    let num: number | null = null
    if (typeof value === 'number' && Number.isFinite(value)) num = value
    else if (typeof value === 'string') {
      const t = value.trim().replace(/,/g, '').replace(/\s/g, '').replace(/%/g, '')
      if (t === '') {
        delete out[name]
        continue
      }
      num = Number(t)
    }
    if (num != null && Number.isFinite(num) && !Number.isNaN(num)) out[name] = num
    else delete out[name]
  }
  return out
}

/** 飞书百分比数字字段存为小数（1% = 0.01）。用户输入 1 表示 1%、13 表示 13%，写入前转为 0.01、0.13 */
const PERCENTAGE_NUMBER_FIELD_NAMES = /^(开票税率|税率|tax.?rate|invoice.?rate)$/i

function convertPercentageNumber(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 2) continue
    if (!PERCENTAGE_NUMBER_FIELD_NAMES.test(name)) continue
    if (value == null || typeof value !== 'number' || !Number.isFinite(value)) continue
    const num = value as number
    if (num >= 1 && num <= 100) out[name] = num / 100
  }
  return out
}

/** 日期(5)：必须是毫秒时间戳 number，不是字符串 */
function convertDate(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 5) continue
    if (value == null || value === '') {
      delete out[name]
      continue
    }
    let ms: number | null = null
    if (typeof value === 'number' && Number.isFinite(value)) ms = value > 1e12 ? value : value * 1000
    else if (typeof value === 'string') {
      const p = Date.parse(value)
      if (!Number.isNaN(p)) ms = p
    } else if (typeof value === 'object' && value !== null && 'valueOf' in value && typeof (value as { valueOf: () => unknown }).valueOf === 'function') {
      const v = (value as { valueOf: () => number }).valueOf()
      if (Number.isFinite(v)) ms = v
    }
    if (ms != null && Number.isFinite(ms)) {
      const d = new Date(ms)
      if (!Number.isNaN(d.getTime())) out[name] = ms
      else delete out[name]
    } else delete out[name]
  }
  return out
}

/** 勾选(7)：转为 boolean */
function convertCheckbox(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 7) continue
    if (value == null || value === '') {
      delete out[name]
      continue
    }
    if (typeof value === 'boolean') continue
    if (value === true || value === '是' || value === 'true' || value === 1) out[name] = true
    else if (value === false || value === '否' || value === 'false' || value === 0) out[name] = false
    else delete out[name]
  }
  return out
}

/** 链接(15)：转为 URL 字符串，空或非法则不提交 */
function convertLink(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 15) continue
    if (value == null || value === '') {
      delete out[name]
      continue
    }
    if (Array.isArray(value)) {
      delete out[name]
      continue
    }
    if (typeof value === 'string') {
      const s = value.trim()
      if (!s) delete out[name]
      else out[name] = s
      continue
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>
      if (Array.isArray(obj.link_record_ids) || 'link_record_ids' in obj) {
        delete out[name]
        continue
      }
      const link = obj.link != null ? String(obj.link).trim() : ''
      const text = (obj.text != null ? String(obj.text).trim() : '') || link
      const url = link || text
      if (!url) delete out[name]
      else out[name] = url
      continue
    }
    delete out[name]
  }
  return out
}

/** 多选(4)：确保为 string[]，飞书要求数组 */
function convertMultiSelect(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    if (nameToType.get(name) !== 4) continue
    if (value == null || value === '') {
      delete out[name]
      continue
    }
    if (Array.isArray(value)) {
      out[name] = value.map((v) => (typeof v === 'string' ? v : String(v)))
      continue
    }
    if (typeof value === 'string') {
      const t = value.trim()
      if (!t) delete out[name]
      else out[name] = [t]
      continue
    }
    delete out[name]
  }
  return out
}

/** 单选(3)、文本(1)：确保字符串，空串可不提交或保留（按需） */
function convertTextAndSingleSelect(
  fields: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  if (!schema?.fields?.length) return fields
  const nameToType = new Map(schema.fields.map((f) => [f.fieldName, f.fieldType]))
  const out = { ...fields }
  for (const [name, value] of Object.entries(out)) {
    const t = nameToType.get(name)
    if (t !== 1 && t !== 3) continue
    if (value == null) {
      delete out[name]
      continue
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      delete out[name]
      continue
    }
    out[name] = typeof value === 'string' ? value : String(value)
  }
  return out
}

/**
 * 按 schema 将前端提交的 fields 转为飞书写入格式。
 * @param body 前端提交的字段（key 可为 fieldId 或 fieldName，建议 fieldId）
 * @param schema 数据册（从 getTableSchema / syncTableSchema 获取）
 * @returns 以 fieldName 为 key、已按类型转换的 fields，可直接传给 createRecord / updateRecord
 */
export function prepareFieldsForFeishu(
  body: Record<string, unknown>,
  schema: SchemaLike | null
): Record<string, unknown> {
  let out = mapToFieldNames(body, schema)
  out = stripLinkShapedFields(out)
  out = stripFormulaFields(out, schema)
  out = allowOnlyUpdatable(out, schema)
  out = convertNumber(out, schema)
  out = convertPercentageNumber(out, schema)
  out = convertDate(out, schema)
  out = convertCheckbox(out, schema)
  out = convertLink(out, schema)
  out = convertMultiSelect(out, schema)
  out = convertTextAndSingleSelect(out, schema)
  return out
}
