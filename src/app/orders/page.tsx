'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { App, Card, Table, Button, Input, Tag, Space, DatePicker, Modal, Form, Select, Popconfirm, Grid, Alert, Spin } from 'antd'
const { MonthPicker } = DatePicker
const { useBreakpoint } = Grid
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TableRowSelection } from 'antd/es/table/interface'

import { useModuleConfig } from '@/app/hooks/useModuleConfig'
import { useTableData } from '@/app/hooks/useTableData'
import type { FieldSchema } from '@/lib/feishu/types'
import { TABLE_IDS } from '@/lib/config/env'
import { ROUTES } from '@/lib/config/routes'
import { MESSAGES } from '@/lib/config/messages'
import {
  ORDER_STATUS_ALL_KEY,
  ORDER_STATUS_KEYS,
  getStatusDisplay,
  getStatusTagStyle,
  getOptionTagStyle,
  type StatusDisplayItem,
} from '@/lib/config/order-status.config'
import { getFieldAdapter } from '@/lib/feishu/field-adapters'
import { isFormulaValue, formatFormulaValue, parseFormulaValue } from '@/lib/feishu/formula-parser'
import { getOrderStats, getOrderStatus, normalizeStatus } from '@/lib/feishu/order-stats'
import { recordToParsedOrder } from '@/app/utils/recordToOrder'
import type { ParsedOrderLike } from '@/app/utils/recordToOrder'
import Link from 'next/link'
import dayjs from 'dayjs'

interface Order {
  id: string
  [key: string]: unknown
}

const STATUS_ICON_MAP: Record<string, React.ReactNode> = {
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  DollarOutlined: <DollarOutlined />,
  BankOutlined: <BankOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FileDoneOutlined: <FileDoneOutlined />,
}

/** 从配置生成状态卡片列表（全部 + 各状态），支持动态扩展 */
function buildStatusCardConfigs(): Array<StatusDisplayItem & { iconNode: React.ReactNode }> {
  const allItem = getStatusDisplay(ORDER_STATUS_ALL_KEY)
  const rest = ORDER_STATUS_KEYS.map((k) => getStatusDisplay(k))
  return [allItem, ...rest].map((item) => ({
    ...item,
    iconNode: STATUS_ICON_MAP[item.icon] ?? <CheckCircleOutlined />,
  }))
}

function getStatusTag(status: string) {
  const style = getStatusTagStyle(status)
  return (
    <Tag
      style={{
        color: style.color,
        backgroundColor: style.bg,
        border: 'none',
        borderRadius: '9999px',
        padding: '4px 12px',
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {status}
    </Tag>
  )
}

function isCurrencyField(field: FieldSchema): boolean {
  const fieldId = field.fieldId || ''
  const fieldName = field.fieldName || ''
  
  return (
    fieldId.includes('amount') || 
    fieldId.includes('Amount') ||
    fieldId.includes('Price') ||
    fieldId.includes('price') ||
    fieldId.includes('Cost') ||
    fieldId.includes('cost') ||
    fieldName.includes('金额') ||
    fieldName.includes('价格') ||
    fieldName.includes('成本') ||
    fieldName.includes('毛利') ||
    fieldName.includes('退税') ||
    fieldName.includes('费用') ||
    fieldName.includes('CNY') ||
    fieldName.includes('USD') ||
    fieldName.includes('货代') ||
    fieldName.includes('海运') ||
    fieldName.includes('保险')
  )
}

function isDateField(field: FieldSchema): boolean {
  const fieldId = field.fieldId || ''
  const fieldName = field.fieldName || ''
  
  return (
    fieldId.includes('date') ||
    fieldId.includes('Date') ||
    fieldId.includes('time') ||
    fieldId.includes('Time') ||
    fieldId.includes('ETD') ||
    fieldId.includes('ETA') ||
    fieldId.includes('updated') ||
    fieldName.includes('日期') ||
    fieldName.includes('签约日') ||
    fieldName.includes('时间') ||
    fieldName.includes('ETD') ||
    fieldName.includes('ETA') ||
    fieldName.includes('更新')
  )
}

function isPercentageField(field: FieldSchema): boolean {
  const fieldId = field.fieldId || ''
  const fieldName = field.fieldName || ''
  const dataKey = field.dataKey || ''
  return (
    fieldId.includes('rate') ||
    fieldId.includes('Rate') ||
    fieldId.includes('percent') ||
    fieldId.includes('Percent') ||
    dataKey === 'grossProfitRate' ||
    dataKey === 'invoiceTaxRate' ||
    fieldName.includes('率') ||
    fieldName.includes('税率') ||
    fieldName.includes('毛利率')
  )
}

/**
 * 公式字段：以系统管理/同步设置中同步后的 schema 为准。
 * 优先依据 fieldType 20/21（飞书公式字段）；未带类型时按字段名兜底，只读且不提交。
 */
function isFormulaField(field: FieldSchema): boolean {
  const ft = field.fieldType ?? 1
  if (ft === 20 || ft === 21) return true
  const name = (field.fieldName || '').trim()
  return (
    /^(订单金额CNY|订单金额.*CNY)$/i.test(name) ||
    /^(毛利|gross.?profit)$/i.test(name) ||
    /^(毛利率|gross.?profit.?rate|profit.?rate)$/i.test(name) ||
    /^(退税额|退税金额|tax.?refund.?amount)$/i.test(name) ||
    /^(税费|tax|taxes|duty)$/i.test(name)
  )
}

/** 链接字段(15)：飞书写入易触发 LinkFieldConvFail，不提交 */
function isLinkField(field: FieldSchema): boolean {
  return (field.fieldType ?? 1) === 15
}

/** 按字段名匹配取 fieldId，用于 useWatch / 公式依赖 */
function getFieldIdByLabel(fields: FieldSchema[], pattern: RegExp): string | undefined {
  const f = fields.find((x) => pattern.test((x.fieldName || '').trim()))
  return f?.fieldId
}

function isStatusField(field: FieldSchema): boolean {
  const fieldId = field.fieldId || ''
  const fieldName = field.fieldName || ''
  const dataKey = field.dataKey || ''
  
  return (
    dataKey === 'status' || 
    fieldId.includes('status') || 
    fieldId.includes('Status') || 
    fieldName.includes('状态') ||
    fieldName.includes('进度')
  )
}

function isLogisticsField(field: FieldSchema): boolean {
  const fieldId = field.fieldId || ''
  const fieldName = field.fieldName || ''
  return (
    fieldId.includes('logistics') ||
    fieldId.includes('Logistics') ||
    fieldName.includes('物流')
  )
}

/** 货币/报价类型/运输/RITOS：用颜色 Tag 区分取值 */
function isOptionTagField(field: FieldSchema): boolean {
  const fieldName = (field.fieldName || '').trim()
  const dataKey = (field.dataKey || '').toLowerCase()
  return (
    /^(货币|币种|currency)$/i.test(fieldName) ||
    /^(报价类型|quote.?type)$/i.test(fieldName) ||
    /^(运输|shipping|logistics)$/i.test(fieldName) ||
    /^(RITOS|ritos|编号)$/i.test(fieldName) ||
    dataKey === 'currency' ||
    dataKey === 'quoteType' ||
    dataKey === 'ritos'
  )
}

function getFieldFilters(orders: ParsedOrderLike[], dataKey: string): { text: string; value: string }[] {
  const values = new Set<string>()
  orders.forEach(order => {
    const val = order[dataKey]
    if (val !== null && val !== undefined && val !== '') {
      values.add(String(val))
    }
  })
  return Array.from(values).sort().map(v => ({ text: v, value: v }))
}

/** 飞书单选/多选菜单：从 property.options 解析选项并去重（按 value）；无 schema 选项时可传入 fallback */
function getSelectOptions(
  field: FieldSchema,
  fallbackValues?: { label: string; value: string }[]
): { label: string; value: string }[] {
  const property = field.property as Record<string, unknown> | undefined
  const rawOptions = (property?.options ?? property?.option) as Array<{ name?: string; value?: string; label?: string; text?: string }> | undefined
  if (rawOptions && Array.isArray(rawOptions)) {
    const seen = new Set<string>()
    const list = rawOptions
      .map((opt) => {
        const label = String(opt.name ?? opt.label ?? opt.text ?? opt.value ?? '')
        const value = String(opt.value ?? opt.name ?? opt.label ?? opt.text ?? '')
        return { label, value }
      })
      .filter((o) => (o.value !== '' || o.label !== '') && !seen.has(o.value) && (seen.add(o.value), true))
    if (list.length > 0) return list
  }
  return fallbackValues ?? []
}

/** 数据层已做格式转换，页面只展示；取不到时用 dataKey/fieldName/_raw 回退；毛利率等按数字保留 2 位小数展示 */
function displayFromDataLayer(
  value: unknown,
  record: Order | undefined,
  field: FieldSchema
): string {
  const dataKey = field.dataKey || field.fieldId || ''
  const fieldName = field.fieldName || ''
  const fieldId = field.fieldId || ''
  const parsed = record && (record as unknown as ParsedOrderLike)._parsed
  let raw =
    value ??
    record?.[fieldId] ??
    record?.[dataKey] ??
    record?.[fieldName] ??
    (parsed?.[fieldId] != null ? (parsed[fieldId].formatted ?? parsed[fieldId].parsed ?? parsed[fieldId].raw) : undefined) ??
    (record as unknown as ParsedOrderLike)?._raw?.[fieldName] ??
    (record as unknown as ParsedOrderLike)?._raw?.[fieldId] ??
    (record as unknown as ParsedOrderLike)?._raw?.[dataKey]
  if (raw == null || raw === '') return '-'
  if (isPercentageField(field)) {
    const pctParsed = record && (record as unknown as ParsedOrderLike)._parsed?.[fieldId]
    if (pctParsed?.formatted != null && pctParsed.formatted !== '') return pctParsed.formatted
    if (typeof raw === 'object' && raw !== null && 'formatted' in raw) raw = (raw as { formatted?: unknown }).formatted
    if (typeof raw === 'object' && raw !== null && 'parsed' in raw) raw = (raw as { parsed?: unknown }).parsed
    const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/%/g, ''))
    if (!Number.isNaN(num)) {
      const pct = num > 1 || num < -1 ? num : num * 100
      return pct.toFixed(2)
    }
  }
  return String(raw)
}

/** 根据「货币」字段取值返回表格/表单用的货币符号 */
function getCurrencySymbol(currency: unknown): string {
  const s = String(currency ?? '').trim().toUpperCase()
  if (s === 'USD' || s.includes('美元') || s.includes('DOLLAR')) return '$'
  if (s === 'CNY' || s === 'RMB' || s.includes('人民币')) return '¥'
  return ''
}

/** 带货币符号的 Input 包装：符号在外部 span 中，避免动态 prefix 导致失焦（antd FAQ） */
function InputWithSymbolPrefix({
  symbol,
  placeholder,
  suffix,
  useWrapper,
  ...rest
}: {
  symbol: string
  placeholder?: string
  suffix?: React.ReactNode
  /** 为 true 时始终使用 div+span+Input 结构，避免 symbol 变化导致 DOM 结构切换失焦 */
  useWrapper?: boolean
} & React.ComponentProps<typeof Input>) {
  const displaySymbol = symbol || (useWrapper ? '¥' : '')
  if (useWrapper || displaySymbol) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff' }}>
        <span style={{ padding: '4px 11px', color: 'rgba(0,0,0,0.45)', fontSize: 14, fontWeight: 400 }}>{displaySymbol}</span>
        <Input
          type="number"
          placeholder={placeholder}
          suffix={suffix}
          variant="borderless"
          style={{ flex: 1, paddingLeft: 0 }}
          {...rest}
        />
      </div>
    )
  }
  return <Input type="number" placeholder={placeholder} suffix={suffix} {...rest} />
}

function createColumnFromField(
  field: FieldSchema,
  orders: ParsedOrderLike[],
  options?: { currencyFieldId?: string; amountOrPriceFieldIds?: Set<string> }
): ColumnsType<Order>[number] {
  const fieldId = field.fieldId || ''
  const dataKey = field.dataKey || fieldId
  const fieldType = Number(field.fieldType) || 1
  const colKey = fieldId
  const currencyFieldId = options?.currencyFieldId
  const isAmountOrPrice = options?.amountOrPriceFieldIds?.has(fieldId)

  const baseColumn: ColumnsType<Order>[number] = {
    title: field.fieldName || '未命名字段',
    dataIndex: colKey,
    key: colKey,
    width: 150,
  }

  if (dataKey === 'id' || fieldId === '订单号') {
    return {
      ...baseColumn,
      fixed: 'left',
      width: 220,
      render: (value: unknown) => (
        <a style={{ color: '#1976d2', fontWeight: 500, cursor: 'pointer' }}>
          {String(value)}
        </a>
      )
    }
  }

  if (isStatusField(field) || isLogisticsField(field)) {
    const isLogistics = isLogisticsField(field)
    return {
      ...baseColumn,
      render: (value: unknown, record: Order) => {
        const raw = value ?? record[dataKey] ?? record[field.fieldName]
        if (raw === null || raw === undefined || raw === '') {
          return <span style={{ color: '#999' }}>-</span>
        }
        const str = String(raw)
        if (isLogistics) {
          const style = getStatusTagStyle(str)
          return (
            <Tag
              style={{
                color: style.color,
                backgroundColor: style.bg,
                border: 'none',
                borderRadius: '9999px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {str}
            </Tag>
          )
        }
        return getStatusTag(str)
      },
      filters: getFieldFilters(orders, colKey),
      onFilter: (value, record) => record[colKey] === value,
      sorter: (a, b) => String(a[colKey]).localeCompare(String(b[colKey]))
    }
  }

  if (isOptionTagField(field)) {
    return {
      ...baseColumn,
      render: (value: unknown, record: Order) => {
        const raw = value ?? record[dataKey] ?? record[field.fieldName]
        if (raw === null || raw === undefined || raw === '') {
          return <span style={{ color: '#999' }}>-</span>
        }
        const str = String(raw)
        const style = getOptionTagStyle(str)
        return (
          <Tag
            style={{
              color: style.color,
              backgroundColor: style.bg,
              border: 'none',
              borderRadius: '9999px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            {str}
          </Tag>
        )
      },
      filters: getFieldFilters(orders, colKey),
      onFilter: (value, record) => (record[colKey] ?? record[dataKey]) === value,
      sorter: (a, b) =>
        String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
    }
  }

  const adapter = getFieldAdapter(fieldType)

  switch (fieldType) {
    case 2: {
      const renderCell = (value: unknown, record: Order) => {
        const text = displayFromDataLayer(value, record, field)
        if (text === '-') return text
        if (isAmountOrPrice && currencyFieldId) {
          const sym = getCurrencySymbol(record[currencyFieldId] ?? (record as unknown as ParsedOrderLike)?._raw?.[currencyFieldId])
          if (!sym) return text
          const textWithoutSymbol = text.replace(/^[$¥€£]\s*/, '')
          return `${sym}${textWithoutSymbol}`
        }
        return text
      }
      return {
        ...baseColumn,
        align: 'right',
        sorter: (a, b) => {
          const aVal = adapter.getSortValue(a[colKey] ?? a[dataKey])
          const bVal = adapter.getSortValue(b[colKey] ?? b[dataKey])
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal
          }
          return String(aVal).localeCompare(String(bVal))
        },
        render: renderCell,
      }
    }

    case 3: {
      const options = getSelectOptions(field)
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        filters: options.length > 0
          ? options.map(o => ({ text: o.label, value: o.value }))
          : getFieldFilters(orders, colKey),
        onFilter: (value, record) => (record[colKey] ?? record[dataKey]) === value,
        sorter: (a, b) =>
          String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
      }
    }

    case 4: {
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        filters: getFieldFilters(orders, colKey),
        onFilter: (value, record) => {
          const val = record[colKey] ?? record[dataKey]
          if (Array.isArray(val)) {
            return val.includes(value)
          }
          return String(val) === value
        },
        sorter: (a, b) => String(a[colKey]).localeCompare(String(b[colKey]))
      }
    }

    case 5:
    case 1001:
    case 1002: {
      return {
        ...baseColumn,
        sorter: (a, b) => {
          const aVal = adapter.getSortValue(a[colKey] ?? a[dataKey])
          const bVal = adapter.getSortValue(b[colKey] ?? b[dataKey])
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal
          }
          return String(aVal).localeCompare(String(bVal))
        },
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
      }
    }

    case 7:
      return {
        ...baseColumn,
        align: 'center',
        width: 100,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        sorter: (a, b) => {
          const aVal = a[colKey] ?? a[dataKey] ? 1 : 0
          const bVal = b[colKey] ?? b[dataKey] ? 1 : 0
          return aVal - bVal
        },
      }

    case 11:
    case 1003:
    case 1004:
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        sorter: (a, b) =>
          String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
      }

    case 15: {
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) => {
          const raw = value ?? record[dataKey] ?? record[field.fieldName]
          if (raw && typeof raw === 'object' && 'link' in raw) {
            const link = raw as { link: string; text: string }
            return (
              <a
                href={link.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#1976d2' }}
              >
                {link.text || link.link}
              </a>
            )
          }
          return displayFromDataLayer(value, record, field)
        },
        sorter: (a, b) =>
          String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
      }
    }

    case 20:
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        sorter: (a, b) =>
          String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
      }

    default:
      return {
        ...baseColumn,
        render: (value: unknown, record: Order) =>
          displayFromDataLayer(value, record, field),
        sorter: (a, b) =>
          String(a[colKey] ?? a[dataKey]).localeCompare(String(b[colKey] ?? b[dataKey])),
      }
  }
}

export default function OrdersPage() {
  const { message } = App.useApp()
  const screens = useBreakpoint()
  const isMobile = screens.sm === false
  const isSmall = screens.md === false
  const { config: moduleConfig, loading: configLoading } = useModuleConfig('orders')

  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null)
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => setHasMounted(true), [])
  useEffect(() => {
    const fromEnv = TABLE_IDS.orders ?? ''
    if (fromEnv.trim()) {
      setResolvedTableId(fromEnv)
      return
    }
    fetch('/api/config/table-ids', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { orders?: string | null }) => {
        setResolvedTableId(data?.orders?.trim() ?? '')
      })
      .catch(() => setResolvedTableId(''))
  }, [])

  const tableId = resolvedTableId ?? ''
  const { schema, records, loading, error, refetch, categorizedFields } = useTableData({ tableId })

  const orders = useMemo(
    () => records.map((r) => recordToParsedOrder(r) as ParsedOrderLike),
    [records]
  )
  const statusCardConfigs = useMemo(() => buildStatusCardConfigs(), [])
  const stats = useMemo(
    () => getOrderStats(orders, ORDER_STATUS_KEYS),
    [orders]
  )

  const [activeStatus, setActiveStatus] = useState<string>(ORDER_STATUS_ALL_KEY)
  const [searchText, setSearchText] = useState('')
  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentOrder, setCurrentOrder] = useState<ParsedOrderLike | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [form] = Form.useForm()

  /** 可见列：依据系统管理/数据管理中的「显示」配置，未配置时显示全部字段 */
  const visibleFields = useMemo(() => {
    if (!schema?.fields?.length) return []
    if (!moduleConfig) return schema.fields
    return schema.fields.filter((field) => {
      const perm = moduleConfig.fieldPermissions[field.fieldId]
      return perm?.visible !== false
    })
  }, [schema, moduleConfig])

  /** 弹窗分区块字段：基础信息、产品信息、商务信息、物流信息，按可见性与新增/编辑权限过滤 */
  const modalSections = useMemo(() => {
    const filterByVisible = (list: FieldSchema[]) => {
      if (!list?.length) return []
      if (!moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0) return list
      return list.filter((f) => moduleConfig.fieldPermissions[f.fieldId]?.visible !== false)
    }
    const filterByPermission = (list: FieldSchema[]) => {
      if (!list?.length) return []
      return list.filter((f) => {
        if (isFormulaField(f) || isLinkField(f)) return false
        if (!moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0) return true
        const perm = moduleConfig.fieldPermissions[f.fieldId]
        return isEditMode ? perm?.edit !== false : perm?.create !== false
      })
    }
    const basic = filterByPermission(filterByVisible([...(categorizedFields?.basic ?? []), ...(categorizedFields?.other ?? [])]))
    const product = filterByPermission(filterByVisible(categorizedFields?.product ?? []))
    const financial = filterByPermission(filterByVisible(categorizedFields?.financial ?? []))
    const logistics = filterByPermission(filterByVisible(categorizedFields?.logistics ?? []))
    return [
      { key: 'basic', title: '基础信息', fields: basic },
      { key: 'product', title: '产品信息', fields: product },
      { key: 'financial', title: '商务信息', fields: financial },
      { key: 'logistics', title: '物流信息', fields: logistics },
    ] as const
  }, [categorizedFields, moduleConfig, isEditMode])

  const currencyFieldId = useMemo(
    () => getFieldIdByLabel(visibleFields, /^(货币|币种|currency)$/i),
    [visibleFields]
  )
  const orderAmountFieldId = useMemo(
    () => visibleFields.find((f) => /^(订单金额)$/i.test((f.fieldName || '').trim()) && !isFormulaField(f))?.fieldId,
    [visibleFields]
  )
  const unitPriceFieldId = useMemo(
    () => visibleFields.find((f) => /^(单价|unit.?price|price)$/i.test((f.fieldName || '').trim()))?.fieldId,
    [visibleFields]
  )
  const cumulativePaymentFieldId = useMemo(
    () => getFieldIdByLabel(visibleFields, /^(累计回款|已收|已收款|received)$/i),
    [visibleFields]
  )
  const amountOrPriceFieldIds = useMemo(
    () => new Set([orderAmountFieldId, unitPriceFieldId, cumulativePaymentFieldId].filter(Boolean) as string[]),
    [orderAmountFieldId, unitPriceFieldId, cumulativePaymentFieldId]
  )
  const exchangeRateFieldId = useMemo(
    () => getFieldIdByLabel(visibleFields, /^(汇率|exchange)/i),
    [visibleFields]
  )
  const purchaseCostFieldId = useMemo(
    () => getFieldIdByLabel(visibleFields, /^(采购成本|成本|purchase|cost)$/i),
    [visibleFields]
  )
  const currency = Form.useWatch(currencyFieldId ?? undefined, form)

  /** 是否允许新增：依据数据管理中至少一个字段勾选「新增」 */
  const canCreate = useMemo(() => {
    if (!moduleConfig) return true
    const perms = moduleConfig.fieldPermissions
    if (Object.keys(perms).length === 0) return true
    return schema?.fields?.some((f) => perms[f.fieldId]?.create !== false) ?? true
  }, [moduleConfig, schema?.fields])

  /** 是否允许编辑：依据数据管理中至少一个字段勾选「编辑」 */
  const canEdit = useMemo(() => {
    if (!moduleConfig) return true
    const perms = moduleConfig.fieldPermissions
    if (Object.keys(perms).length === 0) return true
    return schema?.fields?.some((f) => perms[f.fieldId]?.edit !== false) ?? true
  }, [moduleConfig, schema?.fields])

  /** 是否允许删除：始终显示删除按钮，便于订单管理 */
  const canDelete = true

  const operationColumn: ColumnsType<ParsedOrderLike>[number] = {
    title: '操作',
    key: 'operation',
    fixed: 'right',
    width: 88,
    render: (_, record) => {
      const order = record as unknown as ParsedOrderLike
      return (
        <Space size="small" wrap={false}>
          {canEdit && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(order)}
            />
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除这个订单吗？此操作不可恢复。"
            onConfirm={() => handleDelete(order.recordId)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  }

  const columns = useMemo((): ColumnsType<ParsedOrderLike> => {
    if (!visibleFields.length) return []

    const fieldColumns = visibleFields.map((field) =>
      createColumnFromField(field, orders, {
        currencyFieldId: currencyFieldId ?? undefined,
        amountOrPriceFieldIds,
      })
    )
    return [...fieldColumns, operationColumn] as ColumnsType<ParsedOrderLike>
  }, [visibleFields, orders, currencyFieldId, amountOrPriceFieldIds])

  /** 从飞书 raw 或各类对象中提取可编辑的原始值 */
  const extractEditableValue = useCallback((v: unknown): unknown => {
    if (v == null || v === '') return undefined
    if (typeof v === 'object' && !Array.isArray(v) && !dayjs.isDayjs(v)) {
      const o = v as Record<string, unknown>
      if ('value' in o && o.value != null) return o.value
      if ('text' in o && o.text != null) return o.text
      if ('name' in o && o.name != null) return o.name
    }
    if (Array.isArray(v) && v.length > 0) {
      const first = v[0]
      if (typeof first === 'object' && first !== null) {
        const f = first as Record<string, unknown>
        return f.value ?? f.text ?? f.name ?? first
      }
      return first
    }
    return v
  }, [])

  /** 编辑弹窗的初始值：随 currentOrder 变化，覆盖所有表单字段，多源回退确保有数据时必能显示 */
  const editInitialValues = useMemo((): Record<string, unknown> => {
    const order = currentOrder
    if (!order) return {}
    const allFormFields = modalSections.flatMap((s) => s.fields)
    if (!allFormFields.length) return {}
    const initial: Record<string, unknown> = {}
    const raw = order._raw ?? {}
    allFormFields.forEach((field) => {
      const dataKey = field.dataKey || field.fieldId
      const parsed = order._parsed?.[field.fieldId]
      let value: unknown =
        (parsed?.raw != null ? extractEditableValue(parsed.raw) ?? parsed.raw : undefined) ??
        (parsed?.parsed != null ? extractEditableValue(parsed.parsed) ?? parsed.parsed : undefined) ??
        extractEditableValue(order[field.fieldId]) ?? order[field.fieldId] ??
        extractEditableValue(order[dataKey]) ?? order[dataKey] ??
        (field.fieldName && raw[field.fieldName] != null ? extractEditableValue(raw[field.fieldName]) ?? raw[field.fieldName] : undefined) ??
        (field.fieldId && raw[field.fieldId] != null ? extractEditableValue(raw[field.fieldId]) ?? raw[field.fieldId] : undefined) ??
        (dataKey && raw[dataKey] != null ? extractEditableValue(raw[dataKey]) ?? raw[dataKey] : undefined)
      if ((Number(field.fieldType) === 5 || isDateField(field)) && value != null && value !== '') {
        const d = dayjs(value as string | number)
        value = d.isValid() ? d : value
      }
      initial[field.fieldId] = value
    })
    return initial
  }, [currentOrder, modalSections, extractEditableValue])

  const handleEdit = (order: ParsedOrderLike) => {
    setCurrentOrder(order)
    setIsEditMode(true)
    setIsModalOpen(true)
  }

  /** 编辑弹窗打开时，将已有数据填入表单（延迟一帧确保 Form 已挂载，避免字段为空） */
  useEffect(() => {
    if (!isModalOpen || !isEditMode || !currentOrder || Object.keys(editInitialValues).length === 0) return
    const id = requestAnimationFrame(() => {
      form.setFieldsValue(editInitialValues)
    })
    return () => cancelAnimationFrame(id)
  }, [isModalOpen, isEditMode, currentOrder?.recordId, editInitialValues, form])

  const handleDelete = async (recordId: string) => {
    try {
      const response = await fetch(`/api/orders/${recordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('删除失败')
      }

      message.success('订单删除成功')
      refetch()
    } catch (error) {
      console.error('Failed to delete order:', error)
      message.error('删除订单失败')
    }
  }

  const handleBatchDelete = async () => {
    const keys = selectedRowKeys.filter((k): k is string => typeof k === 'string')
    if (keys.length === 0) return
    const hideLoading = message.loading(`正在删除 ${keys.length} 条订单...`, 0)
    try {
      const results = await Promise.allSettled(
        keys.map((recordId) =>
          fetch(`/api/orders/${recordId}`, { method: 'DELETE' })
        )
      )
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as Response).ok))
      hideLoading()
      if (failed.length > 0) {
        message.error(`删除完成，其中 ${failed.length} 条失败`)
      } else {
        message.success(`已删除 ${keys.length} 条订单`)
      }
      setSelectedRowKeys([])
      refetch()
    } catch (e) {
      hideLoading()
      console.error('Batch delete error:', e)
      message.error('批量删除失败')
    }
  }

  const handleAddNew = () => {
    setCurrentOrder(null)
    setIsEditMode(false)
    setIsModalOpen(true)
    // 延后 resetFields，等 React 重渲染后 Form 的 initialValues 已为 undefined，再重置到空白
    requestAnimationFrame(() => form.resetFields())
  }

  const handleModalOk = () => {
    form.validateFields().then(async (values) => {
      const payload = { ...values }
      visibleFields.filter(isFormulaField).forEach((f) => delete payload[f.fieldId])
      visibleFields.filter(isLinkField).forEach((f) => delete payload[f.fieldId])
      const hideLoading = message.loading(isEditMode ? '更新中...' : '新建中...', 0)
      try {
        if (isEditMode && currentOrder) {
          const response = await fetch(`/api/orders/${currentOrder.recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recordId: currentOrder.recordId,
              fields: payload,
            }),
          })

          if (!response.ok) {
            const errBody = (await response.json().catch(() => ({}))) as {
              error?: string
              msg?: string
              message?: string
            }
            const errMsg =
              (errBody?.error && String(errBody.error).trim()) ??
              (errBody?.msg && String(errBody.msg).trim()) ??
              (errBody?.message && String(errBody.message).trim()) ??
              '更新失败'
            throw new Error(errMsg)
          }

          hideLoading()
          message.success('订单更新成功')
        } else {
          const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}))
            throw new Error((errBody as { error?: string }).error ?? '创建失败')
          }

          hideLoading()
          message.success('订单创建成功')
        }

        await refetch()
        setIsModalOpen(false)
        form.resetFields()
      } catch (err) {
        hideLoading()
        console.error('Failed to save order:', err)
        const msg = err instanceof Error ? err.message : isEditMode ? '更新订单失败' : '创建订单失败'
        setTimeout(() => {
          setIsModalOpen(false)
          form.resetFields()
          message.error(msg)
        }, 0)
      }
    })
  }

  const handleExport = () => {
    const csvContent = [
      visibleFields.map(f => f.fieldName).join(','),
      ...filteredOrders.map(order => 
        visibleFields.map(field => {
          const value = order[field.fieldId]
          return `"${String(value).replace(/"/g, '""')}"`
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `orders_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    message.success('导出成功')
  }

  const handleCardClick = (key: string) => {
    setActiveStatus(key === activeStatus ? ORDER_STATUS_ALL_KEY : key)
  }

  const filteredOrders = orders.filter((order) => {
    const orderStatus = getOrderStatus(order)
    const matchesStatus =
      activeStatus === ORDER_STATUS_ALL_KEY ? true : orderStatus === activeStatus
    const matchesSearch = !searchText || Object.values(order).some(val => 
      String(val).toLowerCase().includes(searchText.toLowerCase())
    )
    const matchesMonth = !monthFilter || 
      (order.contractDate != null && String(order.contractDate).startsWith(monthFilter))
    return matchesStatus && matchesSearch && matchesMonth
  })

  const getCardData = () => {
    const defaultData = { count: 0, amount: '¥0', amountOriginal: undefined as string | undefined }
    if (stats) {
      return statusCardConfigs.map((config) => {
        if (config.key === ORDER_STATUS_ALL_KEY) {
          return { ...config, ...stats.all }
        }
        const item = stats[config.key]
        return { ...config, ...defaultData, ...(item ?? {}) }
      })
    }
    return statusCardConfigs.map((config) => ({
      ...config,
      ...defaultData,
    }))
  }

  const renderFormField = (field: FieldSchema) => {
    const fieldType = Number(field.fieldType) || 1
    const isCurrency = isCurrencyField(field)
    const isPercentage = isPercentageField(field)
    const options = getSelectOptions(field)

    const commonProps = {
      name: field.fieldId,
      label: field.fieldName,
      rules: [] as Array<{ required?: boolean; message?: string }>,
    }

    // ETD/ETA 等日期字段统一用日期选择器，不随 schema 的 fieldType 走
    if (isDateField(field)) {
      return (
        <Form.Item
          key={field.fieldId}
          {...commonProps}
          getValueProps={(v) => ({ value: v != null && v !== '' ? (dayjs.isDayjs(v) ? v : dayjs(v as string | number).isValid() ? dayjs(v as string | number) : null) : null })}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      )
    }

    switch (fieldType) {
      case 1:
        if (options.length > 0) {
          return (
            <Form.Item key={field.fieldId} {...commonProps}>
              <Select allowClear placeholder={`请选择${field.fieldName}`} options={options} />
            </Form.Item>
          )
        }
        return (
          <Form.Item key={field.fieldId} {...commonProps}>
            <Input
              placeholder={`请输入${field.fieldName}`}
              suffix={isPercentage ? '%' : undefined}
            />
          </Form.Item>
        )
      
      case 2: {
        const isOrderAmount = orderAmountFieldId && field.fieldId === orderAmountFieldId
        const isUnitPrice = unitPriceFieldId && field.fieldId === unitPriceFieldId
        const isCumulativePayment = cumulativePaymentFieldId && field.fieldId === cumulativePaymentFieldId
        const needsCurrencySymbol = isOrderAmount || isUnitPrice || isCumulativePayment
        const sym = needsCurrencySymbol
          ? getCurrencySymbol(currency) || (isCurrency ? '¥' : '')
          : isCurrency ? '¥' : ''
        const suffix = isPercentage ? '%' : undefined
        return (
          <Form.Item key={field.fieldId} {...commonProps}>
            <InputWithSymbolPrefix
              symbol={sym}
              useWrapper={!!needsCurrencySymbol}
              placeholder={`请输入${field.fieldName}`}
              suffix={suffix}
            />
          </Form.Item>
        )
      }
      
      case 3:
        if (options.length > 0) {
          return (
            <Form.Item key={field.fieldId} {...commonProps}>
              <Select allowClear placeholder={`请选择${field.fieldName}`} options={options} />
            </Form.Item>
          )
        }
        return (
          <Form.Item key={field.fieldId} {...commonProps}>
            <Input placeholder={`请输入${field.fieldName}`} />
          </Form.Item>
        )
      
      case 4:
        if (options.length > 0) {
          return (
            <Form.Item key={field.fieldId} {...commonProps}>
              <Select
                mode="multiple"
                allowClear
                placeholder={`请选择${field.fieldName}`}
                options={options}
              />
            </Form.Item>
          )
        }
        return (
          <Form.Item key={field.fieldId} {...commonProps}>
            <Input placeholder={`请输入${field.fieldName}`} />
          </Form.Item>
        )
      
      case 5:
        return (
          <Form.Item
            key={field.fieldId}
            {...commonProps}
            getValueProps={(v) => ({ value: v != null && v !== '' ? (dayjs.isDayjs(v) ? v : dayjs(v as string | number).isValid() ? dayjs(v as string | number) : null) : null })}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )
      
      case 7:
        return (
          <Form.Item key={field.fieldId} {...commonProps} valuePropName="checked">
            <Select>
              <Select.Option value={true}>是</Select.Option>
              <Select.Option value={false}>否</Select.Option>
            </Select>
          </Form.Item>
        )
      
      default:
        if (options.length > 0) {
          return (
            <Form.Item key={field.fieldId} {...commonProps}>
              <Select allowClear placeholder={`请选择${field.fieldName}`} options={options} />
            </Form.Item>
          )
        }
        return (
          <Form.Item key={field.fieldId} {...commonProps}>
            <Input placeholder={`请输入${field.fieldName}`} />
          </Form.Item>
        )
    }
  }

  const rowSelection: TableRowSelection<ParsedOrderLike> = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  const pagePadding = isMobile ? 12 : isSmall ? 16 : 24

  const needConfigTable = !tableId.trim()
  const needSyncSchema = tableId.trim() && !loading && !schema
  const showDataError = Boolean(error)

  // 未 mount 前只渲染静态占位，避免 useBreakpoint/ Ant Design 等导致服务端与客户端首帧不一致
  if (!hasMounted) {
    return (
      <div
        style={{
          padding: 24,
          background: '#f5f5f7',
          minHeight: '100%',
          boxSizing: 'border-box',
        }}
        data-orders-placeholder
      />
    )
  }

  if (resolvedTableId === null) {
    return (
      <div
        style={{
          padding: 24,
          background: '#f5f5f7',
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div
      style={{
        padding: pagePadding,
        background: '#f5f5f7',
        minHeight: '100%',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        overflow: 'auto',
      }}
    >
      {needConfigTable && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={MESSAGES.ORDERS.NO_TABLE_TITLE}
          description={
            <>
              {MESSAGES.ORDERS.NO_TABLE_DESC_PREFIX}
              <Link href={ROUTES.SYSTEM_SYNC} style={{ marginLeft: 4 }}>{MESSAGES.ORDERS.SYNC_LINK_TEXT}</Link>
              {MESSAGES.ORDERS.NO_TABLE_DESC_SUFFIX}
            </>
          }
        />
      )}

      {needSyncSchema && !needConfigTable && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={MESSAGES.ORDERS.NEED_SYNC_TITLE}
          description={
            <>
              {MESSAGES.ORDERS.NEED_SYNC_DESC_PREFIX}
              <Link href={ROUTES.SYSTEM_SYNC}>{MESSAGES.ORDERS.SYNC_LINK_TEXT}</Link>
              {MESSAGES.ORDERS.NEED_SYNC_DESC_MID}
            </>
          }
          action={
            <Button size="small" onClick={() => refetch()} loading={loading}>
              刷新
            </Button>
          }
        />
      )}

      {showDataError && !needConfigTable && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title={MESSAGES.ORDERS.LOAD_ERROR_TITLE}
          description={error?.message ?? MESSAGES.ORDERS.LOAD_ERROR_FALLBACK}
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
          gap: isMobile ? 8 : 12,
          marginBottom: isMobile ? 16 : 24,
          width: '100%',
        }}
      >
        {getCardData().map((card) => {
          const isActive = activeStatus === card.key
          const iconBg = card.iconBg ?? 'rgba(107, 114, 128, 0.1)'
          const iconColor = card.color
          return (
            <div
              key={card.key}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(card.key) }}
              style={{ minWidth: 0, width: '100%' }}
            >
            <Card
              size="small"
              style={{
                width: '100%',
                height: '100%',
                background: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
                borderRadius: 12,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              styles={{ body: { padding: 12 } }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.transform = 'translateY(-4px)'
                el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 8,
                    background: iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {React.cloneElement(
                    (card as StatusDisplayItem & { iconNode: React.ReactNode; count?: number; amount?: string }).iconNode as React.ReactElement<{ style?: React.CSSProperties }>,
                    { style: { color: iconColor, fontSize: 16 } }
                  )}
                </div>
                <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 2, lineHeight: 1.2 }}>
                {loading ? '...' : card.count}
              </div>
              <div style={{ fontSize: 11, color: card.key === ORDER_STATUS_ALL_KEY ? getStatusDisplay(ORDER_STATUS_ALL_KEY).color : card.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loading ? '...' : card.amount}
              </div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {loading ? '...' : `其中 ${(card as { amountOriginal?: string }).amountOriginal ?? '$0.00'}`}
              </div>
            </Card>
            </div>
          )
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: isMobile ? 12 : 16,
        }}
      >
        <Space wrap size={isMobile ? 'small' : 'middle'} style={isMobile ? { width: '100%' } : undefined}>
          <Input
            placeholder="搜索订单号、客户或产品..."
            prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: isMobile ? '100%' : isSmall ? 220 : 300, minWidth: isMobile ? 0 : 160, maxWidth: isMobile ? '100%' : undefined, borderRadius: 8 }}
            allowClear
          />
          <MonthPicker
            placeholder="按月份筛选"
            style={{ borderRadius: 8, width: isMobile ? '100%' : undefined, minWidth: isMobile ? '100%' : undefined }}
            onChange={(date) => {
              if (date) {
                setMonthFilter(date.format('YYYY-MM'))
              } else {
                setMonthFilter(null)
              }
            }}
          />
          <Popconfirm
            title={`确定删除选中的 ${selectedRowKeys.length} 条订单？`}
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="default"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 8 }}
              disabled={selectedRowKeys.length === 0}
            >
              {selectedRowKeys.length > 0 ? `删除 (${selectedRowKeys.length})` : '批量删除'}
            </Button>
          </Popconfirm>
        </Space>
        <Space wrap size={isMobile ? 'small' : 'middle'}>
          {canCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{ borderRadius: 8 }}
              onClick={handleAddNew}
            >
              {isMobile ? '新增' : '新增订单'}
            </Button>
          )}
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
            style={{ borderRadius: 8 }}
          >
            导出
          </Button>
        </Space>
      </div>

      <Card
        style={{
          borderRadius: 8,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0, overflow: 'auto' } }}
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="recordId"
          scroll={{
            x: isMobile ? 800 : 1000,
            y: isMobile ? 'calc(100vh - 380px)' : 'calc(100vh - 440px)',
          }}
          loading={loading || configLoading}
          rowSelection={rowSelection}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {isEditMode ? '编辑订单' : '新增订单'}
            </span>
          </div>
        }
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={() => setIsModalOpen(false)}
        width={isMobile ? '100%' : 720}
        style={isMobile ? { maxWidth: '100%', top: 16, paddingBottom: 0 } : undefined}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          key={isEditMode && currentOrder ? `edit-${currentOrder.recordId}` : 'create'}
          initialValues={isEditMode && currentOrder ? editInitialValues : undefined}
        >
          <div style={{ padding: '16px 0' }}>
            {modalSections.map((section) =>
              section.fields.length > 0 ? (
                <div key={section.key} style={{ marginBottom: section.key === 'logistics' ? 0 : 20 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: 12,
                      borderBottom: '1px solid #e5e7eb',
                      paddingBottom: 8,
                    }}
                  >
                    {section.title}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: isMobile ? 12 : 16,
                    }}
                  >
                    {section.fields.map((field) => (
                      <div key={field.fieldId}>{renderFormField(field as FieldSchema)}</div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
