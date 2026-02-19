'use client'

import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { App, Card, Tabs, Input, Button, Tag, Progress, Spin, Alert, DatePicker, Popover, Modal, Select } from 'antd'
import { TABLE_IDS } from '@/lib/config/env'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import {
  SearchOutlined,
  ReloadOutlined,
  CalendarOutlined,
  TruckOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  GiftOutlined,
  FileTextOutlined,
  CarOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  FlagOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { useModuleConfig } from '@/app/hooks/useModuleConfig'
import { useTableData, type TableRecord } from '@/app/hooks/useTableData'
import type { MappedField } from '@/lib/feishu/field-mapping'
import { getLogisticsAlertParams } from '@/lib/config/alert-rules'

// 物流订单状态类型
type LogisticsStatus = '未发货' | '已发货' | '已清关' | '已订舱' | '已发船' | '已到港'

// 物流视图项（由 TableRecord 派生，仅用于展示）
interface LogisticsOrder {
  id: string
  orderNo: string
  company: string
  fromPort: string
  toPort: string
  carrier: string
  bl: string
  product: string
  spec: string
  status: LogisticsStatus
  etd: string
  eta: string
  progress: number
  alertMessage?: string
  alertType?: 'info' | 'warning' | 'error'
  rawFields: Record<string, unknown>
  /** 与订单模块一致：按 fieldId 的格式化展示值（来自数据层 record.fields） */
  formattedByFieldId: Record<string, string>
}

// 预警规则（从 config/alert-rules.json 读取，见 getLogisticsAlertParams）
interface AlertRules {
  arrivingDays: number
  delayDays: number
}

// 流程状态定义
const flowSteps = ['未发货', '已订舱', '已发货', '已清关', '已发船', '已到港']
const statusOrder = ['未发货', '已订舱', '已发货', '已清关', '已发船', '已到港']

// 状态颜色映射
const statusColors: Record<string, { bg: string; color: string }> = {
  '未发货': { bg: '#f3f4f6', color: '#6b7280' },
  '已发货': { bg: '#fef3c7', color: '#d97706' },
  '已清关': { bg: '#dbeafe', color: '#2563eb' },
  '已订舱': { bg: '#e0e7ff', color: '#4f46e5' },
  '已发船': { bg: '#d1fae5', color: '#059669' },
  '已到港': { bg: '#fce7f3', color: '#db2777' },
}

// 国风配色
const guofengColors = [
  { bg: 'rgba(232, 213, 196, 0.3)', activeBg: 'rgba(232, 213, 196, 0.8)', icon: GiftOutlined, label: '未发货' },
  { bg: 'rgba(212, 229, 210, 0.3)', activeBg: 'rgba(212, 229, 210, 0.8)', icon: FileTextOutlined, label: '已订舱' },
  { bg: 'rgba(232, 212, 212, 0.3)', activeBg: 'rgba(232, 212, 212, 0.8)', icon: CarOutlined, label: '已发货' },
  { bg: 'rgba(212, 226, 232, 0.3)', activeBg: 'rgba(212, 226, 232, 0.8)', icon: SafetyCertificateOutlined, label: '已清关' },
  { bg: 'rgba(232, 224, 212, 0.3)', activeBg: 'rgba(232, 224, 212, 0.8)', icon: ShopOutlined, label: '已发船' },
  { bg: 'rgba(216, 212, 232, 0.3)', activeBg: 'rgba(216, 212, 232, 0.8)', icon: FlagOutlined, label: '已到港' },
]

// 提取字段值（支持飞书 raw 对象 { type, value } / { text } / { name }）
function extractFieldValue(value: unknown): string {
  if (value == null || value === '') return '-'
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]
    if (typeof first === 'object' && first !== null) {
      const o = first as Record<string, unknown>
      return String(o.value ?? o.text ?? o.name ?? '-')
    }
    return String(first)
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    return String(o.value ?? o.text ?? o.name ?? '-')
  }
  return String(value) || '-'
}

// 格式化日期
function formatDateYYYYMMDD(value: unknown): string {
  if (!value) return '-'
  try {
    const date = new Date(typeof value === 'number' ? value : String(value))
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    return '-'
  }
  return '-'
}

// 获取字段显示值（从 raw 或 record.fields 取）
function getFieldDisplayValue(rawFields: Record<string, unknown>, fieldName: string): string {
  const value = rawFields[fieldName]
  return extractFieldValue(value)
}

function isDateField(field: MappedField): boolean {
  const fn = (field.fieldName || '').trim()
  const fid = (field.fieldId || '').trim()
  return (
    /date|Date|time|Time|ETD|ETA|updated|更新/i.test(fid) ||
    /日期|签约日|时间|ETD|ETA|更新/.test(fn)
  )
}

function isCurrencyField(field: MappedField): boolean {
  const fid = field.fieldId || ''
  const fn = field.fieldName || ''
  const dk = (field.dataKey || '').toLowerCase()
  return (
    /amount|Amount|Price|price|Cost|cost|fee|Fee|refund|Refund|tax|Tax/.test(fid) ||
    /金额|单价|成本|费用|退税|税费|毛利|海运|杂费/.test(fn) ||
    /amount|unitprice|grossprofit|taxrefund|purchasecost|shipping/.test(dk)
  )
}

/** 公式字段：fieldType 20/21 或按字段名，只显示不可编辑 */
function isFormulaField(field: MappedField): boolean {
  const ft = Number(field.fieldType) ?? 1
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

/** 根据「货币」字段取值返回货币符号，与订单页一致（支持 USD/美元/CNY/人民币 等） */
function getCurrencySymbol(currency: unknown): string {
  const s = String(currency ?? '').trim().toUpperCase()
  if (s === 'USD' || s.includes('美元') || s.includes('DOLLAR')) return '$'
  if (s === 'CNY' || s === 'RMB' || s.includes('人民币')) return '¥'
  return ''
}

/** 金额字段展示：去除已有符号后按货币字段动态加符号 */
function formatCurrencyDisplay(value: string, currencyVal: unknown): string {
  if (!value || value === '-') return value
  const sym = getCurrencySymbol(currencyVal) || '¥'
  const numPart = value.replace(/^[$¥€£]\s*/, '').trim()
  return numPart ? `${sym}${numPart}` : value
}

function isPercentageField(field: MappedField): boolean {
  const fid = field.fieldId || ''
  const fn = field.fieldName || ''
  const dk = field.dataKey || ''
  return (
    /rate|Rate|percent|Percent/.test(fid) ||
    dk === 'grossProfitRate' || dk === 'invoiceTaxRate' ||
    /率|税率|毛利率/.test(fn)
  )
}

/** 飞书单选/多选：从 property.options 解析选项，与订单模块一致 */
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

/** 按 dataKey 从 TableRecord 取展示值（record.fields 的 key 为飞书 fieldId，需通过 meta.dataKey 匹配） */
function getByDataKey(record: TableRecord, dataKey: string): string {
  const pf = Object.values(record.fields).find(
    (p) => (p.meta as { dataKey?: string } | undefined)?.dataKey === dataKey
  )
  if (pf != null) {
    const v = pf.formatted ?? pf.parsed ?? pf.raw
    if (v != null && v !== '') return extractFieldValue(v)
  }
  const rawVal = record.raw[dataKey]
  if (rawVal != null && rawVal !== '') return extractFieldValue(rawVal)
  const rawKeys: Record<string, string[]> = {
    id: ['订单号', 'id'],
    customer: ['客户', '公司', 'customer'],
    origin: ['出发地', '起运港', 'origin'],
    destination: ['目的地', '目的港', 'destination'],
    forwarder: ['货代', 'forwarder', 'carrier'],
    blNumber: ['提单', '提单号', 'BL', 'blNumber'],
    product: ['产品', 'product', '货品'],
    spec: ['规格', '详细规格', 'spec'],
    etd: ['ETD', 'etd', '预计离港'],
    eta: ['ETA', 'eta', '预计到港'],
    status: ['进度', '状态', '商务进度', 'status'],
    logisticsProgress: ['物流', '物流进度', 'logisticsProgress'],
  }
  for (const k of rawKeys[dataKey] ?? []) {
    const v = record.raw[k]
    if (v != null && v !== '') return extractFieldValue(v)
  }
  return '-'
}

const LOGISTICS_STATUS_MAP: Record<string, LogisticsStatus> = {
  '未发货': '未发货', '已发货': '已发货', '已清关': '已清关', '已订舱': '已订舱', '已发船': '已发船', '已到港': '已到港',
  '运输中': '已发船', '完成': '已到港', '待发货': '未发货', '发货中': '已发货', '清关中': '已清关', '订舱中': '已订舱', '发船中': '已发船', '到港': '已到港',
}

function recordToLogisticsView(
  record: TableRecord,
  alertRules: AlertRules
): LogisticsOrder {
  const statusStr = getByDataKey(record, 'status') || getByDataKey(record, 'logisticsProgress')
  const logisticsStr = getByDataKey(record, 'logisticsProgress') || '未发货'
  const status = LOGISTICS_STATUS_MAP[String(logisticsStr)] ?? '未发货'

  const etdRaw = getByDataKey(record, 'etd')
  const etaRaw = getByDataKey(record, 'eta')
  const etdStr = etdRaw !== '-' ? etdRaw : (record.raw['ETD'] ?? record.raw['etd']) != null ? extractFieldValue(record.raw['ETD'] ?? record.raw['etd']) : null
  const etaStr = etaRaw !== '-' ? etaRaw : (record.raw['ETA'] ?? record.raw['eta']) != null ? extractFieldValue(record.raw['ETA'] ?? record.raw['eta']) : null
  const etdDate = (etdStr && etdStr !== '-') ? new Date(String(etdStr)) : null
  const etaDate = (etaStr && etaStr !== '-') ? new Date(String(etaStr)) : null
  const now = new Date()

  let progress = 0
  let alertMessage: string | undefined
  let alertType: 'info' | 'warning' | 'error' | undefined

  if (!etdDate || isNaN(etdDate.getTime()) || !etaDate || isNaN(etaDate.getTime())) {
    progress = 0
    alertMessage = '请确认ETD/ETA时间'
    alertType = 'warning'
  } else if (status === '已到港') {
    progress = 100
  } else {
    const totalDuration = etaDate.getTime() - etdDate.getTime()
    const elapsed = now.getTime() - etdDate.getTime()
    progress = totalDuration > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100))) : 0
    const daysToEta = Math.ceil((etaDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const daysOverdue = Math.ceil((now.getTime() - etaDate.getTime()) / (1000 * 60 * 60 * 24))
    if (now > etaDate && daysOverdue >= alertRules.delayDays) {
      alertMessage = `超过到港日期${daysOverdue}天，请确认物流进度`
      alertType = 'error'
    } else if (daysToEta <= alertRules.arrivingDays && daysToEta > 0) {
      alertMessage = `请注意：货物在未来${daysToEta}天内到港`
      alertType = 'info'
    }
  }

  const formatDateDisplay = (val: string | null | undefined): string => {
    if (!val || val === '-') return '-'
    try {
      const d = new Date(val)
      return !isNaN(d.getTime()) ? d.toISOString().split('T')[0]! : (val.length >= 10 ? val.substring(0, 10) : val)
    } catch {
      return val.length >= 10 ? val.substring(0, 10) : val
    }
  }

  const etdDisplay = etdDate && !isNaN(etdDate.getTime()) ? etdDate.toISOString().split('T')[0]! : formatDateDisplay(etdRaw !== '-' ? etdRaw : null)
  const etaDisplay = etaDate && !isNaN(etaDate.getTime()) ? etaDate.toISOString().split('T')[0]! : formatDateDisplay(etaRaw !== '-' ? etaRaw : null)

  return {
    id: record.recordId,
    orderNo: getByDataKey(record, 'id') !== '-' ? getByDataKey(record, 'id') : record.recordId,
    company: getByDataKey(record, 'customer'),
    fromPort: getByDataKey(record, 'origin'),
    toPort: getByDataKey(record, 'destination'),
    carrier: getByDataKey(record, 'forwarder'),
    bl: getByDataKey(record, 'blNumber'),
    product: getByDataKey(record, 'product'),
    spec: getByDataKey(record, 'spec'),
    status,
    etd: etdDisplay,
    eta: etaDisplay,
    progress,
    alertMessage,
    alertType,
    rawFields: record.raw,
    formattedByFieldId: Object.fromEntries(
      Object.entries(record.fields).map(([fid, pf]) => {
        const v = pf.formatted ?? pf.parsed ?? pf.raw
        const str = v != null && v !== '' ? String(v) : '-'
        return [fid, str]
      })
    ),
  }
}

export default function LogisticsPage() {
  const { message } = App.useApp()

  // 与订单页一致：先尝试 env，再通过服务端 API 解析 tableId
  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null)
  useEffect(() => {
    const fromEnv = TABLE_IDS.orders ?? ''
    if (fromEnv.trim()) {
      setResolvedTableId(fromEnv)
      return
    }
    fetch('/api/config/table-ids')
      .then((r) => r.json())
      .then((data: { orders?: string | null }) => {
        const id = data?.orders?.trim() ?? ''
        setResolvedTableId(id)
      })
      .catch(() => setResolvedTableId(''))
  }, [])

  const tableId = resolvedTableId ?? ''
  const { config: moduleConfig } = useModuleConfig('logistics')
  const {
    records,
    loading,
    error,
    refetch,
    categorizedFields: categorizedFieldsFromHook,
  } = useTableData({
    tableId,
    filter: (record) => {
      const statusStr = String(getByDataKey(record, 'status') || record.raw['进度'] || record.raw['商务进度'] || '').trim()
      return statusStr !== '报价中' && statusStr !== '签约中'
    },
  })

  const alertRules = useMemo<AlertRules>(() => getLogisticsAlertParams(), [])
  const [activeTab, setActiveTab] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<LogisticsOrder | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const categorizedFields = useMemo(() => {
    const filterByVisible = (fieldList: MappedField[]) => {
      if (!moduleConfig || !fieldList?.length) return fieldList ?? []
      const perms = moduleConfig.fieldPermissions
      if (Object.keys(perms).length === 0) return fieldList
      return fieldList.filter((f) => perms[f.fieldId]?.visible !== false)
    }
    return {
      basic: filterByVisible(categorizedFieldsFromHook.basic ?? []),
      logistics: filterByVisible(categorizedFieldsFromHook.logistics ?? []),
      product: filterByVisible(categorizedFieldsFromHook.product ?? []),
      financial: filterByVisible(categorizedFieldsFromHook.financial ?? []),
      other: filterByVisible(categorizedFieldsFromHook.other ?? []),
    }
  }, [categorizedFieldsFromHook, moduleConfig])

  const orders = useMemo(
    () => records.map((r) => recordToLogisticsView(r, alertRules)),
    [records, alertRules]
  )

  const canEdit = useMemo(() => {
    if (!moduleConfig) return true
    const perms = moduleConfig.fieldPermissions
    if (Object.keys(perms).length === 0) return true
    const allFields = [
      ...(categorizedFieldsFromHook.basic ?? []),
      ...(categorizedFieldsFromHook.logistics ?? []),
      ...(categorizedFieldsFromHook.product ?? []),
      ...(categorizedFieldsFromHook.financial ?? []),
      ...(categorizedFieldsFromHook.other ?? []),
    ]
    return allFields.some((f) => perms[f.fieldId]?.edit !== false)
  }, [moduleConfig, categorizedFieldsFromHook])

  // 统计数据
  const stats = useMemo(() => ({
    total: orders.length,
    arriving: orders.filter(o => o.status === '已发船' || o.status === '已到港').length,
    warning: orders.filter(o => o.alertType === 'error').length,
    customs: orders.filter(o => o.status === '已发货' || o.status === '已清关').length,
  }), [orders])

  // 筛选订单
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesTab = activeTab === 'all' || order.status === activeTab
      const matchesSearch = !searchText ||
        order.orderNo.toLowerCase().includes(searchText.toLowerCase()) ||
        order.company.toLowerCase().includes(searchText.toLowerCase()) ||
        order.product.toLowerCase().includes(searchText.toLowerCase()) ||
        order.spec.toLowerCase().includes(searchText.toLowerCase())

      let matchesMonth = true
      if (selectedMonth) {
        const orderEtdMonth = order.etd !== '-' ? order.etd.substring(0, 7) : null
        const orderEtaMonth = order.eta !== '-' ? order.eta.substring(0, 7) : null
        matchesMonth = orderEtdMonth === selectedMonth || orderEtaMonth === selectedMonth
      }

      return matchesTab && matchesSearch && matchesMonth
    }).sort((a, b) => {
      const alertSortOrder = (o: LogisticsOrder) =>
        o.alertType === 'error' ? 0 : o.alertType === 'info' ? 1 : o.alertType === 'warning' ? 2 : 3
      const aHasAlert = !!a.alertMessage
      const bHasAlert = !!b.alertMessage

      if (aHasAlert && !bHasAlert) return -1
      if (!aHasAlert && bHasAlert) return 1
      if (aHasAlert && bHasAlert) return alertSortOrder(a) - alertSortOrder(b)

      const aArrived = a.status === '已到港'
      const bArrived = b.status === '已到港'
      if (!aArrived && bArrived) return -1
      if (aArrived && !bArrived) return 1

      return 0
    })
  }, [orders, activeTab, searchText, selectedMonth])

  // Tab 项目
  const tabItems = [
    { key: 'all', label: `全部订单 (${orders.length})` },
    { key: '未发货', label: `未发货 (${orders.filter(o => o.status === '未发货').length})` },
    { key: '已订舱', label: `已订舱 (${orders.filter(o => o.status === '已订舱').length})` },
    { key: '已发货', label: `已发货 (${orders.filter(o => o.status === '已发货').length})` },
    { key: '已清关', label: `已清关 (${orders.filter(o => o.status === '已清关').length})` },
    { key: '已发船', label: `已发船 (${orders.filter(o => o.status === '已发船').length})` },
    { key: '已到港', label: `已到港 (${orders.filter(o => o.status === '已到港').length})` },
  ]

  const handleMonthChange = (date: Dayjs | null) => {
    const monthStr = date ? date.format('YYYY-MM') : null
    setSelectedMonth(monthStr)
    setMonthPickerOpen(false)
  }

  const handleRefresh = useCallback(async () => {
    await refetch()
    message.success('数据已刷新')
  }, [refetch, message])

  const handleOrderClick = (order: LogisticsOrder) => {
    setSelectedOrder(order)
    setModalOpen(true)
    setIsEditing(false)
    setEditForm({})
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedOrder(null)
    setIsEditing(false)
    setEditForm({})
  }

  const handleEdit = () => {
    if (!selectedOrder) return
    const record = records.find((r) => r.recordId === selectedOrder.id)
    const formData: Record<string, string> = {}
    const allForEdit = [
      ...(categorizedFields.basic || []),
      ...(categorizedFields.logistics || []),
      ...(categorizedFields.product || []),
      ...(categorizedFields.financial || []),
      ...(categorizedFields.other || []),
    ].filter((f) => !moduleConfig || moduleConfig.fieldPermissions[f.fieldId]?.edit !== false)
    allForEdit.forEach((field) => {
      // 优先从 record.fields 取 raw/parsed（可编辑原始值），再回退到 formatted 和 rawFields
      let value: string
      if (record?.fields?.[field.fieldId]) {
        const pf = record.fields[field.fieldId]
        const rawOrParsed = pf.raw ?? pf.parsed ?? pf.formatted
        value = rawOrParsed != null && rawOrParsed !== '' ? extractFieldValue(rawOrParsed) : '-'
      } else {
        value = selectedOrder.formattedByFieldId?.[field.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
      }
      formData[field.fieldName] = value === '-' ? '' : value
    })
    setEditForm(formData)
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!selectedOrder) return
    setSaving(true)
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: selectedOrder.id, fields: editForm }),
      })
      if (response.ok) {
        message.success('保存成功')
        setIsEditing(false)
        refetch()
        handleCloseModal()
      } else {
        message.error('保存失败')
      }
    } catch {
      message.error('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({})
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          title="数据加载失败"
          description={error.message}
          type="error"
          showIcon
          action={
            <Button onClick={handleRefresh} type="primary">
              重试
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%' }}>
      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24
      }}>
        <Card
          size="small"
          style={{
            background: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
            borderRadius: 12,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
          }}
          styles={{ body: { padding: 16 } }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(25, 118, 210, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TruckOutlined style={{ color: '#1976d2', fontSize: 18 }} />
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>在途订单总数</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {loading ? <Spin size="small" /> : stats.total}
          </div>
          <div style={{ fontSize: 12, color: '#1976d2' }}>点击查看全部</div>
        </Card>

        <Card
          size="small"
          style={{
            background: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
            borderRadius: 12,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
          }}
          styles={{ body: { padding: 16 } }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircleOutlined style={{ color: '#10b981', fontSize: 18 }} />
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>即将到港</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {loading ? <Spin size="small" /> : stats.arriving}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>未来7天内到港</div>
        </Card>

        <Card
          size="small"
          style={{
            background: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
            borderRadius: 12,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
          }}
          styles={{ body: { padding: 16 } }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <WarningOutlined style={{ color: '#ef4444', fontSize: 18 }} />
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>延误预警</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {loading ? <Spin size="small" /> : stats.warning}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>需要立即关注</div>
        </Card>

        <Card
          size="small"
          style={{
            background: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
            borderRadius: 12,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
          }}
          styles={{ body: { padding: 16 } }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.06)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <InboxOutlined style={{ color: '#f59e0b', fontSize: 18 }} />
            </div>
            <span style={{ fontSize: 13, color: '#6b7280' }}>清关处理中</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {loading ? <Spin size="small" /> : stats.customs}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>已发货未发船</div>
        </Card>
      </div>

      {/* Progress Flow */}
      <Card size="small" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>物流状态流程</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {guofengColors.map((color, index) => {
            const IconComponent = color.icon
            const isActive = activeTab === color.label
            const orderCount = orders.filter(o => o.status === color.label).length
            const isLast = index === guofengColors.length - 1
            return (
              <React.Fragment key={color.label}>
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: isActive ? color.activeBg : color.bg,
                    transition: 'all 0.3s',
                    minWidth: 0,
                  }}
                  onClick={() => setActiveTab(isActive ? 'all' : color.label)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isActive ? '#374151' : '#6b7280',
                  }}>
                    <IconComponent style={{ fontSize: 14 }} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#374151', fontWeight: isActive ? 600 : 400 }}>
                      {color.label}
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280' }}>
                      {orderCount}单
                    </div>
                  </div>
                </div>
                {!isLast && (
                  <div
                    style={{
                      flex: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      minWidth: 32,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 2,
                          borderRadius: 1,
                          background: 'linear-gradient(90deg, #94a3b8 0%, #64748b 100%)',
                        }}
                      />
                      <div
                        style={{
                          width: 0,
                          height: 0,
                          marginLeft: 2,
                          borderTop: '5px solid transparent',
                          borderBottom: '5px solid transparent',
                          borderLeft: '8px solid #64748b',
                        }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </Card>

      {/* Tabs */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
        style={{ marginBottom: 16 }}
      />

      {/* Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 16 
      }}>
        <Input
          placeholder="搜索订单号、客户或产品..."
          prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 280, borderRadius: 8 }}
          allowClear
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Popover
            content={
              <DatePicker
                picker="month"
                format="YYYY-MM"
                onChange={handleMonthChange}
                value={selectedMonth ? dayjs(selectedMonth) : null}
                allowClear
                autoFocus
              />
            }
            trigger="click"
            open={monthPickerOpen}
            onOpenChange={setMonthPickerOpen}
          >
            <Button 
              icon={<CalendarOutlined />}
              type={selectedMonth ? 'primary' : 'default'}
              style={{ borderRadius: 8 }}
            >
              {selectedMonth ? selectedMonth : '月历'}
            </Button>
          </Popover>
          {selectedMonth && (
            <Button 
              size="small" 
              onClick={() => setSelectedMonth(null)}
              style={{ borderRadius: 4 }}
            >
              清除
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} style={{ borderRadius: 8 }}>
            刷新
          </Button>
        </div>
      </div>

      {/* Order Cards */}
      <Spin spinning={loading} description="加载中...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredOrders.map(order => (
            <Card
              key={order.id}
              size="small"
              style={{
                borderRadius: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => handleOrderClick(order)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1976d2', marginBottom: 4 }}>
                    {order.orderNo}
                  </div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>{order.company}</div>
                </div>
                {order.alertMessage && (
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 12,
                    color: order.alertType === 'error' ? '#dc2626' : order.alertType === 'warning' ? '#d97706' : '#2563eb',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}>
                    {order.alertType === 'error' ? (
                      <ExclamationCircleOutlined style={{ fontSize: 14 }} />
                    ) : order.alertType === 'warning' ? (
                      <WarningOutlined style={{ fontSize: 14 }} />
                    ) : (
                      <InfoCircleOutlined style={{ fontSize: 14 }} />
                    )}
                    {order.alertMessage}
                  </div>
                )}
                <Tag
                  style={{
                    borderRadius: 9999,
                    border: 'none',
                    background: statusColors[order.status].bg,
                    color: statusColors[order.status].color,
                    fontWeight: 500,
                  }}
                >
                  {order.status}
                </Tag>
              </div>

              <div style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {order.fromPort} <span style={{ color: '#6b7280', margin: '0 8px' }}></span> {order.toPort}
              </div>

              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <span style={{ color: '#111827', fontWeight: 500 }}>{order.product}</span>
                <span>{order.spec}</span>
                <span>{order.carrier}</span>
                <span>BL: {order.bl}</span>
              </div>

              <Progress
                percent={order.progress}
                strokeColor={order.alertType === 'error' ? '#ef4444' : order.alertType === 'warning' ? '#f59e0b' : '#1976d2'}
                showInfo={false}
                style={{ marginBottom: 8 }}
              />

              <div style={{
                fontSize: 12,
                color: '#6b7280',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>ETD {order.etd}</span>
                <span>{order.progress}%</span>
                <span>ETA {order.eta}</span>
              </div>
            </Card>
          ))}

          {filteredOrders.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
              暂无数据
            </div>
          )}
        </div>
      </Spin>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600 }}>订单详情</span>
            {selectedOrder && (
              <Tag
                style={{
                  borderRadius: 9999,
                  border: 'none',
                  background: statusColors[selectedOrder.status].bg,
                  color: statusColors[selectedOrder.status].color,
                  fontWeight: 500,
                }}
              >
                {selectedOrder.status}
              </Tag>
            )}
          </div>
        }
        open={modalOpen}
        onCancel={handleCloseModal}
        footer={[
          isEditing ? (
            <React.Fragment key="editing">
              <Button key="cancel" onClick={handleCancelEdit}>
                取消
              </Button>
              <Button key="save" type="primary" onClick={handleSave} loading={saving}>
                保存
              </Button>
            </React.Fragment>
          ) : (
            <React.Fragment key="view">
              {canEdit && (
                <Button key="edit" type="primary" onClick={handleEdit}>
                  编辑
                </Button>
              )}
              <Button key="close" onClick={handleCloseModal}>
                关闭
              </Button>
            </React.Fragment>
          ),
        ]}
        width={720}
      >
        {selectedOrder && (
          <div style={{ padding: '16px 0' }}>
            {selectedOrder.alertMessage && (
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: selectedOrder.alertType === 'error' ? '#fef2f2' : selectedOrder.alertType === 'warning' ? '#fffbeb' : '#eff6ff',
                color: selectedOrder.alertType === 'error' ? '#dc2626' : selectedOrder.alertType === 'warning' ? '#d97706' : '#2563eb',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 500,
              }}>
                {selectedOrder.alertType === 'error' ? (
                  <ExclamationCircleOutlined />
                ) : selectedOrder.alertType === 'warning' ? (
                  <WarningOutlined />
                ) : (
                  <InfoCircleOutlined />
                )}
                {selectedOrder.alertMessage}
              </div>
            )}

            {(() => {
              // 使用 categorizedFields 动态生成详情
              const basicFields = categorizedFields.basic || []
              const logisticsFields = categorizedFields.logistics || []
              const productFields = categorizedFields.product || []
              const financialFields = categorizedFields.financial || []
              const allSchemaFields = [
                ...basicFields,
                ...logisticsFields,
                ...productFields,
                ...financialFields,
                ...(categorizedFields.other || [])
              ]
              const fieldsForEdit = allSchemaFields
                .filter((f) => !isFormulaField(f))
                .filter((f) => !moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0 || moduleConfig.fieldPermissions[f.fieldId]?.visible !== false)
                .filter((f) => !moduleConfig || Object.keys(moduleConfig.fieldPermissions).length === 0 || moduleConfig.fieldPermissions[f.fieldId]?.edit !== false)

              if (!isEditing) {
                const currencyField = allSchemaFields.find((f) => /^(货币|币种|currency)$/i.test(f.fieldName || '') || (f.dataKey || '').toLowerCase() === 'currency')
                const currencyVal = currencyField
                  ? (selectedOrder.formattedByFieldId?.[currencyField.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, currencyField.fieldName))
                  : ''
                // 订单金额：货币=USD→$，货币=CNY→¥，默认CNY；采购成本/海运及保险/其他费用：固定¥
                const isFixedCnyField = (f: MappedField) => {
                  const fn = (f.fieldName || '').trim()
                  const dk = (f.dataKey || '').toLowerCase()
                  return /^(采购成本|海运及保险|其他费用)$/i.test(fn) || ['purchasecost', 'shippinginsurance', 'otherfees'].includes(dk)
                }
                const isOrderAmountField = (f: MappedField) => {
                  const fn = (f.fieldName || '').trim()
                  const dk = (f.dataKey || '').toLowerCase()
                  return /^订单金额$/i.test(fn) && !/CNY/i.test(fn) || dk === 'amount'
                }
                const displayValue = (field: MappedField, value: string) => {
                  if (!isCurrencyField(field)) return value
                  const effectiveCurrency = isFixedCnyField(field) ? 'CNY' : (isOrderAmountField(field) ? currencyVal : 'CNY')
                  return formatCurrencyDisplay(value, effectiveCurrency || 'CNY')
                }

                return (
                  <div>
                    {basicFields.length > 0 && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                          基础信息
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                          {basicFields.map((field, idx) => {
                            const value = selectedOrder.formattedByFieldId?.[field.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
                            return (
                              <div key={field.fieldId ?? `basic-${idx}`}>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{field.displayName}</div>
                                <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                    
                    {logisticsFields.length > 0 && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                          物流信息
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                          {logisticsFields.map((field, idx) => {
                            const value = selectedOrder.formattedByFieldId?.[field.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
                            return (
                              <div key={field.fieldId ?? `logistics-${idx}`}>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{field.displayName}</div>
                                <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                              </div>
                            )
                          })}
                          <div>
                            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>物流进度</div>
                            <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{selectedOrder.progress}%</div>
                          </div>
                        </div>
                      </>
                    )}
                    
                    {productFields.length > 0 && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                          产品信息
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                          {productFields.map((field, idx) => {
                            const value = selectedOrder.formattedByFieldId?.[field.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
                            return (
                              <div key={field.fieldId ?? `product-${idx}`}>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{field.displayName}</div>
                                <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                    
                    {financialFields.length > 0 && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
                          财务信息
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          {financialFields.map((field, idx) => {
                            const value = selectedOrder.formattedByFieldId?.[field.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
                            return (
                              <div key={field.fieldId ?? `financial-${idx}`}>
                                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{field.displayName}</div>
                                <div style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{displayValue(field, value)}</div>
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )
              }

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {fieldsForEdit.map((field, idx) => {
                    const formatted = selectedOrder.formattedByFieldId?.[field.fieldId]
                    const rawDisplay = getFieldDisplayValue(selectedOrder.rawFields, field.fieldName)
                    const fallback = (formatted && formatted !== '-') ? formatted : (rawDisplay === '-' ? '' : rawDisplay)
                    const value = editForm[field.fieldName] ?? fallback
                    const fieldType = Number(field.fieldType) || 1
                    const options = getSelectOptions(field)
                    const isCurrency = isCurrencyField(field)
                    const isPercentage = isPercentageField(field)

                    const label = (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>{field.displayName}</div>
                    )

                    if (isDateField(field) || fieldType === 5) {
                      return (
                        <div key={field.fieldId ?? `schema-${idx}`}>
                          {label}
                          <DatePicker
                            style={{ width: '100%' }}
                            value={value && dayjs(value).isValid() ? dayjs(value) : null}
                            onChange={(d, dateStr) => setEditForm({ ...editForm, [field.fieldName]: dateStr ?? '' })}
                          />
                        </div>
                      )
                    }
                    if (fieldType === 1 || fieldType === 3) {
                      if (options.length > 0) {
                        return (
                          <div key={field.fieldId ?? `schema-${idx}`}>
                            {label}
                            <Select
                              allowClear
                              placeholder={`请选择${field.fieldName}`}
                              options={options}
                              value={value || undefined}
                              onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v ?? '' })}
                              style={{ width: '100%' }}
                            />
                          </div>
                        )
                      }
                    }
                    if (fieldType === 4 && options.length > 0) {
                      const arr = value ? String(value).split(',').filter(Boolean) : []
                      return (
                        <div key={field.fieldId ?? `schema-${idx}`}>
                          {label}
                          <Select
                            mode="multiple"
                            allowClear
                            placeholder={`请选择${field.fieldName}`}
                            options={options}
                            value={arr}
                            onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: (v || []).join(',') })}
                            style={{ width: '100%' }}
                          />
                        </div>
                      )
                    }
                    if (fieldType === 2) {
                      const isFixedCnyField = (f: MappedField) => {
                        const fn = (f.fieldName || '').trim()
                        const dk = (f.dataKey || '').toLowerCase()
                        return /^(采购成本|海运及保险|其他费用)$/i.test(fn) || ['purchasecost', 'shippinginsurance', 'otherfees'].includes(dk)
                      }
                      const currencyField = allSchemaFields.find((f) => /^(货币|币种|currency)$/i.test(f.fieldName || '') || (f.dataKey || '').toLowerCase() === 'currency')
                      const currencyVal = currencyField
                        ? (editForm[currencyField.fieldName] ?? selectedOrder.formattedByFieldId?.[currencyField.fieldId] ?? getFieldDisplayValue(selectedOrder.rawFields, currencyField.fieldName))
                        : ''
                      // 订单金额：货币=USD→$，CNY→¥，默认CNY；采购成本/海运及保险/其他费用：固定¥
                      const sym = isCurrency
                        ? (isFixedCnyField(field) ? '¥' : (getCurrencySymbol(currencyVal) || '¥'))
                        : ''
                      const suffix = isPercentage ? '%' : undefined
                      return (
                        <div key={field.fieldId ?? `schema-${idx}`}>
                          {label}
                          {sym ? (
                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d9d9d9', borderRadius: 6, background: '#fff' }}>
                              <span style={{ padding: '4px 11px', color: 'rgba(0,0,0,0.45)', fontSize: 14, fontWeight: 400 }}>{sym}</span>
                              <Input
                                type="number"
                                placeholder={`请输入${field.fieldName}`}
                                suffix={suffix}
                                variant="borderless"
                                style={{ flex: 1, paddingLeft: 0 }}
                                value={value}
                                onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })}
                              />
                            </div>
                          ) : (
                            <Input
                              type="number"
                              placeholder={`请输入${field.fieldName}`}
                              suffix={suffix}
                              value={value}
                              onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })}
                            />
                          )}
                        </div>
                      )
                    }
                    if (fieldType === 7) {
                      const boolVal = value === 'true' || value === '是' || value === '1'
                      return (
                        <div key={field.fieldId ?? `schema-${idx}`}>
                          {label}
                          <Select
                            value={boolVal ? 'true' : 'false'}
                            onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v === 'true' ? '是' : '否' })}
                            style={{ width: '100%' }}
                            options={[{ label: '是', value: 'true' }, { label: '否', value: 'false' }]}
                          />
                        </div>
                      )
                    }
                    if (options.length > 0) {
                      return (
                        <div key={field.fieldId ?? `schema-${idx}`}>
                          {label}
                          <Select
                            allowClear
                            placeholder={`请选择${field.fieldName}`}
                            options={options}
                            value={value || undefined}
                            onChange={(v) => setEditForm({ ...editForm, [field.fieldName]: v ?? '' })}
                            style={{ width: '100%' }}
                          />
                        </div>
                      )
                    }
                    return (
                      <div key={field.fieldId ?? `schema-${idx}`}>
                        {label}
                        <Input
                          placeholder={`请输入${field.fieldName}`}
                          value={value}
                          onChange={(e) => setEditForm({ ...editForm, [field.fieldName]: e.target.value })}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </Modal>
    </div>
  )
}
