/**
 * 服务端统一表数据层：按 tableId 拉取飞书表并格式化为 TableRecord[]
 * 供 /api/table 及 useTableData 使用，保证字段一致、格式一致
 */

import { feishuClient } from './client'
import { getTableSchema, syncTableSchema } from './schema'
import {
  applyFieldMappingBatch,
  type MappedField,
  type FieldCategory,
  type FieldFormat,
} from './field-mapping'
import { getFieldAdapter } from './field-adapters'
import { isFormulaValue, parseFormulaValue } from './formula-parser'
import type { TableSchema } from './types'
import { TABLE_IDS } from '@/lib/config/env'

export interface ProcessedField {
  raw: unknown
  parsed: unknown
  formatted: string
  meta: MappedField | null
  isFormula: boolean
  isEmpty: boolean
}

export interface TableRecord {
  recordId: string
  fields: Record<string, ProcessedField>
  raw: Record<string, unknown>
}

function formatCurrency(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '-'
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercentage(value: unknown): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (isNaN(num)) return '-'
  if (num > 1) return `${num.toFixed(2)}%`
  return `${(num * 100).toFixed(2)}%`
}

function formatRate(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-'
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  if (Number.isNaN(num)) return '-'
  return num.toFixed(2)
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (value === '') return '-'
  let date: Date
  try {
    if (typeof value === 'number') {
      date = new Date(value)
    } else {
      const str = String(value).trim()
      if (/^\d{10,15}$/.test(str)) {
        date = new Date(Number(str))
      } else {
        date = new Date(str)
      }
    }
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString('zh-CN')
  } catch {
    // ignore
  }
  return String(value)
}

function inferFormulaComputedValue(
  value: unknown,
  format?: FieldFormat
): ProcessedField | null {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!isNaN(num) && typeof value !== 'boolean') {
    const formatted =
      format === 'currency'
        ? formatCurrency(num)
        : format === 'percentage'
          ? formatPercentage(num)
          : format === 'rate'
            ? formatRate(num)
            : num.toLocaleString('zh-CN')
    return {
      raw: value,
      parsed: num,
      formatted,
      meta: null,
      isFormula: true,
      isEmpty: false,
    }
  }
  if (typeof value === 'string' && (value.includes('-') || value.includes('/'))) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return {
        raw: value,
        parsed: date,
        formatted: format === 'date' ? formatDate(date) : date.toLocaleDateString('zh-CN'),
        meta: null,
        isFormula: true,
        isEmpty: false,
      }
    }
  }
  return null
}

function processFieldValue(value: unknown, field: MappedField): ProcessedField {
  if (isFormulaValue(value)) {
    const parsed = parseFormulaValue(value)
    let formatted = parsed.formatted
    if (field.format === 'currency') formatted = formatCurrency(parsed.parsed)
    else if (field.format === 'percentage') formatted = formatPercentage(parsed.parsed)
    else if (field.format === 'date') formatted = formatDate(parsed.parsed)
    else if (field.format === 'rate') formatted = formatRate(parsed.parsed)
    return {
      raw: value,
      parsed: parsed.parsed,
      formatted,
      meta: field,
      isFormula: true,
      isEmpty: parsed.isEmpty,
    }
  }
  if (field.fieldType === 20 || field.fieldType === 21) {
    const inferred = inferFormulaComputedValue(value, field.format)
    if (inferred) return inferred
  }
  const adapter = getFieldAdapter(field.fieldType)
  const parsed = adapter.parse(value)
  let formatted: string
  switch (field.format) {
    case 'currency': {
      const num = typeof parsed === 'number' ? parsed : parseFloat(String(parsed))
      formatted = Number.isFinite(num) && !Number.isNaN(num) ? formatCurrency(parsed) : adapter.format(parsed)
      break
    }
    case 'percentage':
      formatted = formatPercentage(parsed)
      break
    case 'date':
      formatted = formatDate(parsed)
      break
    case 'rate':
      formatted = formatRate(parsed)
      break
    default: {
      const name = (field.fieldName || '') + (field.fieldId || '')
      const isDateLike =
        /签约日|ETD|ETA|UpdateDate|updateate|更新日期|日期|date|时间|time/i.test(name)
      const valueLooksLikeDate =
        typeof parsed === 'number' ||
        (typeof parsed === 'object' && parsed instanceof Date) ||
        (typeof parsed === 'string' && (/\d{4}-\d{2}-\d{2}/.test(parsed) || /^\d{10,15}$/.test(parsed)))
      if (isDateLike && valueLooksLikeDate) {
        formatted = formatDate(parsed)
      } else {
        formatted = adapter.format(parsed)
      }
      break
    }
  }
  return {
    raw: value,
    parsed,
    formatted,
    meta: field,
    isFormula: false,
    isEmpty: adapter.isEmpty(parsed),
  }
}

function processRecord(
  rawRow: Record<string, unknown>,
  mappedFields: MappedField[]
): TableRecord {
  const fields: Record<string, ProcessedField> = {}
  const recordId = String(rawRow.recordId ?? rawRow.record_id ?? '')
  mappedFields.forEach((fieldMeta) => {
    const rawValue =
      rawRow[fieldMeta.dataKey] ??
      rawRow[fieldMeta.fieldName] ??
      (fieldMeta.fieldId ? rawRow[fieldMeta.fieldId] : undefined)
    const key = fieldMeta.fieldId || fieldMeta.dataKey
    fields[key] = processFieldValue(rawValue, fieldMeta)
  })
  return {
    recordId,
    fields,
    raw: rawRow,
  }
}

export interface GetTableDataResult {
  schema: TableSchema | null
  records: TableRecord[]
}

/**
 * 按 tableId 获取表 schema + 已格式化的 records，统一数据层出口
 * 飞书不可用或报错时返回空数据，避免 500 导致页面崩溃
 *
 * 性能优化：优先使用文件缓存的 schema（免飞书 API），与 records 并行请求
 * 仅当缓存未命中时才 syncTableSchema
 */
export async function getTableData(tableId: string): Promise<GetTableDataResult> {
  if (!tableId?.trim()) {
    return { schema: null, records: [] }
  }
  try {
    // 1. 优先从缓存获取 schema（无网络请求），与 records 并行
    let schema: TableSchema | null = (await getTableSchema(tableId)) ?? null
    if (!schema) {
      try {
        schema = await syncTableSchema(tableId)
      } catch {
        try {
          await new Promise((r) => setTimeout(r, 200))
          schema = await syncTableSchema(tableId)
        } catch {
          return { schema: null, records: [] }
        }
      }
    }
    if (!schema) return { schema: null, records: [] }

    // 2. 并行获取 records（schema 已有，无需等待）
    const result = await feishuClient.getRecords(tableId, { pageSize: 500 })
    const items = result.items || []
    const mappedFields = applyFieldMappingBatch(schema.fields)
    const rawRows = items.map((r) => ({
      ...(r.fields || {}),
      recordId: r.record_id,
      record_id: r.record_id,
    }))
    const records = rawRows.map((row) => processRecord(row, mappedFields))
    return { schema, records }
  } catch (err) {
    console.error('[getTableData]', tableId, err)
    return { schema: null, records: [] }
  }
}

/**
 * 将 TableRecord 转为扁平的 ParsedOrder 形态，供订单页 / getOrderStats 使用
 */
export function tableRecordToParsedOrder(record: TableRecord): Record<string, unknown> {
  const flat: Record<string, unknown> = { recordId: record.recordId }
  Object.entries(record.fields).forEach(([key, pf]) => {
    const val = pf.formatted ?? pf.parsed ?? pf.raw
    flat[key] = val
    if (pf.meta?.dataKey && pf.meta.dataKey !== key) flat[pf.meta.dataKey] = val
    if (pf.meta?.fieldName && pf.meta.fieldName !== key && pf.meta.fieldName !== pf.meta.dataKey) flat[pf.meta.fieldName] = val
  })
  return {
    ...flat,
    _raw: record.raw,
    _parsed: Object.fromEntries(
      Object.entries(record.fields).map(([k, v]) => [
        k,
        { raw: v.raw, parsed: v.parsed, formatted: v.formatted, isFormula: v.isFormula, isEmpty: v.isEmpty },
      ])
    ),
  }
}
