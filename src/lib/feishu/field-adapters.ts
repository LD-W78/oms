/**
 * ============================================================
 * 字段类型适配器 (Field Type Adapters) - 核心重构代码
 * 
 * ⚠️ 警告：此文件处理飞书所有字段类型转换，请勿直接修改
 * 
 * 允许修改的场景：
 *   - 新增字段类型Adapter
 *   - 修复字段解析错误
 *   - 性能优化
 * 
 * 禁止修改的场景：
 *   - 添加页面特定逻辑
 *   - 硬编码业务规则
 * ============================================================
 */

import type { FieldSchema } from './types'

export enum FeishuFieldType {
  TEXT = 1,
  NUMBER = 2,
  SINGLE_SELECT = 3,
  MULTI_SELECT = 4,
  DATE = 5,
  CHECKBOX = 7,
  USER = 11,
  PHONE = 13,
  LINK = 15,
  ATTACHMENT = 17,
  LINK_RECORD = 18,
  LOOKUP = 19,
  FORMULA = 20,
  DENO_FORMULA = 21,
  LOCATION = 22,
  GROUP = 23,
  REFERENCE = 24,
  CREATE_TIME = 1001,
  UPDATE_TIME = 1002,
  CREATE_USER = 1003,
  UPDATE_USER = 1004,
  AUTO_NUMBER = 1005,
  RICH_TEXT = 3001,
}

export type FieldValue = unknown

export interface FormulaValue {
  type: 1 | 2 | 3 | 4 | 5
  value: unknown[]
}

export interface UserField {
  id: string
  name: string
  en_name?: string
  email?: string
}

export interface AttachmentField {
  file_token: string
  name: string
  size: number
  type: string
  url: string
  tmp_url?: string
}

export interface LinkField {
  link: string
  text: string
}

export interface FieldAdapter<T = FieldValue> {
  type: FeishuFieldType
  typeName: string
  parse: (raw: unknown) => T
  format: (value: T, options?: Record<string, unknown>) => string
  isEmpty: (value: unknown) => boolean
  getSortValue: (value: T) => number | string
  getFilterValue: (value: T) => string | string[]
  compare: (a: T, b: T) => number
}

const textAdapter: FieldAdapter<string> = {
  type: 1,
  typeName: '文本',
  parse: (raw) => {
    if (raw === null || raw === undefined) return ''
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((item) => item?.text || '').join('')
    }
    return String(raw)
  },
  format: (value) => value || '-',
  isEmpty: (value) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'string') return value.trim() === ''
    if (Array.isArray(value)) return value.length === 0
    return false
  },
  getSortValue: (value) => value.toLowerCase(),
  getFilterValue: (value) => value,
  compare: (a, b) => a.localeCompare(b, 'zh-CN')
}

const numberAdapter: FieldAdapter<number> = {
  type: 2,
  typeName: '数字',
  parse: (raw) => {
    if (raw === null || raw === undefined) return 0
    if (typeof raw === 'number') return raw
    const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''))
    return isNaN(parsed) ? 0 : parsed
  },
  format: (value, options) => {
    if (value === 0 || value === null || value === undefined) return '-'
    if ((options as { currency?: boolean })?.currency) {
      return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    const decimals = (options as { decimals?: number })?.decimals ?? 2
    return value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  },
  isEmpty: (value) => {
    if (value === null || value === undefined) return true
    if (typeof value === 'number') return isNaN(value)
    return false
  },
  getSortValue: (value) => value,
  getFilterValue: (value) => String(value),
  compare: (a, b) => a - b
}

const singleSelectAdapter: FieldAdapter<string> = {
  type: 3,
  typeName: '单选',
  parse: (raw) => {
    if (raw === null || raw === undefined) return ''
    return String(raw)
  },
  format: (value) => value || '-',
  isEmpty: (value) => !value || String(value).trim() === '',
  getSortValue: (value) => value.toLowerCase(),
  getFilterValue: (value) => value,
  compare: (a, b) => a.localeCompare(b, 'zh-CN')
}

const multiSelectAdapter: FieldAdapter<string[]> = {
  type: 4,
  typeName: '多选',
  parse: (raw) => {
    if (!raw) return []
    if (Array.isArray(raw)) return raw.map(String)
    return [String(raw)]
  },
  format: (value) => {
    if (!value || value.length === 0) return '-'
    return value.join(', ')
  },
  isEmpty: (value) => !Array.isArray(value) || value.length === 0,
  getSortValue: (value) => value.join(',').toLowerCase(),
  getFilterValue: (value) => value,
  compare: (a, b) => a.join(',').localeCompare(b.join(','))
}

const dateAdapter: FieldAdapter<Date | null> = {
  type: 5,
  typeName: '日期',
  parse: (raw) => {
    if (!raw) return null
    if (typeof raw === 'number') {
      return new Date(raw)
    }
    if (typeof raw === 'string') {
      const date = new Date(raw)
      return isNaN(date.getTime()) ? null : date
    }
    return null
  },
  format: (value, options) => {
    if (!value || !(value instanceof Date) || isNaN(value.getTime())) return '-'
    const format = (options as { format?: 'date' | 'datetime' | 'time' })?.format || 'date'
    switch (format) {
      case 'datetime':
        return value.toLocaleString('zh-CN')
      case 'time':
        return value.toLocaleTimeString('zh-CN')
      default:
        return value.toLocaleDateString('zh-CN')
    }
  },
  isEmpty: (value) => {
    if (!value) return true
    if (value instanceof Date) return isNaN(value.getTime())
    return false
  },
  getSortValue: (value) => {
    if (!value || !(value instanceof Date)) return 0
    return value.getTime()
  },
  getFilterValue: (value) => {
    if (!value || !(value instanceof Date)) return ''
    return value.toISOString().split('T')[0]
  },
  compare: (a, b) => {
    if (!a && !b) return 0
    if (!a) return -1
    if (!b) return 1
    return a.getTime() - b.getTime()
  }
}

const checkboxAdapter: FieldAdapter<boolean> = {
  type: 7,
  typeName: '复选框',
  parse: (raw) => {
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string') return raw.toLowerCase() === 'true'
    return Boolean(raw)
  },
  format: (value) => value ? '✓' : '-',
  isEmpty: (value) => value === null || value === undefined,
  getSortValue: (value) => value ? 1 : 0,
  getFilterValue: (value) => value ? '是' : '否',
  compare: (a, b) => Number(a) - Number(b)
}

const userAdapter: FieldAdapter<UserField[]> = {
  type: 11,
  typeName: '人员',
  parse: (raw) => {
    if (!raw) return []
    if (!Array.isArray(raw)) return []
    return raw.map((item) => ({
      id: item?.id || '',
      name: item?.name || item?.en_name || '',
      en_name: item?.en_name,
      email: item?.email
    })).filter(u => u.name)
  },
  format: (value) => {
    if (!value || value.length === 0) return '-'
    return value.map(u => u.name).join(', ')
  },
  isEmpty: (value) => !Array.isArray(value) || value.length === 0,
  getSortValue: (value) => {
    if (!value || value.length === 0) return ''
    return value[0].name
  },
  getFilterValue: (value) => {
    if (!value) return []
    return value.map(u => u.name)
  },
  compare: (a, b) => {
    const aName = a[0]?.name || ''
    const bName = b[0]?.name || ''
    return aName.localeCompare(bName, 'zh-CN')
  }
}

const phoneAdapter: FieldAdapter<string> = {
  type: 13,
  typeName: '电话',
  parse: (raw) => {
    if (raw === null || raw === undefined) return ''
    return String(raw)
  },
  format: (value) => value || '-',
  isEmpty: (value) => !value || String(value).trim() === '',
  getSortValue: (value) => value,
  getFilterValue: (value) => value,
  compare: (a, b) => a.localeCompare(b)
}

const linkAdapter: FieldAdapter<LinkField | null> = {
  type: 15,
  typeName: '超链接',
  parse: (raw) => {
    if (!raw || typeof raw !== 'object') return null
    return {
      link: (raw as LinkField).link || '',
      text: (raw as LinkField).text || ''
    }
  },
  format: (value) => {
    if (!value) return '-'
    return value.text || value.link || '-'
  },
  isEmpty: (value) => {
    if (!value || typeof value !== 'object') return true
    return !(value as LinkField).link
  },
  getSortValue: (value) => value?.text || value?.link || '',
  getFilterValue: (value) => value?.text || '',
  compare: (a, b) => {
    const aText = a?.text || a?.link || ''
    const bText = b?.text || b?.link || ''
    return aText.localeCompare(bText)
  }
}

const attachmentAdapter: FieldAdapter<AttachmentField[]> = {
  type: 17,
  typeName: '附件',
  parse: (raw) => {
    if (!raw) return []
    if (!Array.isArray(raw)) return []
    return raw.map((item) => ({
      file_token: item?.file_token || '',
      name: item?.name || '',
      size: item?.size || 0,
      type: item?.type || '',
      url: item?.url || '',
      tmp_url: item?.tmp_url
    })).filter(a => a.name)
  },
  format: (value) => {
    if (!value || value.length === 0) return '-'
    return value.map(a => a.name).join(', ')
  },
  isEmpty: (value) => !Array.isArray(value) || value.length === 0,
  getSortValue: (value) => {
    if (!value || value.length === 0) return ''
    return value[0].name
  },
  getFilterValue: (value) => {
    if (!value) return []
    return value.map(a => a.name)
  },
  compare: (a, b) => {
    const aName = a[0]?.name || ''
    const bName = b[0]?.name || ''
    return aName.localeCompare(bName)
  }
}

const linkRecordAdapter: FieldAdapter<string[]> = {
  type: 18,
  typeName: '关联',
  parse: (raw) => {
    if (!raw || typeof raw !== 'object') return []
    const linkRecordIds = (raw as { link_record_ids?: string[] }).link_record_ids
    return Array.isArray(linkRecordIds) ? linkRecordIds : []
  },
  format: (value) => {
    if (!value || value.length === 0) return '-'
    return `${value.length} 条记录`
  },
  isEmpty: (value) => !Array.isArray(value) || value.length === 0,
  getSortValue: (value) => value.length,
  getFilterValue: (value) => value,
  compare: (a, b) => a.length - b.length
}

const lookupAdapter: FieldAdapter<unknown> = {
  type: 19,
  typeName: '查找引用',
  parse: (raw) => raw,
  format: (value) => {
    if (!value) return '-'
    if (typeof value === 'object') {
      const val = (value as { value?: unknown }).value
      if (Array.isArray(val)) {
        return val.map((v: unknown) => {
          if (typeof v === 'object' && v !== null) {
            return (v as { text?: string }).text || String(v)
          }
          return String(v)
        }).join(', ')
      }
      return String(val)
    }
    return String(value)
  },
  isEmpty: (value) => !value || (typeof value === 'object' && Object.keys(value).length === 0),
  getSortValue: (value) => String(value),
  getFilterValue: (value) => String(value),
  compare: (a, b) => String(a).localeCompare(String(b))
}

interface LocationValue {
  name: string
  address: string
}

const locationAdapter: FieldAdapter<LocationValue | null> = {
  type: 22,
  typeName: '地理位置',
  parse: (raw) => {
    if (!raw || typeof raw !== 'object') return null
    return {
      name: (raw as { name?: string }).name || '',
      address: (raw as { full_address?: string; address?: string }).full_address || 
               (raw as { address?: string }).address || ''
    }
  },
  format: (value) => {
    if (!value) return '-'
    return value.name || value.address || '-'
  },
  isEmpty: (value) => {
    const loc = value as LocationValue | null
    return !loc || (!loc.name && !loc.address)
  },
  getSortValue: (value) => {
    const loc = value as LocationValue | null
    return loc?.name || loc?.address || ''
  },
  getFilterValue: (value) => {
    const loc = value as LocationValue | null
    return loc?.name || ''
  },
  compare: (a, b) => {
    const aLoc = a as LocationValue | null
    const bLoc = b as LocationValue | null
    const aName = aLoc?.name || aLoc?.address || ''
    const bName = bLoc?.name || bLoc?.address || ''
    return aName.localeCompare(bName)
  }
}

const groupAdapter: FieldAdapter<{ id: string; name: string }[]> = {
  type: 23,
  typeName: '群组',
  parse: (raw) => {
    if (!raw) return []
    if (!Array.isArray(raw)) return []
    return raw.map((item) => ({
      id: item?.id || '',
      name: item?.name || ''
    })).filter(g => g.name)
  },
  format: (value) => {
    if (!value || value.length === 0) return '-'
    return value.map(g => g.name).join(', ')
  },
  isEmpty: (value) => !Array.isArray(value) || value.length === 0,
  getSortValue: (value) => {
    if (!value || value.length === 0) return ''
    return value[0].name
  },
  getFilterValue: (value) => {
    if (!value) return []
    return value.map(g => g.name)
  },
  compare: (a, b) => {
    const aName = a[0]?.name || ''
    const bName = b[0]?.name || ''
    return aName.localeCompare(bName)
  }
}

const autoNumberAdapter: FieldAdapter<string> = {
  type: 1005,
  typeName: '自动编号',
  parse: (raw) => {
    if (raw === null || raw === undefined) return ''
    return String(raw)
  },
  format: (value) => value || '-',
  isEmpty: (value) => !value || String(value).trim() === '',
  getSortValue: (value) => {
    const num = parseInt(value, 10)
    return isNaN(num) ? value : num
  },
  getFilterValue: (value) => value,
  compare: (a, b) => {
    const aNum = parseInt(a, 10)
    const bNum = parseInt(b, 10)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum
    }
    return a.localeCompare(b)
  }
}

const adapters: Record<number, FieldAdapter<unknown>> = {
  1: textAdapter as FieldAdapter<unknown>,
  2: numberAdapter as FieldAdapter<unknown>,
  3: singleSelectAdapter as FieldAdapter<unknown>,
  4: multiSelectAdapter as FieldAdapter<unknown>,
  5: dateAdapter as FieldAdapter<unknown>,
  7: checkboxAdapter as FieldAdapter<unknown>,
  11: userAdapter as FieldAdapter<unknown>,
  13: phoneAdapter as FieldAdapter<unknown>,
  15: linkAdapter as FieldAdapter<unknown>,
  17: attachmentAdapter as FieldAdapter<unknown>,
  18: linkRecordAdapter as FieldAdapter<unknown>,
  19: lookupAdapter as FieldAdapter<unknown>,
  20: textAdapter as FieldAdapter<unknown>,
  21: linkRecordAdapter as FieldAdapter<unknown>,
  22: locationAdapter as FieldAdapter<unknown>,
  23: groupAdapter as FieldAdapter<unknown>,
  24: textAdapter as FieldAdapter<unknown>,
  1001: dateAdapter as FieldAdapter<unknown>,
  1002: dateAdapter as FieldAdapter<unknown>,
  1003: userAdapter as FieldAdapter<unknown>,
  1004: userAdapter as FieldAdapter<unknown>,
  1005: autoNumberAdapter as FieldAdapter<unknown>,
  3001: textAdapter as FieldAdapter<unknown>
}

export function getFieldAdapter(fieldType: number): FieldAdapter<unknown> {
  return adapters[fieldType] || textAdapter
}

export function getAdapterBySchema(field: FieldSchema): FieldAdapter<unknown> {
  return getFieldAdapter(field.fieldType)
}

export function parseFieldValue(raw: unknown, fieldType: number): unknown {
  const adapter = getFieldAdapter(fieldType)
  return adapter.parse(raw)
}

export function formatFieldValue(value: unknown, fieldType: number, options?: Record<string, unknown>): string {
  const adapter = getFieldAdapter(fieldType)
  return adapter.format(value, options)
}

export function isFieldEmpty(value: unknown, fieldType: number): boolean {
  const adapter = getFieldAdapter(fieldType)
  return adapter.isEmpty(value)
}

export function getFieldSortValue(value: unknown, fieldType: number): number | string {
  const adapter = getFieldAdapter(fieldType)
  return adapter.getSortValue(value)
}

export function compareFieldValues(a: unknown, b: unknown, fieldType: number): number {
  const adapter = getFieldAdapter(fieldType)
  return adapter.compare(a, b)
}

export function getSupportedFieldTypes(): { type: number; name: string }[] {
  return Object.values(adapters).map(adapter => ({
    type: adapter.type,
    name: adapter.typeName
  }))
}
