'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Card, Input, Button, Space, DatePicker, Table, Row, Col, Statistic, Grid, Alert, Spin } from 'antd'
import { SearchOutlined, ReloadOutlined, BankOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { TABLE_IDS } from '@/lib/config/env'
import { useTableData, type TableRecord } from '@/app/hooks/useTableData'

export default function CashFlowPage() {
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
  const [monthFilter, setMonthFilter] = useState<string | null>(dayjs().format('YYYY-MM'))

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

  const columns: ColumnsType<TableRecord> = useMemo(() => {
    if (!schema?.fields?.length) return []
    return schema.fields.map((f) => ({
      title: f.fieldName,
      dataIndex: f.fieldId,
      key: f.fieldId,
      width: f.fieldName && (f.fieldName.includes('金额') || f.fieldName.includes('金额')) ? 120 : undefined,
      align: f.fieldName && /金额|数量|amount|number/i.test(f.fieldName) ? 'right' as const : undefined,
      render: (_: unknown, record: TableRecord) => getDisplay(record, f.fieldId, f.fieldName),
    }))
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
      const dateStr = Object.values(record.fields).find((pf) => {
        const v = pf.formatted ?? pf.parsed ?? pf.raw
        if (v == null) return false
        const s = String(v)
        return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{4}\/\d{2}/.test(s)
      })
      const dateVal = dateStr?.formatted ?? dateStr?.parsed ?? dateStr?.raw
      if (dateVal == null) return true
      const str = String(dateVal).substring(0, 7).replace(/\//g, '-')
      return str === monthFilter
    })
  }, [records, searchText, monthFilter])

  /** 汇总：尝试识别「类型」「金额」字段并汇总收入/支出 */
  const summary = useMemo(() => {
    let income = 0
    let expense = 0
    const typeField = schema?.fields?.find((f) => /类型|收支|type/i.test(f.fieldName || ''))
    const amountField = schema?.fields?.find((f) => /金额|amount|数额/i.test(f.fieldName || ''))
    if (!amountField) return { income: 0, expense: 0, total: filteredRecords.length }
    filteredRecords.forEach((record) => {
      const amtRaw = record.fields[amountField.fieldId]?.parsed ?? record.fields[amountField.fieldId]?.raw ?? record.raw[amountField.fieldName]
      const amt = typeof amtRaw === 'number' ? amtRaw : parseFloat(String(amtRaw).replace(/[^0-9.-]/g, ''))
      if (Number.isNaN(amt)) return
      const typeVal = typeField
        ? (record.fields[typeField.fieldId]?.formatted ?? record.fields[typeField.fieldId]?.parsed ?? record.raw[typeField.fieldName])
        : null
      const typeStr = typeVal != null ? String(typeVal) : ''
      if (/收入|收|in/i.test(typeStr)) income += amt
      else if (/支出|付|out|ex/i.test(typeStr)) expense += Math.abs(amt)
      else if (amt >= 0) income += amt
      else expense += Math.abs(amt)
    })
    return { income, expense, total: filteredRecords.length }
  }, [schema?.fields, filteredRecords])

  const pagePadding = isMobile ? 12 : isSmall ? 16 : 24
  const needConfig = !tableId.trim()
  const needSync = tableId.trim() && !loading && !schema

  return (
    <div style={{ padding: pagePadding, background: '#f5f5f7', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>银行流水</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>数据来自 oms现金表，按表结构动态展示</p>
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

      {/* 当期汇总卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="当期收入"
              value={summary.income}
              prefix="¥"
              precision={0}
              styles={{ content: { color: '#059669', fontSize: isMobile ? 18 : 22 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="当期支出"
              value={summary.expense}
              prefix="¥"
              precision={0}
              styles={{ content: { color: '#dc2626', fontSize: isMobile ? 18 : 22 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="流水条数"
              value={summary.total}
              suffix="条"
              styles={{ content: { color: '#6b7280', fontSize: isMobile ? 18 : 22 } }}
            />
          </Card>
        </Col>
      </Row>

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
            style={{ borderRadius: 8 }}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={loading} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      <Card
        size="small"
        style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}
        styles={{ body: { padding: 0 } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin description="加载中..." /></div>
        ) : columns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>暂无表结构，请先同步 oms现金表</div>
        ) : (
          <Table<TableRecord>
            columns={[{ title: '序号', key: '_index', width: 64, render: (_: unknown, __: TableRecord, index: number) => index + 1 }, ...columns]}
            dataSource={filteredRecords}
            rowKey="recordId"
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
            scroll={{ x: 600 }}
          />
        )}
      </Card>
    </div>
  )
}
