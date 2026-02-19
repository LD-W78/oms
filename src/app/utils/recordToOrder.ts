/**
 * 将统一数据层 TableRecord 转为订单页使用的 ParsedOrder 形态（仅做展示与统计用）
 * 与服务端 table-data.tableRecordToParsedOrder 逻辑一致，供前端 useTableData 结果转换
 */

import type { TableRecord } from '@/app/hooks/useTableData'

export type ParsedOrderLike = Record<string, unknown> & {
  recordId: string
  _raw: Record<string, unknown>
  _parsed: Record<string, { raw: unknown; parsed: unknown; formatted: string; isFormula: boolean; isEmpty: boolean }>
}

export function recordToParsedOrder(record: TableRecord): ParsedOrderLike {
  const flat: Record<string, unknown> = { recordId: record.recordId }
  Object.entries(record.fields).forEach(([key, pf]) => {
    const val = pf.formatted ?? pf.parsed ?? pf.raw
    flat[key] = val
    if (pf.meta?.dataKey && pf.meta.dataKey !== key) flat[pf.meta.dataKey] = val
    if (pf.meta?.fieldName && pf.meta.fieldName !== key && pf.meta.fieldName !== pf.meta.dataKey) flat[pf.meta.fieldName] = val
  })
  if (flat.id == null || flat.id === '') flat.id = record.recordId
  return {
    ...flat,
    _raw: record.raw,
    _parsed: Object.fromEntries(
      Object.entries(record.fields).map(([k, v]) => [
        k,
        {
          raw: v.raw,
          parsed: v.parsed,
          formatted: v.formatted,
          isFormula: v.isFormula,
          isEmpty: v.isEmpty,
        },
      ])
    ),
  } as ParsedOrderLike
}
