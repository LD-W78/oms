'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { App, Card, Input, Button, Tag, Space, DatePicker, Modal, Spin, Grid, Alert, Select } from 'antd'
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { TABLE_IDS } from '@/lib/config/env'
import { useModuleConfig } from '@/app/hooks/useModuleConfig'
import { useTableData, type TableRecord } from '@/app/hooks/useTableData'
import type { MappedField } from '@/lib/feishu/field-mapping'

type ReceivableStatus = '待收款' | '部分收款' | '已收齐' | '待付款' | '部分付款' | '已付齐'

interface ReceivableItem {
  id: string
  orderNo: string
  customer: string
  contractDate: string
  orderAmount: number
  currency: string
  received: number
  receivable: number
  paid: number
  payable: number
  status: ReceivableStatus
  paymentStatus: string
  product?: string
}

const statusConfig: { key: ReceivableStatus; label: string; icon: React.ReactNode; bg: string; color: string }[] = [
  { key: '待收款', label: '待收款', icon: <ClockCircleOutlined />, bg: '#fef3c7', color: '#d97706' },
  { key: '部分收款', label: '部分收款', icon: <SyncOutlined spin={false} />, bg: '#dbeafe', color: '#2563eb' },
  { key: '已收齐', label: '已收齐', icon: <CheckCircleOutlined />, bg: '#d1fae5', color: '#059669' },
  { key: '待付款', label: '待付款', icon: <ClockCircleOutlined />, bg: '#fee2e2', color: '#dc2626' },
  { key: '部分付款', label: '部分付款', icon: <SyncOutlined spin={false} />, bg: '#ffedd5', color: '#ea580c' },
  { key: '已付齐', label: '已付齐', icon: <CheckCircleOutlined />, bg: '#d1fae5', color: '#059669' },
]

function extractVal(value: unknown): string {
  if (value == null || value === '') return '-'
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (typeof first === 'object' && first !== null) {
      const obj = first as Record<string, unknown>
      return String(obj.text ?? obj.name ?? obj.value ?? '-')
    }
    return String(first)
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return String(obj.text ?? obj.name ?? obj.value ?? '-')
  }
  return String(value)
}

function parseNum(value: unknown): number {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  return Number.isNaN(n) ? 0 : n
}

/** 字段别名：field-mapping 中 订单金额→amount、订单金额CNY→amountCNY，应收/已收等可能保留中文 dataKey；飞书 raw 用 field_id 作 key */
const FIELD_ALIASES: Record<string, string[]> = {
  id: ['订单号', 'id', 'orderNo'],
  customer: ['客户', '公司', 'customer'],
  contractDate: ['签约日期', '签约日', 'contractDate'],
  orderAmount: ['amount', 'amountCNY', '订单金额', '订单金额CNY', 'orderAmount'],
  currency: ['货币', '币种', 'currency'],
  received: ['累计回款', '已收', '已收款', 'received'],
  receivable: ['应收款额', '应收', '应收款', 'receivable'],
  paid: ['已付', '已付款', 'paid'],
  payable: ['应付', '应付款', 'payable'],
  product: ['产品', '货品', 'product'],
  status: ['进度', '商务进度', 'status'],
  paymentStatus: ['付款状态', '付款：状态', 'paymentStatus'],
}

/** 按 dataKey 或别名从 TableRecord 取值（优先 record.fields 的 meta.dataKey/fieldName，再试 record.raw） */
function getByDataKey(record: TableRecord, dataKey: string): string {
  const aliases = FIELD_ALIASES[dataKey] ?? [dataKey]
  for (const key of aliases) {
    const pf = Object.values(record.fields).find(
      (p) => {
        const meta = p.meta as { dataKey?: string; fieldName?: string } | undefined
        return meta?.dataKey === key || meta?.fieldName === key
      }
    )
    if (pf != null) {
      const v = pf.formatted ?? pf.parsed ?? pf.raw
      if (v != null && v !== '') return extractVal(v)
    }
  }
  for (const k of aliases) {
    const v = record.raw[k]
    // 飞书 raw 可能为对象 { type, value } 或 { text }，空对象/0 也需提取
    if (v !== undefined && v !== null) {
      const s = extractVal(v)
      if (s !== '-') return s
    }
  }
  return '-'
}

function deriveStatus(received: number, receivable: number, paid: number, payable: number): ReceivableStatus {
  if (receivable > 0) {
    if (received <= 0) return '待收款'
    if (received >= receivable) return '已收齐'
    return '部分收款'
  }
  if (payable > 0) {
    if (paid <= 0) return '待付款'
    if (paid >= payable) return '已付齐'
    return '部分付款'
  }
  return '已收齐'
}

function recordToReceivableItem(record: TableRecord): ReceivableItem {
  const orderNo = getByDataKey(record, 'id')
  const customer = getByDataKey(record, 'customer')
  const contractDate = getByDataKey(record, 'contractDate')
  const currency = (getByDataKey(record, 'currency') || 'CNY').toUpperCase().includes('USD') ? 'USD' : 'CNY'
  const orderAmount = parseNum(getByDataKey(record, 'orderAmount'))
  const received = parseNum(getByDataKey(record, 'received'))
  const receivable = parseNum(getByDataKey(record, 'receivable'))
  const paid = parseNum(getByDataKey(record, 'paid'))
  const payable = parseNum(getByDataKey(record, 'payable'))
  const status = deriveStatus(received, receivable, paid, payable)
  const paymentStatus = getByDataKey(record, 'paymentStatus')
  const product = getByDataKey(record, 'product')
  return {
    id: record.recordId,
    orderNo: orderNo !== '-' ? orderNo : record.recordId,
    customer: customer !== '-' ? customer : '-',
    contractDate: contractDate !== '-' ? contractDate : '-',
    orderAmount,
    currency,
    received,
    receivable,
    paid,
    payable,
    status,
    paymentStatus: paymentStatus !== '-' ? paymentStatus : '',
    product: product !== '-' ? product : undefined,
  }
}

function formatMoney(amount: number, currency: string): string {
  const sym = currency === 'USD' ? '$' : '¥'
  return `${sym}${Math.abs(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getFieldDisplayValue(rawFields: Record<string, unknown>, fieldName: string): string {
  const value = rawFields[fieldName]
  return extractVal(value)
}

/** 需要货币符号的金额字段（排除货币本身、百分比、布尔） */
function isCurrencyAmountField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const dk = (field.dataKey || '').toLowerCase()
  if (/^(货币|币种|currency)$/i.test(fn) || dk === 'currency') return false
  if (isPercentageField(field)) return false
  return (
    /^(订单金额|累计回款|单价)$/i.test(fn) ||
    /^(采购成本|货代杂费|海运及保险|其他费用)$/i.test(fn) ||
    /^(应收款额|退税|退税额|税费|毛利)$/i.test(fn) ||
    /^(amount|unitprice|purchasecost|shipping|otherfees|received|receivable|paid|payable)$/i.test(dk)
  )
}

/** 固定为¥的字段：采购成本、货代杂费、海运及保险、其他费用、退税、退税额、税费、毛利 */
function isFixedCnyField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const dk = (field.dataKey || '').toLowerCase()
  return (
    /^(采购成本|货代杂费|海运及保险|其他费用|退税|退税额|税费|毛利)$/i.test(fn) ||
    ['purchasecost', 'forwarderfees', 'shippinginsurance', 'otherfees', 'tax', 'taxrefund', 'taxrefundamount', 'grossprofit'].includes(dk)
  )
}

/** 随货币字段动态的金额字段（订单金额、累计回款、单价）：货币=USD→$，货币=CNY→¥ */
function isDynamicCurrencyField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const dk = (field.dataKey || '').toLowerCase()
  if (isFixedCnyField(field)) return false
  return (/^(订单金额|累计回款|单价)$/i.test(fn) && !/CNY/i.test(fn)) || ['amount', 'unitprice', 'received'].includes(dk)
}

function getCurrencySymbol(currency: unknown): string {
  const s = String(currency ?? '').trim().toUpperCase()
  if (s === 'USD' || s.includes('美元')) return '$'
  if (s === 'CNY' || s === 'RMB' || s.includes('人民币')) return '¥'
  return ''
}

function formatCurrencyDisplay(value: string, currencyVal: unknown): string {
  if (!value || value === '-') return value
  if (/^(是|否)$/.test(value.trim()) || value.includes('%')) return value
  const sym = getCurrencySymbol(currencyVal) || '¥'
  const numPart = value.replace(/^[$¥€£]\s*/, '').trim()
  if (!numPart || !/^-?[\d,.\s]+$/.test(numPart.replace(/,/g, ''))) return value
  return `${sym}${numPart}`
}

function isDateField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const fid = (field.fieldId || '').trim()
  return /date|Date|time|Time|ETD|ETA|updated|更新/i.test(fid) || /日期|签约日|时间|ETD|ETA|更新/.test(fn)
}

function isFormulaField(field: MappedField): boolean {
  const ft = Number(field.fieldType) ?? 1
  if (ft === 20 || ft === 21) return true
  const name = (field.fieldName || '').trim()
  return /^(订单金额CNY|订单金额.*CNY)$/i.test(name) || /^(毛利|gross.?profit)$/i.test(name) || /^(毛利率|gross.?profit.?rate|profit.?rate)$/i.test(name) || /^(退税额|退税金额|tax.?refund.?amount)$/i.test(name) || /^(税费|tax|taxes|duty)$/i.test(name)
}

function isPercentageField(field: MappedField): boolean {
  const fn = field.fieldName || ''
  const dk = field.dataKey || ''
  return /率|rate|percent|Percent/.test(fn) || /rate|percent/.test(dk)
}

/** 标题红色显示的字段：累计回款、应收款额、付款状态 */
function isRedLabelField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const dn = (field.displayName || '').trim()
  const dk = (field.dataKey || '').toLowerCase().replace(/\s/g, '')
  const dkRaw = (field.dataKey || '').trim()
  return (
    /^(累计回款|已收|应收款额|应收|应收款|付款状态)$/i.test(fn) ||
    /^(累计回款|已收|应收款额|应收|应收款|付款状态)$/i.test(dn) ||
    /^(累计回款|已收|应收款额|应收|应收款|付款状态)$/i.test(dkRaw) ||
    ['received', 'receivable', 'paymentstatus'].includes(dk)
  )
}

function getSelectOptions(field: MappedField): { label: string; value: string }[] {
  const property = field.property as Record<string, unknown> | undefined
  const rawOptions = (property?.options ?? property?.option) as Array<{ name?: string; value?: string; label?: string; text?: string }> | undefined
  if (rawOptions && Array.isArray(rawOptions)) {
    const seen = new Set<string>()
    return rawOptions
      .map((opt) => {
        const label = String(opt.name ?? opt.label ?? opt.text ?? opt.value ?? '')
        const value = String(opt.value ?? opt.name ?? opt.label ?? opt.text ?? '')
        return { label, value }
      })
      .filter((o) => (o.value !== '' || o.label !== '') && !seen.has(o.value) && (seen.add(o.value), true))
  }
  return []
}

export default function ReceivablePayablePage() {
  const { message } = App.useApp()
  const { useBreakpoint } = Grid
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const isSmall = !screens.lg

  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null)
  const [configChecked, setConfigChecked] = useState(false)
  useEffect(() => {
    const fromEnv = TABLE_IDS.orders ?? ''
    if (fromEnv.trim()) {
      setResolvedTableId(fromEnv)
      setConfigChecked(true)
      return
    }
    fetch('/api/config/table-ids', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { orders?: string | null }) => {
        setResolvedTableId(data?.orders?.trim() ?? '')
        setConfigChecked(true)
      })
      .catch(() => {
        setResolvedTableId('')
        setConfigChecked(true)
      })
  }, [])

  const tableId = resolvedTableId ?? ''
  const { config: moduleConfig } = useModuleConfig('finance-receivable')
  const { schema, records, mappedFields, categorizedFields: categorizedFieldsFromHook, loading, error, refetch } = useTableData({
    tableId,
    filter: (record) => {
      const statusStr = String(getByDataKey(record, 'status') || record.raw['进度'] || record.raw['商务进度'] || '').trim()
      return statusStr !== '报价中' && statusStr !== '签约中'
    },
  })

  const list = useMemo(() => records.map(recordToReceivableItem), [records])

  const categorizedFields = useMemo(() => {
    const filterByVisible = (fieldList: MappedField[]) => {
      if (!moduleConfig || !fieldList?.length) return fieldList ?? []
      const perms = moduleConfig.fieldPermissions
      if (Object.keys(perms).length === 0) return fieldList
      return fieldList.filter((f) => perms[f.fieldId]?.visible !== false)
    }
    const toFinancialKeys = new Set(['receivable', 'received', 'paymentstatus'])
    const toFinancialNames = /^(应收款额|应收|应收款|累计回款|已收|付款状态)$/i
    const isToFinancial = (f: MappedField) =>
      toFinancialKeys.has((f.dataKey || '').toLowerCase()) ||
      toFinancialNames.test((f.fieldName || '').trim()) ||
      toFinancialNames.test((f.displayName || '').trim()) ||
      toFinancialNames.test((f.dataKey || '').trim())
    const basicRaw = [...(categorizedFieldsFromHook.basic ?? []), ...(categorizedFieldsFromHook.other ?? [])]
    const productRaw = categorizedFieldsFromHook.product ?? []
    const financialRaw = categorizedFieldsFromHook.financial ?? []
    const logisticsRaw = categorizedFieldsFromHook.logistics ?? []
    const moveToFinancial = basicRaw.filter(isToFinancial).concat(productRaw.filter(isToFinancial))
    const basicFiltered = filterByVisible(basicRaw.filter((f) => !isToFinancial(f)))
    const productFiltered = filterByVisible(productRaw.filter((f) => !isToFinancial(f)))
    const financialFiltered = filterByVisible([...financialRaw, ...moveToFinancial])
    const logisticsFiltered = filterByVisible(logisticsRaw)
    return {
      basic: basicFiltered,
      product: productFiltered,
      financial: financialFiltered,
      logistics: logisticsFiltered,
    }
  }, [categorizedFieldsFromHook, moduleConfig])

  const allSchemaFields = useMemo(() => [
    ...(categorizedFields.basic ?? []),
    ...(categorizedFields.product ?? []),
    ...(categorizedFields.financial ?? []),
    ...(categorizedFields.logistics ?? []),
  ], [categorizedFields])

  const fieldsForEdit = useMemo(() =>
    allSchemaFields
      .filter((f) => !isFormulaField(f))
      .filter((f) => !moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0 || moduleConfig.fieldPermissions[f.fieldId]?.visible !== false)
      .filter((f) => !moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0 || moduleConfig.fieldPermissions[f.fieldId]?.edit !== false),
  [allSchemaFields, moduleConfig])

  const canEdit = useMemo(() => {
    if (!moduleConfig) return true
    const perms = moduleConfig.fieldPermissions
    if (Object.keys(perms).length === 0) return true
    return allSchemaFields.some((f) => perms[f.fieldId]?.edit !== false)
  }, [moduleConfig, allSchemaFields])

  const visibleDataKeys = useMemo(() => {
    if (!moduleConfig || !mappedFields?.length) return null
    const perms = moduleConfig.fieldPermissions
    if (Object.keys(perms).length === 0) return null
    const keys = new Set<string>()
    mappedFields.forEach((f) => {
      if (perms[f.fieldId]?.visible !== false) {
        keys.add(f.dataKey)
        if (f.fieldName) keys.add(f.fieldName)
      }
    })
    return keys.size === 0 ? new Set<string>() : keys
  }, [moduleConfig, mappedFields])

  const isDataKeyVisible = (dataKey: string): boolean => {
    if (visibleDataKeys === null) return true
    const aliases = FIELD_ALIASES[dataKey] ?? [dataKey]
    return aliases.some((k) => visibleDataKeys.has(k))
  }

  const [searchText, setSearchText] = useState('')
  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  const [cardFilter, setCardFilter] = useState<'all' | 'receivable' | 'received' | 'payable'>('all')
  const [selectedItem, setSelectedItem] = useState<ReceivableItem | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  /** 4 个统计卡片：全部订单 / 应收款项 / 累计回款 / 应付订单，按货币分统计 */
  const summaryStats = useMemo(() => {
    const fmt = (n: number, cur: 'CNY' | 'USD') =>
      (cur === 'USD' ? '$' : '¥') + Math.abs(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const cny = { count: 0, orderAmount: 0, receivable: 0, received: 0, payable: 0 }
    const usd = { count: 0, orderAmount: 0, receivable: 0, received: 0, payable: 0 }
    list.forEach(item => {
      const cur = item.currency === 'USD' ? usd : cny
      cur.count += 1
      cur.orderAmount += item.orderAmount
      cur.receivable += item.receivable
      cur.received += item.received
      cur.payable += item.payable
    })
    return {
      all: { count: list.length, cny: fmt(cny.orderAmount, 'CNY'), usd: fmt(usd.orderAmount, 'USD') },
      receivable: {
        count: list.filter(i => i.receivable > 0).length,
        cny: fmt(list.filter(i => i.currency !== 'USD').reduce((s, i) => s + i.receivable, 0), 'CNY'),
        usd: fmt(list.filter(i => i.currency === 'USD').reduce((s, i) => s + i.receivable, 0), 'USD'),
      },
      received: {
        count: list.filter(i => i.received > 0).length,
        cny: fmt(list.filter(i => i.currency !== 'USD').reduce((s, i) => s + i.received, 0), 'CNY'),
        usd: fmt(list.filter(i => i.currency === 'USD').reduce((s, i) => s + i.received, 0), 'USD'),
      },
      payable: (() => {
        const payables = list.filter(i => /^(部分付款|未付款|待付款)$/.test(i.paymentStatus))
        return {
          count: payables.length,
          cny: fmt(payables.filter(i => i.currency !== 'USD').reduce((s, i) => s + i.payable, 0), 'CNY'),
          usd: fmt(payables.filter(i => i.currency === 'USD').reduce((s, i) => s + i.payable, 0), 'USD'),
        }
      })(),
    }
  }, [list])

  const filteredList = useMemo(() => {
    return list.filter(item => {
      const matchSearch = !searchText ||
        item.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.customer.toLowerCase().includes(searchText.toLowerCase())
      const matchMonth = !monthFilter || item.contractDate.startsWith(monthFilter)
      const matchCard =
        cardFilter === 'all' ||
        (cardFilter === 'receivable' && item.receivable > 0) ||
        (cardFilter === 'received' && item.received > 0) ||
        (cardFilter === 'payable' && /^(部分付款|未付款|待付款)$/.test(item.paymentStatus))
      return matchSearch && matchMonth && matchCard
    })
  }, [list, searchText, monthFilter, cardFilter])

  const handleCardClick = (item: ReceivableItem) => {
    setSelectedItem(item)
    setIsEditing(false)
    setEditForm({})
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedItem(null)
    setIsEditing(false)
    setEditForm({})
  }

  const handleEdit = () => {
    if (!selectedItem) return
    const record = records.find((r) => r.recordId === selectedItem.id)
    if (!record) return
    const formData: Record<string, string> = {}
    fieldsForEdit.forEach((field) => {
      const pf = record.fields[field.fieldId]
      const rawOrParsed = pf?.raw ?? pf?.parsed ?? pf?.formatted
      const value = rawOrParsed != null && rawOrParsed !== '' ? extractVal(rawOrParsed) : '-'
      formData[field.fieldName] = value === '-' ? '' : value
    })
    setEditForm(formData)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedItem) return
    setSaving(true)
    const hideLoading = message.loading('记录保存中...', 0)
    try {
      const response = await fetch(`/api/orders/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: selectedItem.id, fields: editForm }),
      })
      if (response.ok) {
        hideLoading()
        message.success('保存成功')
        setIsEditing(false)
        refetch()
        handleCloseModal()
      } else {
        hideLoading()
        message.error('保存失败')
      }
    } catch {
      hideLoading()
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({})
  }

  const pagePadding = isMobile ? 12 : isSmall ? 16 : 24
  const needConfig = configChecked && !tableId.trim()
  const needSync = tableId.trim() && !loading && !schema

  return (
    <div style={{ padding: pagePadding, background: '#f5f5f7', minHeight: '100%', boxSizing: 'border-box' }}>
      {needConfig && (
        <Alert type="info" showIcon title="请先在 .env.local 中配置 FEISHU_TABLE_ORDERS（oms订单表），保存后重启服务。" style={{ marginBottom: 16 }} />
      )}
      {needSync && (
        <Alert type="warning" showIcon title="请前往 系统管理 → 同步设置 同步 oms订单表 后再查看数据。" style={{ marginBottom: 16 }} />
      )}
      {error && (
        <Alert type="error" showIcon title={error.message} style={{ marginBottom: 16 }} />
      )}

      {/* 统计卡片：全部订单 / 应收款项 / 累计回款 / 应付订单，点击筛选下方订单 */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12 }}>
          {(['all', 'receivable', 'received', 'payable'] as const).map((key) => {
            const config = {
              all: { title: '全部订单合计', color: '#111827', active: cardFilter === 'all' },
              receivable: { title: '应收款项合计', color: '#059669', active: cardFilter === 'receivable' },
              received: { title: '累计回款合计', color: '#2563eb', active: cardFilter === 'received' },
              payable: { title: '应付订单合计', color: '#dc2626', active: cardFilter === 'payable' },
            }[key]
            const stats = summaryStats[key]
            return (
              <Card
                key={key}
                size="small"
                styles={{ body: { padding: 16 } }}
                style={{
                  boxShadow: config.active ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.05)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: config.active ? `2px solid ${config.color}` : undefined,
                }}
                onClick={() => setCardFilter(key)}
                onMouseEnter={(e) => {
                  if (!config.active) {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!config.active) {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }
                }}
              >
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{config.title}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: config.color, marginBottom: key === 'payable' ? 0 : 8 }}>{loading ? '-' : stats.count}</div>
                {key !== 'payable' && (
                  <>
                    <div style={{ fontSize: 12, color: config.color }}>{stats.cny}</div>
                    <div style={{ fontSize: 12, color: config.color }}>{stats.usd}</div>
                  </>
                )}
              </Card>
            )
          })}
        </div>
      </Card>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Space wrap size={isMobile ? 'small' : 'middle'} style={isMobile ? { width: '100%' } : undefined}>
          <Input
            placeholder="搜索订单号、客户..."
            prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: isMobile ? '100%' : 260, borderRadius: 8 }}
            allowClear
          />
          <DatePicker.MonthPicker
            placeholder="按月份筛选"
            style={{ borderRadius: 8 }}
            onChange={(date: Dayjs | null) => setMonthFilter(date ? date.format('YYYY-MM') : null)}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      {/* 卡片列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><Spin description="加载中..." /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredList.map(item => (
            <Card
              key={item.id}
              size="small"
              style={{
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => handleCardClick(item)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1976d2', marginBottom: 4 }}>{item.orderNo}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{item.customer}</div>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                签约日 {item.contractDate}
                {isDataKeyVisible('product') && ` · ${item.product ?? '-'}`}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
                {isDataKeyVisible('orderAmount') && item.orderAmount > 0 && (
                  <span>订单金额 <strong style={{ color: '#111827' }}>{formatMoney(item.orderAmount, item.currency)}</strong></span>
                )}
                {isDataKeyVisible('receivable') && item.receivable > 0 && (
                  <span style={{ color: '#059669' }}>应收 {formatMoney(item.receivable, item.currency)}</span>
                )}
                {isDataKeyVisible('received') && item.received > 0 && (
                  <span style={{ color: '#6b7280' }}>已收 {formatMoney(item.received, item.currency)}</span>
                )}
                {isDataKeyVisible('payable') && item.payable > 0 && (
                  <span style={{ color: '#dc2626' }}>应付 {formatMoney(item.payable, item.currency)}</span>
                )}
                {isDataKeyVisible('paid') && item.paid > 0 && (
                  <span style={{ color: '#6b7280' }}>已付 {formatMoney(item.paid, item.currency)}</span>
                )}
              </div>
            </Card>
          ))}
          {filteredList.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>暂无数据</div>
          )}
        </div>
      )}

      <Modal
        title="应收应付详情"
        open={modalOpen}
        onCancel={handleCloseModal}
        footer={[
          isEditing ? (
            <React.Fragment key="editing">
              <Button key="cancel" onClick={handleCancelEdit}>取消</Button>
              <Button key="save" type="primary" onClick={handleSave} loading={saving}>保存</Button>
            </React.Fragment>
          ) : (
            <React.Fragment key="view">
              {canEdit && <Button key="edit" type="primary" onClick={handleEdit}>编辑</Button>}
              <Button key="close" onClick={handleCloseModal}>关闭</Button>
            </React.Fragment>
          ),
        ]}
        width={640}
      >
        {selectedItem && (() => {
          const selectedRecord = records.find((r) => r.recordId === selectedItem.id)
          if (!selectedRecord) return <div style={{ color: '#6b7280' }}>加载中...</div>
          const rawFields = selectedRecord.raw
          const formattedByFieldId = Object.fromEntries(
            Object.entries(selectedRecord.fields).map(([fid, pf]) => {
              const v = pf.formatted ?? pf.parsed ?? pf.raw
              const str = v != null && v !== '' ? String(v) : '-'
              return [fid, str]
            })
          )
          const basicFields = categorizedFields.basic ?? []
          const productFields = categorizedFields.product ?? []
          const financialFields = categorizedFields.financial ?? []
          const logisticsFields = categorizedFields.logistics ?? []
          const allFieldsForCurrency = [...basicFields, ...financialFields]
          const currencyFieldForVal = allFieldsForCurrency.find(
            (f) => /^(货币|币种|currency)$/i.test(f.fieldName || '') || (f.dataKey || '').toLowerCase() === 'currency'
          )
          const effectiveCurrencyVal = currencyFieldForVal
            ? (formattedByFieldId[currencyFieldForVal.fieldId] ?? getFieldDisplayValue(rawFields, currencyFieldForVal.fieldName))
            : ''
          const displayValue = (field: MappedField, value: string) => {
            if (!isCurrencyAmountField(field)) return value
            const effectiveCurrency = isFixedCnyField(field) ? 'CNY' : (isDynamicCurrencyField(field) ? effectiveCurrencyVal : 'CNY')
            return formatCurrencyDisplay(value, effectiveCurrency || 'CNY')
          }

          if (isEditing) {
            const currencyFieldForEdit = allSchemaFields.find((f) => /^(货币|币种|currency)$/i.test(f.fieldName || '') || (f.dataKey || '').toLowerCase() === 'currency')
            const currencyValForEdit = currencyFieldForEdit
              ? (editForm[currencyFieldForEdit.fieldName] ?? formattedByFieldId[currencyFieldForEdit.fieldId] ?? getFieldDisplayValue(rawFields, currencyFieldForEdit.fieldName))
              : ''
            const editableIds = new Set(fieldsForEdit.map((f) => f.fieldId))
            const basicEditable = basicFields.filter((f) => editableIds.has(f.fieldId))
            const productEditable = productFields.filter((f) => editableIds.has(f.fieldId))
            const financialEditable = financialFields.filter((f) => editableIds.has(f.fieldId))
            const logisticsEditable = logisticsFields.filter((f) => editableIds.has(f.fieldId))

            const renderEditField = (field: MappedField, idx: number) => {
              const formatted = formattedByFieldId[field.fieldId]
              const rawDisplay = getFieldDisplayValue(rawFields, field.fieldName)
              const fallback = (formatted && formatted !== '-') ? formatted : (rawDisplay === '-' ? '' : rawDisplay)
              const value = editForm[field.fieldName] ?? fallback
              const fieldType = Number(field.fieldType) || 1
              const options = getSelectOptions(field)
              const isCurrency = isCurrencyAmountField(field)
              const isPercentage = isPercentageField(field)
              const labelColor = isRedLabelField(field) ? '#dc2626' : '#6b7280'
              const label = <div style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>{field.displayName}</div>
              if (isDateField(field) || fieldType === 5) {
                return (
                  <div key={field.fieldId ?? `edit-${idx}`}>
                    {label}
                    <DatePicker style={{ width: '100%' }} value={value && dayjs(value).isValid() ? dayjs(value) : null} onChange={(d, dateStr) => setEditForm({ ...editForm, [field.fieldName]: dateStr ?? '' })} />
                  </div>
                )
              }
              if (fieldType === 1 || fieldType === 3) {
                if (options.length > 0) {
                  return (
                    <div key={field.fieldId ?? `edit-${idx}`}>
                      {label}
                      <Select allowClear placeholder={`请选择${field.fieldName}`} options={options} value={value || undefined} onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v ?? '' })} style={{ width: '100%' }} />
                    </div>
                  )
                }
              }
              if (fieldType === 4 && options.length > 0) {
                const arr = value ? String(value).split(',').filter(Boolean) : []
                return (
                  <div key={field.fieldId ?? `edit-${idx}`}>
                    {label}
                    <Select mode="multiple" allowClear placeholder={`请选择${field.fieldName}`} options={options} value={arr} onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: (v || []).join(',') })} style={{ width: '100%' }} />
                  </div>
                )
              }
              if (fieldType === 2) {
                const sym = isCurrency ? (isFixedCnyField(field) ? '¥' : (getCurrencySymbol(currencyValForEdit) || '¥')) : ''
                const suffix = isPercentage ? '%' : undefined
                return (
                  <div key={field.fieldId ?? `edit-${idx}`}>
                    {label}
                    {sym ? (
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff' }}>
                        <span style={{ padding: '4px 11px', color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>{sym}</span>
                        <Input type="number" placeholder={`请输入${field.fieldName}`} suffix={suffix} variant="borderless" style={{ flex: 1, paddingLeft: 0 }} value={value} onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })} />
                      </div>
                    ) : (
                      <Input type="number" placeholder={`请输入${field.fieldName}`} suffix={suffix} value={value} onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })} />
                    )}
                  </div>
                )
              }
              if (fieldType === 7) {
                const boolVal = value === 'true' || value === '是' || value === '1'
                return (
                  <div key={field.fieldId ?? `edit-${idx}`}>
                    {label}
                    <Select value={boolVal ? 'true' : 'false'} onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v === 'true' ? '是' : '否' })} style={{ width: '100%' }} options={[{ label: '是', value: 'true' }, { label: '否', value: 'false' }]} />
                  </div>
                )
              }
              if (options.length > 0) {
                return (
                  <div key={field.fieldId ?? `edit-${idx}`}>
                    {label}
                    <Select allowClear placeholder={`请选择${field.fieldName}`} options={options} value={value || undefined} onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v ?? '' })} style={{ width: '100%' }} />
                  </div>
                )
              }
              return (
                <div key={field.fieldId ?? `edit-${idx}`}>
                  {label}
                  <Input placeholder={`请输入${field.fieldName}`} value={value} onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })} />
                </div>
              )
            }

            return (
              <div>
                {basicEditable.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>基础信息</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      {basicEditable.map((field, idx) => renderEditField(field, idx))}
                    </div>
                  </>
                )}
                {productEditable.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>产品信息</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      {productEditable.map((field, idx) => renderEditField(field, idx))}
                    </div>
                  </>
                )}
                {financialEditable.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>商务信息</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      {financialEditable.map((field, idx) => renderEditField(field, idx))}
                    </div>
                  </>
                )}
                {logisticsEditable.length > 0 && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>物流信息</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {logisticsEditable.map((field, idx) => renderEditField(field, idx))}
                    </div>
                  </>
                )}
              </div>
            )
          }

          return (
            <div>
              {basicFields.length > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>基础信息</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {basicFields.map((field, idx) => {
                      const value = formattedByFieldId[field.fieldId] ?? getFieldDisplayValue(rawFields, field.fieldName)
                      const labelColor = isRedLabelField(field) ? '#dc2626' : '#6b7280'
                      return (
                        <div key={field.fieldId ?? `basic-${idx}`}>
                          <div style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>{field.displayName}</div>
                          <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {productFields.length > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>产品信息</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {productFields.map((field, idx) => {
                      const value = formattedByFieldId[field.fieldId] ?? getFieldDisplayValue(rawFields, field.fieldName)
                      const labelColor = isRedLabelField(field) ? '#dc2626' : '#6b7280'
                      return (
                        <div key={field.fieldId ?? `product-${idx}`}>
                          <div style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>{field.displayName}</div>
                          <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {financialFields.length > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>商务信息</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    {financialFields.map((field, idx) => {
                      const value = formattedByFieldId[field.fieldId] ?? getFieldDisplayValue(rawFields, field.fieldName)
                      const labelColor = isRedLabelField(field) ? '#dc2626' : '#6b7280'
                      return (
                        <div key={field.fieldId ?? `financial-${idx}`}>
                          <div style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>{field.displayName}</div>
                          <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
              {logisticsFields.length > 0 && (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>物流信息</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {logisticsFields.map((field, idx) => {
                      const value = formattedByFieldId[field.fieldId] ?? getFieldDisplayValue(rawFields, field.fieldName)
                      const labelColor = isRedLabelField(field) ? '#dc2626' : '#6b7280'
                      return (
                        <div key={field.fieldId ?? `logistics-${idx}`}>
                          <div style={{ fontSize: 12, color: labelColor, marginBottom: 4 }}>{field.displayName}</div>
                          <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
