'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, Input, Button, Space, DatePicker, Table, Row, Col, Statistic, Grid, Alert, Spin, App, Modal, Select } from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  SyncOutlined,
  DollarOutlined,
  ShoppingOutlined,
  CustomerServiceOutlined,
  ShareAltOutlined,
  GiftOutlined,
  AppstoreOutlined,
  BankOutlined,
  CarOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  AccountBookOutlined,
  TeamOutlined,
  FileTextOutlined,
  HomeOutlined,
  IdcardOutlined,
  MoreOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { TABLE_IDS } from '@/lib/config/env'
import { useTableData, type TableRecord } from '@/app/hooks/useTableData'

export default function CashFlowPage() {
  const { message, modal } = App.useApp()
  const { useBreakpoint } = Grid
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const isSmall = !screens.lg

  const [resolvedTableId, setResolvedTableId] = useState<string | null>(null)
  useEffect(() => {
    const fromEnv = TABLE_IDS.cashFlow ?? ''
    if (fromEnv.trim()) {
      setResolvedTableId(fromEnv)
      return
    }
    fetch('/api/config/table-ids', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { cashFlow?: string | null }) => setResolvedTableId(data?.cashFlow?.trim() ?? ''))
      .catch(() => setResolvedTableId(''))
  }, [])

  const tableId = resolvedTableId ?? ''
  const { schema, records, loading, error, refetch } = useTableData({ tableId })

  const [searchText, setSearchText] = useState('')
  const [monthFilter, setMonthFilter] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)
  const [syncTaskDetail, setSyncTaskDetail] = useState<{
    status: string
    progress: number
    output?: string
    error?: string
    result?: { newRecords?: number; totalFiles?: number }
  } | null>(null)
  const [verifyTaskDetail, setVerifyTaskDetail] = useState<{
    status: string
    output?: string
    error?: string
  } | null>(null)
  const [previewRecord, setPreviewRecord] = useState<TableRecord | null>(null)
  const [typeEditLoading, setTypeEditLoading] = useState(false)
  const [syncSettingsPasswordOpen, setSyncSettingsPasswordOpen] = useState(false)
  const [syncSettingsOpen, setSyncSettingsOpen] = useState(false)
  const [syncSettingsPassword, setSyncSettingsPassword] = useState('')
  const [scriptRunning, setScriptRunning] = useState<string | null>(null)
  const [scriptOutput, setScriptOutput] = useState<{ action: string; output: string; success: boolean } | null>(null)
  const [deleteSourcePrefix, setDeleteSourcePrefix] = useState('')

  const SCRIPT_LIST = useMemo(
    () => [
      { key: 'clear_bitable', label: '清空现金表', desc: '删除目标表所有记录，测试或重同步前使用', danger: true },
      { key: 'delete_records_by_source', label: '按来源删除', desc: '删除指定来源前缀的记录，需输入来源前缀', danger: true, needParam: 'source' },
      { key: 'fix_type_field', label: '修正类型字段', desc: '按规则批量修正历史记录的类型', danger: false },
      { key: 'fix_my_account_field', label: '修正我方账户', desc: '按 company_profile 修正我方账户/账号', danger: false },
      { key: 'add_my_counterparty_fields', label: '添加我方/对方字段', desc: '为目标表添加字段（一次性建表）', danger: false },
      { key: 'check_source_duplicates', label: '检查源重复', desc: '检查源文件中是否存在重复交易', danger: false },
    ],
    []
  )

  /** 类型字段选项（与 type_classification.yaml 一致） */
  const TYPE_OPTIONS = useMemo(
    () =>
      [
        '退税到账', '销售回款', '服务回款', '分成到账', '内部结算', '其他收入',
        '货款支付', '货代支付', '保险支付', '提成支付', '杂费支付', '税费支付',
        '薪酬支付', '报销支付', '银行费用', '房租费用', '证照费用', '财务记账',
        '其他支出',
      ].filter((v, i, a) => a.indexOf(v) === i),
    []
  )

  /** 点击同步设置：先输入管理员密码 */
  const handleSyncSettingsClick = useCallback(() => {
    setSyncSettingsPassword('')
    setScriptOutput(null)
    setSyncSettingsPasswordOpen(true)
  }, [])

  /** 验证管理员密码后打开同步设置 */
  const handleVerifyAdminAndOpen = useCallback(async () => {
    if (!syncSettingsPassword.trim()) {
      message.warning('请输入管理员密码')
      return
    }
    try {
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: syncSettingsPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setSyncSettingsPasswordOpen(false)
        setSyncSettingsOpen(true)
      } else {
        message.error(data.error || '密码错误')
      }
    } catch {
      message.error('验证失败')
    }
  }, [syncSettingsPassword, message])

  /** 执行维护脚本 */
  const handleRunScript = useCallback(
    (item: (typeof SCRIPT_LIST)[0], paramValue?: string) => {
      if (item.needParam === 'source' && !(paramValue ?? '').trim()) {
        message.warning('请输入来源前缀（如 QD_VTB_RMB）')
        return
      }
      const warnMsg = item.danger
        ? `【危险操作】${item.label} 将修改或删除数据，确定执行？`
        : `确定执行「${item.label}」？`
      modal.confirm({
        title: '确认执行',
        content: warnMsg,
        okText: '执行',
        okButtonProps: { danger: item.danger },
        cancelText: '取消',
        centered: true,
        onOk: async () => {
          setScriptRunning(item.key)
          setScriptOutput(null)
          try {
            const params: Record<string, string> = {}
            if (item.needParam === 'source' && paramValue) params.source = paramValue.trim()
            const res = await fetch('/api/bankflow/scripts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: item.key, params, password: syncSettingsPassword }),
            })
            const data = await res.json()
            setScriptOutput({ action: item.key, output: data.output || data.error || '', success: data.success })
            if (data.success) {
              message.success('执行完成')
              refetch()
            } else {
              message.error(data.error || '执行失败')
            }
          } catch (err) {
            message.error('执行失败: ' + (err instanceof Error ? err.message : '未知错误'))
            setScriptOutput({ action: item.key, output: String(err), success: false })
          } finally {
            setScriptRunning(null)
          }
        },
      })
    },
    [modal, message, refetch, syncSettingsPassword]
  )

  /** 点击同步：先弹窗确认 */
  const handleBankflowSyncClick = useCallback(() => {
    if (syncLoading || activeTaskId) {
      message.warning('已有同步任务正在运行')
      return
    }
    setSyncConfirmOpen(true)
  }, [syncLoading, activeTaskId, message])

  /** 确认后执行同步 */
  const handleSyncConfirm = useCallback(async () => {
    setSyncConfirmOpen(false)
    setSyncLoading(true)
    setSyncTaskDetail({ status: 'pending', progress: 0 })
    setVerifyTaskDetail(null)
    try {
      const res = await fetch('/api/bankflow/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setActiveTaskId(data.taskId)
        pollTaskStatus(data.taskId)
      } else {
        message.error(data.message || '启动同步失败')
        setSyncTaskDetail(null)
      }
    } catch (err) {
      message.error('启动同步失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setSyncTaskDetail(null)
    } finally {
      setSyncLoading(false)
    }
  }, [message])

  /** 执行校验 */
  const handleVerify = useCallback(async () => {
    setVerifyTaskDetail({ status: 'pending' })
    try {
      const res = await fetch('/api/bankflow/verify', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setActiveTaskId(data.taskId)
        pollVerifyStatus(data.taskId)
      } else {
        message.error(data.message || '启动校验失败')
        setVerifyTaskDetail(null)
      }
    } catch (err) {
      message.error('启动校验失败: ' + (err instanceof Error ? err.message : '未知错误'))
      setVerifyTaskDetail(null)
    }
  }, [message])

  const pollVerifyStatus = useCallback(
    (taskId: string) => {
      const check = async () => {
        try {
          const res = await fetch(`/api/bankflow/status/${taskId}`)
          const data = await res.json()
          if (!data.success) {
            message.error('查询校验状态失败')
            setActiveTaskId(null)
            return
          }
          setVerifyTaskDetail({
            status: data.status,
            output: data.output,
            error: data.error,
          })
          if (data.status === 'completed') {
            message.success('校验完成')
            setActiveTaskId(null)
          } else if (data.status === 'failed') {
            message.error('校验失败: ' + (data.error || '未知错误'))
            setActiveTaskId(null)
          } else {
            setTimeout(check, 800)
          }
        } catch {
          message.error('查询校验状态失败')
          setActiveTaskId(null)
        }
      }
      check()
    },
    [message]
  )

  const pollTaskStatus = useCallback(
    (taskId: string) => {
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/bankflow/status/${taskId}`)
          const data = await res.json()
          if (!data.success) {
            message.error('查询任务状态失败: ' + data.message)
            setActiveTaskId(null)
            setSyncTaskDetail(null)
            return
          }
          setSyncTaskDetail({
            status: data.status,
            progress: data.progress ?? 0,
            output: data.output,
            error: data.error,
            result: data.result,
          })
          if (data.status === 'completed') {
            const newRecords = data.result?.newRecords ?? 0
            message.success(`同步完成！新增 ${newRecords} 条记录`, 3)
            setActiveTaskId(null)
            refetch()
          } else if (data.status === 'failed') {
            message.error('同步失败: ' + (data.error || '未知错误'))
            setActiveTaskId(null)
          } else {
            setTimeout(() => checkStatus(), 800)
          }
        } catch (err) {
          message.error('查询任务状态失败: ' + (err instanceof Error ? err.message : '未知错误'))
          setActiveTaskId(null)
          setSyncTaskDetail(null)
        }
      }
      checkStatus()
    },
    [message, refetch]
  )

  const closeSyncModal = useCallback(() => {
    setSyncTaskDetail(null)
    setVerifyTaskDetail(null)
  }, [])

  /** 从 record 中按 dataKey 或常见中文名取值 */
  const getDisplay = (record: TableRecord, fieldId: string, fieldName: string): string => {
    const pf = record.fields[fieldId]
    if (pf != null) {
      const v = pf.formatted ?? pf.parsed ?? pf.raw
      if (v != null && v !== '') return String(v)
    }
    const rawVal = record.raw[fieldName] ?? record.raw[fieldId]
    if (rawVal != null && rawVal !== '') return String(rawVal)
    return '-'
  }

  /** 更新预览记录的类型字段（先确认再更新） */
  const handlePreviewTypeChange = useCallback(
    (newType: string) => {
      if (!previewRecord || !tableId) return
      modal.confirm({
        title: '是否保存',
        content: `将类型修改为「${newType}」？`,
        okText: '保存',
        cancelText: '取消',
        centered: true,
        onOk: async () => {
          setTypeEditLoading(true)
          try {
            const res = await fetch(`/api/feishu/records/${previewRecord.recordId}?tableId=${encodeURIComponent(tableId)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: { [schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))?.fieldName || '类型']: newType },
              }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || '更新失败')
            message.success('类型已更新')
            await refetch()
            setPreviewRecord((prev) => {
              if (!prev) return prev
              const next = { ...prev, fields: { ...prev.fields }, raw: { ...prev.raw } }
              const typeFieldId = schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))?.fieldId
              if (typeFieldId && next.fields[typeFieldId]) {
                next.fields[typeFieldId] = {
                  ...next.fields[typeFieldId],
                  raw: newType,
                  parsed: newType,
                  formatted: newType,
                }
              }
              next.raw['类型'] = newType
              return next
            })
          } catch (err) {
            message.error('更新失败: ' + (err instanceof Error ? err.message : '未知错误'))
          } finally {
            setTypeEditLoading(false)
          }
        },
      })
    },
    [previewRecord, tableId, refetch, schema, message, modal]
  )

  /** 从 record 取任意 key 的展示值（用于预览全部字段） */
  const getDisplayByKey = (record: TableRecord, key: string): string => {
    const pf = record.fields[key]
    if (pf != null) {
      const v = pf.formatted ?? pf.parsed ?? pf.raw
      if (v != null && v !== '') return String(v)
    }
    const rawVal = record.raw[key]
    if (rawVal == null || rawVal === '') return '-'
    if (Array.isArray(rawVal) && rawVal.length > 0) {
      const first = rawVal[0]
      if (typeof first === 'object' && first !== null) {
        const o = first as Record<string, unknown>
        return String(o.value ?? o.text ?? o.name ?? '-')
      }
      return String(first)
    }
    if (typeof rawVal === 'object') {
      const o = rawVal as Record<string, unknown>
      return String(o.value ?? o.text ?? o.name ?? '-')
    }
    return String(rawVal)
  }

  const columns: ColumnsType<TableRecord> = useMemo(() => {
    if (!schema?.fields?.length) return []
    return schema.fields.map((f) => ({
      title: f.fieldName,
      dataIndex: f.fieldId,
      key: f.fieldId,
      ellipsis: true,
      align: f.fieldName && /金额|数量|amount|number/i.test(f.fieldName) ? 'right' as const : undefined,
      render: (_: unknown, record: TableRecord) => getDisplay(record, f.fieldId, f.fieldName),
    }))
  }, [schema?.fields])

  /** 从记录中提取 YYYY-MM，支持时间戳、YYYY-MM-DD、YYYY/MM、YYYYMMDD、YYYY年MM月 等格式 */
  const getRecordMonth = useCallback((record: TableRecord): string | null => {
    const toMonth = (val: unknown): string | null => {
      if (val == null) return null
      if (typeof val === 'number') {
        if (val > 1e12) return dayjs(val).format('YYYY-MM') // 毫秒时间戳
        if (val > 1e9) return dayjs(val * 1000).format('YYYY-MM') // 秒时间戳
        return null
      }
      const s = String(val).trim()
      const m1 = s.match(/^(\d{4})[-/](\d{1,2})/)
      if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}`
      const m2 = s.match(/^(\d{4})年(\d{1,2})/)
      if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}`
      const m3 = s.match(/^(\d{8})$/)
      if (m3) return `${m3[1].slice(0, 4)}-${m3[1].slice(4, 6)}`
      return null
    }
    // 优先从 schema 日期字段取值
    const dateLikeFields = schema?.fields?.filter((f) =>
      /交易日期|记账日期|日期|date|时间|time/i.test(f.fieldName || '')
    )
    for (const f of dateLikeFields ?? []) {
      const v = record.fields[f.fieldId]?.formatted ?? record.fields[f.fieldId]?.parsed ?? record.fields[f.fieldId]?.raw ?? record.raw[f.fieldName]
      const month = toMonth(v)
      if (month) return month
    }
    // 回退：遍历所有字段找日期格式
    for (const pf of Object.values(record.fields)) {
      const v = pf.formatted ?? pf.parsed ?? pf.raw
      const month = toMonth(v)
      if (month) return month
    }
    for (const [, v] of Object.entries(record.raw)) {
      const month = toMonth(v)
      if (month) return month
    }
    return null
  }, [schema?.fields])

  const filteredRecords = useMemo(() => {
    if (!monthFilter && !searchText) return records
    return records.filter((record) => {
      const searchMatch = !searchText || Object.values(record.fields).some((pf) => {
        const v = pf.formatted ?? pf.parsed ?? pf.raw
        return v != null && String(v).toLowerCase().includes(searchText.toLowerCase())
      })
      if (!searchMatch) return false
      if (!monthFilter) return true
      const recordMonth = getRecordMonth(record)
      if (!recordMonth) return true // 无日期字段时保留
      return recordMonth === monthFilter
    })
  }, [records, searchText, monthFilter, getRecordMonth])

  const typeField = schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))
  const tableRecords = useMemo(() => {
    if (!selectedCategory || !typeField) return filteredRecords
    return filteredRecords.filter((record) => {
      const typeVal = String(
        record.fields[typeField.fieldId]?.formatted ??
        record.fields[typeField.fieldId]?.parsed ??
        record.raw[typeField.fieldName] ??
        ''
      ).trim() || '未分类'
      return typeVal === selectedCategory
    })
  }, [filteredRecords, selectedCategory, typeField])

  /** 汇总：按货币区分收入/支出；按类型字段分类统计；支持「类型+金额」或「收入/支出」分列 */
  const summary = useMemo(() => {
    let incomeCny = 0
    let incomeUsd = 0
    let expenseCny = 0
    let expenseUsd = 0
    const typeField = schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))
    const amountField = schema?.fields?.find((f) => /^金额$|^amount$/i.test((f.fieldName || '').trim()))
    const incomeField = schema?.fields?.find((f) => /^收入$/i.test((f.fieldName || '').trim()))
    const expenseField = schema?.fields?.find((f) => /^支出$/i.test((f.fieldName || '').trim()))
    const currencyField = schema?.fields?.find((f) => /货币|币种|currency/i.test(f.fieldName || ''))
    const isUsd = (val: unknown): boolean => {
      const s = String(val ?? '').trim().toUpperCase()
      return s === 'USD' || s.includes('美元') || s.includes('DOLLAR')
    }
    const getAmt = (record: TableRecord, field: { fieldId: string; fieldName: string }): number => {
      const raw = record.fields[field.fieldId]?.parsed ?? record.fields[field.fieldId]?.raw ?? record.raw[field.fieldName]
      const amt = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.-]/g, ''))
      return Number.isNaN(amt) ? 0 : amt
    }
    /** 分类统计：类型 -> { incomeCny, incomeUsd, expenseCny, expenseUsd, isIncome } */
    const byType: Record<string, { incomeCny: number; incomeUsd: number; expenseCny: number; expenseUsd: number; isIncome: boolean }> = {}
    const ensureType = (typeLabel: string, isIncome: boolean) => {
      if (!byType[typeLabel]) {
        byType[typeLabel] = { incomeCny: 0, incomeUsd: 0, expenseCny: 0, expenseUsd: 0, isIncome }
      }
      return byType[typeLabel]
    }
    filteredRecords.forEach((record) => {
      const currencyVal = currencyField
        ? (record.fields[currencyField.fieldId]?.formatted ?? record.fields[currencyField.fieldId]?.parsed ?? record.raw[currencyField.fieldName])
        : null
      const inUsd = isUsd(currencyVal)
      const typeStr = typeField
        ? String(record.fields[typeField.fieldId]?.formatted ?? record.fields[typeField.fieldId]?.parsed ?? record.raw[typeField.fieldName] ?? '').trim() || '未分类'
        : '未分类'
      if (incomeField && expenseField) {
        const inc = getAmt(record, incomeField)
        const exp = getAmt(record, expenseField)
        const t = ensureType(typeStr, inc > 0)
        if (inUsd) {
          incomeUsd += inc
          expenseUsd += exp
          t.incomeUsd += inc
          t.expenseUsd += exp
        } else {
          incomeCny += inc
          expenseCny += exp
          t.incomeCny += inc
          t.expenseCny += exp
        }
      } else if (amountField && typeField) {
        const amt = getAmt(record, amountField)
        if (amt === 0) return
        const isIncome = /收入|收|in|退税|回款|分成|内部结算|其他收入/i.test(typeStr) ||
          (!/支出|付|out|ex|支付|费用|薪酬|报销|杂费|其他支出/i.test(typeStr) && amt >= 0)
        const t = ensureType(typeStr, isIncome)
        if (isIncome) {
          if (inUsd) {
            incomeUsd += amt
            t.incomeUsd += amt
          } else {
            incomeCny += amt
            t.incomeCny += amt
          }
        } else {
          const absAmt = Math.abs(amt)
          if (inUsd) {
            expenseUsd += absAmt
            t.expenseUsd += absAmt
          } else {
            expenseCny += absAmt
            t.expenseCny += absAmt
          }
        }
      } else if (amountField) {
        const amt = getAmt(record, amountField)
        const isIncome = amt >= 0
        const t = ensureType(typeStr, isIncome)
        if (isIncome) {
          if (inUsd) {
            incomeUsd += amt
            t.incomeUsd += amt
          } else {
            incomeCny += amt
            t.incomeCny += amt
          }
        } else {
          const absAmt = Math.abs(amt)
          if (inUsd) {
            expenseUsd += absAmt
            t.expenseUsd += absAmt
          } else {
            expenseCny += absAmt
            t.expenseCny += absAmt
          }
        }
      }
    })
    const allEntries = Object.entries(byType)
      .filter(([, v]) => v.incomeCny + v.incomeUsd + v.expenseCny + v.expenseUsd > 0)
      .sort((a, b) => {
        const aVal = a[1].incomeCny + a[1].incomeUsd + a[1].expenseCny + a[1].expenseUsd
        const bVal = b[1].incomeCny + b[1].incomeUsd + b[1].expenseCny + b[1].expenseUsd
        return bVal - aVal
      })
    const incomeRaw = allEntries.filter(([label, v]) => (v.incomeCny + v.incomeUsd) >= (v.expenseCny + v.expenseUsd) && label !== '内部结算')
    const expenseRaw = allEntries.filter(([label, v]) => (v.expenseCny + v.expenseUsd) > (v.incomeCny + v.incomeUsd) && label !== '内部结算')
    const incomeItems = [...incomeRaw.filter(([l]) => l !== '其他收入'), ...incomeRaw.filter(([l]) => l === '其他收入')]
    const expenseItems = [...expenseRaw.filter(([l]) => l !== '其他支出'), ...expenseRaw.filter(([l]) => l === '其他支出')]
    const internalSettlement = allEntries.find(([label]) => label === '内部结算')
    return { incomeCny, incomeUsd, expenseCny, expenseUsd, total: filteredRecords.length, incomeItems, expenseItems, internalSettlement }
  }, [schema?.fields, filteredRecords])

  const pagePadding = isMobile ? 12 : isSmall ? 16 : 24
  const needConfig = resolvedTableId !== null && !tableId.trim()
  const needSync = tableId.trim() && !loading && !schema

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  /** 双币种展示：人民币与美元之间用分隔符，统一保留两位小数 */
  const formatDualCurrency = (cny: number, usd: number, color?: string) => {
    const parts: React.ReactNode[] = []
    if (cny > 0) parts.push(<span key="cny">¥{fmt(cny)}</span>)
    if (usd > 0) {
      if (parts.length) parts.push(<span key="sep" style={{ margin: '0 8px', color: '#9ca3af', fontWeight: 400 }}>·</span>)
      parts.push(<span key="usd">${fmt(usd)}</span>)
    }
    if (parts.length === 0) return <span style={{ color: color ?? '#9ca3af' }}>0</span>
    return <span style={color ? { color } : undefined}>{parts}</span>
  }
  /** 金额列宽：人民币、美元左右对齐，表格列对齐 */
  const AMT_CNY_WIDTH = 95
  const AMT_USD_WIDTH = 95
  const AMT_SEP_WIDTH = 24
  /** 分类名称 -> 浅色图标 */
  const getCategoryIcon = (label: string) => {
    const iconStyle = { color: '#9ca3af', fontWeight: 400, marginRight: 8, fontSize: 14 }
    const icons: Record<string, React.ReactNode> = {
      退税到账: <GiftOutlined style={iconStyle} />,
      销售回款: <DollarOutlined style={iconStyle} />,
      服务回款: <CustomerServiceOutlined style={iconStyle} />,
      分成到账: <ShareAltOutlined style={iconStyle} />,
      其他收入: <AppstoreOutlined style={iconStyle} />,
      货款支付: <ShoppingOutlined style={iconStyle} />,
      货代支付: <CarOutlined style={iconStyle} />,
      保险支付: <SafetyCertificateOutlined style={iconStyle} />,
      提成支付: <TrophyOutlined style={iconStyle} />,
      税费支付: <AccountBookOutlined style={iconStyle} />,
      薪酬支付: <TeamOutlined style={iconStyle} />,
      报销支付: <FileTextOutlined style={iconStyle} />,
      银行费用: <BankOutlined style={iconStyle} />,
      房租费用: <HomeOutlined style={iconStyle} />,
      证照费用: <IdcardOutlined style={iconStyle} />,
      财务记账: <AccountBookOutlined style={iconStyle} />,
      杂费支付: <AppstoreOutlined style={iconStyle} />,
      其他支出: <MoreOutlined style={iconStyle} />,
    }
    return icons[label] ?? <AppstoreOutlined style={iconStyle} />
  }

  return (
    <div style={{ padding: pagePadding, background: '#f5f5f7', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280' }}>银行账户流水为自动汇总，执行同步前请确认已经上传流水表到指定位置！</p>
      </div>

      {needConfig && (
        <Alert type="info" showIcon title="请先在 .env.local 中配置 FEISHU_TABLE_CASH_FLOW（oms现金表），保存后重启服务。" style={{ marginBottom: 16 }} />
      )}
      {needSync && (
        <Alert type="warning" showIcon title="请前往 系统管理 → 同步设置 同步 oms现金表 后再查看数据。" style={{ marginBottom: 16 }} />
      )}
      {error && (
        <Alert type="error" showIcon title={error.message} style={{ marginBottom: 16 }} />
      )}

      {/* 汇总：左右两大卡片，收入 | 支出 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              height: '100%',
              cursor: selectedCategory ? 'pointer' : undefined,
            }}
            styles={{ body: { padding: isMobile ? 16 : 20 } }}
            onClick={(e) => { if ((e.target as HTMLElement).closest('[data-category-row]') === null) setSelectedCategory(null) }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 40 }}>
              {/* 收入合计 - 第一行，点击恢复全部 */}
              <div
                data-category-row
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  padding: '4px 8px',
                  margin: '0 -8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                onClick={(e) => { e.stopPropagation(); setSelectedCategory(null) }}
              >
                <span style={{ display: 'flex', alignItems: 'center', color: '#374151', fontWeight: 600, flex: 1 }}>收入合计</span>
                <span style={{ width: AMT_CNY_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#059669' }}>
                  {summary.incomeCny > 0 ? `¥${fmt(summary.incomeCny)}` : '\u00A0'}
                </span>
                <span style={{ width: AMT_SEP_WIDTH, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>·</span>
                <span style={{ width: AMT_USD_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#059669' }}>
                  {summary.incomeUsd > 0 ? `$ ${fmt(summary.incomeUsd)}` : '\u00A0'}
                </span>
              </div>
              {summary.incomeItems.map(([typeLabel, stat]) => (
                <div
                  key={typeLabel}
                  data-category-row
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13,
                    padding: '4px 8px',
                    margin: '0 -8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: selectedCategory === typeLabel ? 'rgba(5, 150, 105, 0.08)' : undefined,
                  }}
                  onMouseEnter={(e) => { if (selectedCategory !== typeLabel) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                  onMouseLeave={(e) => { if (selectedCategory !== typeLabel) e.currentTarget.style.backgroundColor = 'transparent'; else e.currentTarget.style.backgroundColor = 'rgba(5, 150, 105, 0.08)' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedCategory(typeLabel) }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280', flex: 1 }}>
                    {getCategoryIcon(typeLabel)}
                    {typeLabel}
                  </span>
                  <span style={{ width: AMT_CNY_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#059669' }}>
                    {stat.incomeCny > 0 ? `¥${fmt(stat.incomeCny)}` : '\u00A0'}
                  </span>
                  <span style={{ width: AMT_SEP_WIDTH, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>·</span>
                  <span style={{ width: AMT_USD_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#059669' }}>
                    {stat.incomeUsd > 0 ? `$ ${fmt(stat.incomeUsd)}` : '\u00A0'}
                  </span>
                </div>
              ))}
              {summary.incomeItems.length === 0 && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>暂无收入分类</span>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              height: '100%',
              cursor: selectedCategory ? 'pointer' : undefined,
            }}
            styles={{ body: { padding: isMobile ? 16 : 20 } }}
            onClick={(e) => { if ((e.target as HTMLElement).closest('[data-category-row]') === null) setSelectedCategory(null) }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 40 }}>
              {/* 支出合计 - 第一行，点击恢复全部 */}
              <div
                data-category-row
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  padding: '4px 8px',
                  margin: '0 -8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                onClick={(e) => { e.stopPropagation(); setSelectedCategory(null) }}
              >
                <span style={{ display: 'flex', alignItems: 'center', color: '#374151', fontWeight: 600, flex: 1 }}>支出合计</span>
                <span style={{ width: AMT_CNY_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#dc2626' }}>
                  {summary.expenseCny > 0 ? `¥${fmt(summary.expenseCny)}` : '\u00A0'}
                </span>
                <span style={{ width: AMT_SEP_WIDTH, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>·</span>
                <span style={{ width: AMT_USD_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#dc2626' }}>
                  {summary.expenseUsd > 0 ? `$ ${fmt(summary.expenseUsd)}` : '\u00A0'}
                </span>
              </div>
              {summary.expenseItems.map(([typeLabel, stat]) => (
                <div
                  key={typeLabel}
                  data-category-row
                  role="button"
                  tabIndex={0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 13,
                    padding: '4px 8px',
                    margin: '0 -8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: selectedCategory === typeLabel ? 'rgba(220, 38, 38, 0.08)' : undefined,
                  }}
                  onMouseEnter={(e) => { if (selectedCategory !== typeLabel) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                  onMouseLeave={(e) => { if (selectedCategory !== typeLabel) e.currentTarget.style.backgroundColor = 'transparent'; else e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedCategory(typeLabel) }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: '#6b7280', flex: 1 }}>
                    {getCategoryIcon(typeLabel)}
                    {typeLabel}
                  </span>
                  <span style={{ width: AMT_CNY_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#dc2626' }}>
                    {stat.expenseCny > 0 ? `¥${fmt(stat.expenseCny)}` : '\u00A0'}
                  </span>
                  <span style={{ width: AMT_SEP_WIDTH, textAlign: 'center', color: '#d1d5db', fontSize: 12 }}>·</span>
                  <span style={{ width: AMT_USD_WIDTH, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#dc2626' }}>
                    {stat.expenseUsd > 0 ? `$ ${fmt(stat.expenseUsd)}` : '\u00A0'}
                  </span>
                </div>
              ))}
              {summary.expenseItems.length === 0 && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>暂无支出分类</span>
              )}
            </div>
          </Card>
        </Col>
      </Row>
      {summary.internalSettlement && (() => {
        const [, s] = summary.internalSettlement
        const hasIncome = s.incomeCny + s.incomeUsd > 0
        const hasExpense = s.expenseCny + s.expenseUsd > 0
        return (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, marginBottom: 16 }}>
            内部结算
            {hasIncome && <span style={{ marginLeft: 8 }}>收 {formatDualCurrency(s.incomeCny, s.incomeUsd)}</span>}
            {hasIncome && hasExpense && <span style={{ margin: '0 4px' }}>·</span>}
            {hasExpense && <span>支 {formatDualCurrency(s.expenseCny, s.expenseUsd)}</span>}
          </div>
        )
      })()}

      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Space wrap size={isMobile ? 'small' : 'middle'}>
          <Input
            placeholder="搜索摘要或内容..."
            prefix={<SearchOutlined style={{ color: '#6b7280' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: isMobile ? '100%' : 220, borderRadius: 8 }}
            allowClear
          />
          <DatePicker.MonthPicker
            value={monthFilter ? dayjs(monthFilter) : null}
            onChange={(d: Dayjs | null) => setMonthFilter(d ? d.format('YYYY-MM') : null)}
            placeholder="全部月份"
            allowClear
            style={{ borderRadius: 8 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
          <Button
            icon={<SyncOutlined />}
            onClick={handleBankflowSyncClick}
            loading={syncLoading || !!activeTaskId}
            type="primary"
            style={{ borderRadius: 8 }}
            title={activeTaskId ? `同步任务运行中: ${activeTaskId}` : '从银行拉取流水并同步到 oms现金表'}
          >
            {activeTaskId ? '同步中...' : '银行流水同步'}
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={handleSyncSettingsClick}
            style={{ borderRadius: 8 }}
            title="维护脚本：清空、删除、修正等"
          >
            同步设置
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
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin description="加载中..." /></div>
        ) : columns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>暂无表结构，请先同步 oms现金表</div>
        ) : (
          <Table<TableRecord>
            key={selectedCategory ?? 'all'}
            columns={[
              { title: '序号', key: '_index', width: 64, ellipsis: true, render: (_: unknown, __: TableRecord, index: number) => index + 1 },
              ...columns,
            ]}
            dataSource={tableRecords}
            rowKey="recordId"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{
              x: isMobile ? 800 : 1000,
              y: isMobile ? 'calc(100vh - 380px)' : 'calc(100vh - 440px)',
            }}
            loading={loading}
            onRow={(record) => ({
              onClick: () => setPreviewRecord(record),
              style: { cursor: 'pointer' },
            })}
            tableLayout="auto"
          />
        )}
      </Card>

      <Modal
        title="流水详情"
        open={!!previewRecord}
        onCancel={() => setPreviewRecord(null)}
        footer={null}
        centered
        mask={{ closable: true }}
        width={isMobile ? '100%' : 640}
        style={isMobile ? { maxWidth: '100%', paddingBottom: 0 } : undefined}
      >
        {previewRecord && (() => {
          const skipKeys = new Set(['record_id', 'recordId'])
          const schemaFields = (schema?.fields ?? []).filter((f) => !skipKeys.has(f.fieldId))
          const schemaFieldIds = new Set(schemaFields.map((f) => f.fieldId))
          const schemaFieldNames = new Set(schemaFields.map((f) => (f.fieldName || '').trim()).filter(Boolean))
          const isSchemaCovered = (k: string) =>
            schemaFieldIds.has(k) || schemaFieldNames.has(k)
          const extraKeys = [
            ...Object.keys(previewRecord.fields).filter((k) => !isSchemaCovered(k) && !skipKeys.has(k)),
            ...Object.keys(previewRecord.raw).filter((k) => !isSchemaCovered(k) && !(k in previewRecord.fields) && !skipKeys.has(k)),
          ]
          const typeField = schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))
          const allItems: Array<{ key: string; label: string; isTypeField?: boolean }> = [
            ...schemaFields.map((f) => ({
              key: f.fieldId,
              label: f.fieldName || f.fieldId,
              isTypeField: typeField?.fieldId === f.fieldId,
            })),
            ...Array.from(new Set(extraKeys)).map((k) => {
              const pf = previewRecord.fields[k]
              const label = (pf?.meta as { fieldName?: string } | undefined)?.fieldName || k
              return { key: k, label, isTypeField: false }
            }),
          ]
          return (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 16,
                padding: '16px 0',
                maxHeight: '70vh',
                overflowY: 'auto',
              }}
            >
              {allItems.map(({ key, label, isTypeField }) => (
                <div key={key}>
                  <div
                    style={{
                      fontSize: 12,
                      color: isTypeField ? '#dc2626' : '#6b7280',
                      marginBottom: 4,
                      fontWeight: isTypeField ? 600 : 400,
                    }}
                  >
                    {label}
                  </div>
                  {isTypeField ? (
                    <Select
                      value={getDisplayByKey(previewRecord, key) || undefined}
                      placeholder="选择类型"
                      options={TYPE_OPTIONS.map((opt) => ({ label: opt, value: opt }))}
                      onChange={handlePreviewTypeChange}
                      loading={typeEditLoading}
                      style={{ width: '100%', color: '#dc2626', fontWeight: 500 }}
                      allowClear={false}
                    />
                  ) : (
                    <div style={{ fontSize: 14, color: '#111827', fontWeight: 500, wordBreak: 'break-word' }}>
                      {getDisplayByKey(previewRecord, key)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })()}
      </Modal>

      {/* 同步设置：管理员密码验证 */}
      <Modal
        title="同步设置"
        open={syncSettingsPasswordOpen}
        onCancel={() => setSyncSettingsPasswordOpen(false)}
        onOk={handleVerifyAdminAndOpen}
        okText="验证"
        cancelText="取消"
        centered
      >
        <p style={{ marginBottom: 12 }}>请输入管理员密码以访问维护脚本：</p>
        <Input.Password
          placeholder="管理员密码"
          value={syncSettingsPassword}
          onChange={(e) => setSyncSettingsPassword(e.target.value)}
          onPressEnter={handleVerifyAdminAndOpen}
        />
      </Modal>

      {/* 同步设置：维护脚本列表 */}
      <Modal
        title="同步设置 - 维护脚本"
        open={syncSettingsOpen}
        onCancel={() => setSyncSettingsOpen(false)}
        footer={null}
        centered
        width={680}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 12 }}>
          {SCRIPT_LIST.map((item) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 0',
                paddingRight: 8,
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  {item.label}
                  {item.danger && <span style={{ color: '#dc2626', marginLeft: 6, fontSize: 12 }}>危险</span>}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{item.desc}</div>
                {item.needParam === 'source' && (
                  <Input
                    placeholder="来源前缀，如 QD_VTB_RMB"
                    value={deleteSourcePrefix}
                    onChange={(e) => setDeleteSourcePrefix(e.target.value)}
                    style={{ width: '100%', marginBottom: 8 }}
                  />
                )}
              </div>
              <Button
                type={item.danger ? 'primary' : 'default'}
                danger={item.danger}
                loading={scriptRunning === item.key}
                onClick={() => handleRunScript(item, item.needParam === 'source' ? deleteSourcePrefix : undefined)}
                style={{ flexShrink: 0, marginRight: 4 }}
              >
                执行
              </Button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
            说明：init_mapping（字段映射初始化）为交互式脚本，请在命令行执行。
          </div>
          {scriptOutput && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>执行结果</div>
              <pre
                style={{
                  padding: 12,
                  background: '#1f2937',
                  borderRadius: 8,
                  color: scriptOutput.success ? '#10b981' : '#f87171',
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {scriptOutput.output || '(无输出)'}
              </pre>
            </div>
          )}
        </div>
      </Modal>

      {/* 同步前确认弹窗 */}
      <Modal
        title="银行流水同步"
        open={syncConfirmOpen}
        onCancel={() => setSyncConfirmOpen(false)}
        onOk={handleSyncConfirm}
        okText="确定"
        cancelText="取消"
        centered
      >
        <p style={{ margin: 0 }}>请确认已经将银行流水表放至指定位置！</p>
      </Modal>

      {/* 银行流水同步过程弹窗 */}
      <Modal
        title="银行流水同步"
        open={syncTaskDetail !== null}
        onCancel={closeSyncModal}
        centered
        footer={
          syncTaskDetail?.status === 'completed' || syncTaskDetail?.status === 'failed' ? (
            <Space>
              <Button onClick={handleVerify} loading={!!activeTaskId && !!verifyTaskDetail}>
                执行校验
              </Button>
              <Button type="primary" onClick={closeSyncModal}>
                关闭
              </Button>
            </Space>
          ) : null
        }
        mask={{ closable: false }}
        width={Math.min(640, typeof window !== 'undefined' ? window.innerWidth - 48 : 640)}
        style={isMobile ? { maxWidth: '100%' } : undefined}
      >
        {syncTaskDetail && (
          <div style={{ minHeight: 200 }}>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 500 }}>
                {syncTaskDetail.status === 'running' || syncTaskDetail.status === 'pending'
                  ? '同步中...'
                  : syncTaskDetail.status === 'completed'
                    ? '同步完成'
                    : '同步失败'}
              </span>
              {(syncTaskDetail.status === 'running' || syncTaskDetail.status === 'pending') && (
                <span style={{ fontSize: 12, color: '#6b7280' }}>{syncTaskDetail.progress}%</span>
              )}
              {syncTaskDetail.status === 'completed' && syncTaskDetail.result?.newRecords != null && (
                <span style={{ fontSize: 13, color: '#059669' }}>新增 {syncTaskDetail.result.newRecords} 条记录</span>
              )}
            </div>
            {(syncTaskDetail.status === 'running' || syncTaskDetail.status === 'pending') && (
              <div style={{ marginBottom: 12, height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${syncTaskDetail.progress}%`,
                    background: '#059669',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            )}
            {syncTaskDetail.error && (
              <div style={{ marginBottom: 12, padding: 8, background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
                {syncTaskDetail.error}
              </div>
            )}
            <div
              style={{
                padding: 12,
                background: '#1f2937',
                borderRadius: 8,
                maxHeight: 280,
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#e5e7eb',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {syncTaskDetail.output || (syncTaskDetail.status === 'pending' ? '正在启动...' : '暂无输出')}
            </div>
            {verifyTaskDetail && (
              <>
                <div style={{ marginTop: 16, marginBottom: 8, fontWeight: 500 }}>校验结果</div>
                <div
                  style={{
                    padding: 12,
                    background: '#1f2937',
                    borderRadius: 8,
                    maxHeight: 200,
                    overflowY: 'auto',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: '#e5e7eb',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {verifyTaskDetail.status === 'pending'
                    ? '校验中...'
                    : verifyTaskDetail.error
                      ? verifyTaskDetail.error
                      : verifyTaskDetail.output || '暂无输出'}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
