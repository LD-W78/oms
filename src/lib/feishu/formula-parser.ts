/**
 * ============================================================
 * 公式解析器 (Formula Parser) - 核心重构代码
 * 禁止直接修改，修复请联系架构负责人
 * ============================================================
 */
import { formatFieldValue, parseFieldValue, type FieldAdapter } from './field-adapters'

export interface FormulaValue {
  type: 1 | 2 | 3 | 4 | 5
  value: unknown[]
}

export interface ParsedFormulaValue {
  original: FormulaValue
  parsed: unknown
  formatted: string
  isEmpty: boolean
}

const formulaTypeAdapters: Record<number, FieldAdapter<unknown>> = {
  1: {
    type: 1,
    typeName: '文本',
    parse: (raw) => {
      if (!Array.isArray(raw)) return ''
      return raw.map((item: unknown) => {
        if (typeof item === 'object' && item !== null) {
          return (item as { text?: string }).text || ''
        }
        return String(item || '')
      }).join('')
    },
    format: (value) => String(value) || '-',
    isEmpty: (value) => !value || String(value).trim() === '',
    getSortValue: (value) => String(value).toLowerCase(),
    getFilterValue: (value) => String(value),
    compare: (a, b) => String(a).localeCompare(String(b), 'zh-CN')
  },
  2: {
    type: 2,
    typeName: '数字',
    parse: (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return 0
      const first = raw[0]
      if (typeof first === 'number') return first
      const parsed = parseFloat(String(first))
      return isNaN(parsed) ? 0 : parsed
    },
    format: (value, options) => {
      if (value === null || value === undefined || value === 0) return '-'
      const num = Number(value)
      if (isNaN(num)) return '-'
      if ((options as { currency?: boolean })?.currency) {
        return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      }
      return num.toLocaleString('zh-CN')
    },
    isEmpty: (value) => value === null || value === undefined || (typeof value === 'number' && isNaN(value)),
    getSortValue: (value) => Number(value) || 0,
    getFilterValue: (value) => String(value),
    compare: (a, b) => Number(a) - Number(b)
  },
  3: {
    type: 3,
    typeName: '单选',
    parse: (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return ''
      return String(raw[0] || '')
    },
    format: (value) => String(value) || '-',
    isEmpty: (value) => !value || String(value).trim() === '',
    getSortValue: (value) => String(value).toLowerCase(),
    getFilterValue: (value) => String(value),
    compare: (a, b) => String(a).localeCompare(String(b), 'zh-CN')
  },
  4: {
    type: 4,
    typeName: '多选',
    parse: (raw) => {
      if (!Array.isArray(raw)) return []
      return raw.map(String)
    },
    format: (value) => {
      if (!Array.isArray(value) || value.length === 0) return '-'
      return value.join(', ')
    },
    isEmpty: (value) => !Array.isArray(value) || value.length === 0,
    getSortValue: (value) => Array.isArray(value) ? value.join(',').toLowerCase() : '',
    getFilterValue: (value) => Array.isArray(value) ? value : [],
    compare: (a, b) => {
      const aStr = Array.isArray(a) ? a.join(',') : ''
      const bStr = Array.isArray(b) ? b.join(',') : ''
      return aStr.localeCompare(bStr)
    }
  },
  5: {
    type: 5,
    typeName: '日期',
    parse: (raw) => {
      if (!Array.isArray(raw) || raw.length === 0) return null
      const first = raw[0]
      if (typeof first === 'number') {
        return new Date(first)
      }
      const date = new Date(first)
      return isNaN(date.getTime()) ? null : date
    },
    format: (value) => {
      if (!value || !(value instanceof Date) || isNaN(value.getTime())) return '-'
      return value.toLocaleDateString('zh-CN')
    },
    isEmpty: (value) => !value || (value instanceof Date && isNaN(value.getTime())),
    getSortValue: (value) => {
      if (!value || !(value instanceof Date)) return 0
      return value.getTime()
    },
    getFilterValue: (value) => {
      if (!value || !(value instanceof Date)) return ''
      return value.toISOString().split('T')[0]
    },
    compare: (a, b) => {
      const aTime = a instanceof Date ? a.getTime() : 0
      const bTime = b instanceof Date ? b.getTime() : 0
      return aTime - bTime
    }
  }
}

export function isFormulaValue(value: unknown): value is FormulaValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'value' in value &&
    typeof (value as FormulaValue).type === 'number' &&
    Array.isArray((value as FormulaValue).value)
  )
}

export function parseFormulaValue(formulaValue: FormulaValue): ParsedFormulaValue {
  const adapter = formulaTypeAdapters[formulaValue.type]
  
  if (!adapter) {
    return {
      original: formulaValue,
      parsed: formulaValue.value,
      formatted: String(formulaValue.value),
      isEmpty: false
    }
  }

  const parsed = adapter.parse(formulaValue.value)
  const formatted = adapter.format(parsed)
  const isEmpty = adapter.isEmpty(parsed)

  return {
    original: formulaValue,
    parsed,
    formatted,
    isEmpty
  }
}

export function formatFormulaValue(value: unknown): string {
  if (!isFormulaValue(value)) {
    return String(value ?? '-')
  }

  const parsed = parseFormulaValue(value)
  return parsed.formatted
}

export function getFormulaSortValue(value: unknown): number | string {
  if (!isFormulaValue(value)) {
    return String(value)
  }

  const parsed = parseFormulaValue(value)
  const adapter = formulaTypeAdapters[parsed.original.type]
  
  if (!adapter) {
    return String(parsed.parsed)
  }

  return adapter.getSortValue(parsed.parsed)
}

export function compareFormulaValues(a: unknown, b: unknown): number {
  const aIsFormula = isFormulaValue(a)
  const bIsFormula = isFormulaValue(b)

  if (!aIsFormula && !bIsFormula) {
    return String(a).localeCompare(String(b))
  }

  if (aIsFormula && bIsFormula) {
    const aParsed = parseFormulaValue(a)
    const bParsed = parseFormulaValue(b)
    
    if (aParsed.original.type === bParsed.original.type) {
      const adapter = formulaTypeAdapters[aParsed.original.type]
      if (adapter) {
        return adapter.compare(aParsed.parsed, bParsed.parsed)
      }
    }
    
    return String(aParsed.formatted).localeCompare(String(bParsed.formatted))
  }

  const aStr = aIsFormula ? parseFormulaValue(a).formatted : String(a)
  const bStr = bIsFormula ? parseFormulaValue(b).formatted : String(b)
  return aStr.localeCompare(bStr)
}

export function getFormulaFieldTypeName(type: number): string {
  return formulaTypeAdapters[type]?.typeName || '未知'
}

export function detectAndParseFormula(value: unknown): {
  isFormula: boolean
  formatted: string
  parsed: unknown
  type?: number
  typeName?: string
} {
  if (!isFormulaValue(value)) {
    return {
      isFormula: false,
      formatted: String(value ?? '-'),
      parsed: value
    }
  }

  const parsed = parseFormulaValue(value)
  return {
    isFormula: true,
    formatted: parsed.formatted,
    parsed: parsed.parsed,
    type: value.type,
    typeName: getFormulaFieldTypeName(value.type)
  }
}
