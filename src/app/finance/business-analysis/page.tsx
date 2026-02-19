'use client'

import React, { useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag, Space, DatePicker, Select, Button, Grid } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, ReloadOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'

interface MetricRow {
  key: string
  metric: string
  current: number
  previous: number
  change: number
  unit: string
}

const mockMetrics: MetricRow[] = [
  { key: '1', metric: '销售收入', current: 1250000, previous: 1080000, change: 15.7, unit: '元' },
  { key: '2', metric: '毛利率', current: 28.5, previous: 26.2, change: 8.8, unit: '%' },
  { key: '3', metric: '订单数量', current: 156, previous: 142, change: 9.9, unit: '单' },
  { key: '4', metric: '客单价', current: 8012, previous: 7606, change: 5.3, unit: '元' },
  { key: '5', metric: '回款周期', current: 32, previous: 35, change: -8.6, unit: '天' },
  { key: '6', metric: '净利润率', current: 12.8, previous: 11.6, change: 10.3, unit: '%' },
]

const mockTopProducts = [
  { key: '1', name: '产品A', sales: 450000, growth: 23.5, category: '电子产品' },
  { key: '2', name: '产品B', sales: 320000, growth: 18.2, category: '原材料' },
  { key: '3', name: '产品C', sales: 280000, growth: 12.8, category: '成品' },
]

const mockTopCustomers = [
  { key: '1', name: 'KINGLION', amount: 580000, orders: 12 },
  { key: '2', name: '某贸易公司', amount: 420000, orders: 8 },
  { key: '3', name: '海外客户A', amount: 310000, orders: 5 },
]

export default function BusinessAnalysisPage() {
  const { useBreakpoint } = Grid
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const isSmall = !screens.lg

  const [monthRange, setMonthRange] = useState<[Dayjs, Dayjs] | null>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ])
  const [dimension, setDimension] = useState<string>('all')

  const metricColumns: ColumnsType<MetricRow> = [
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 120 },
    {
      title: '本期',
      dataIndex: 'current',
      key: 'current',
      align: 'right',
      render: (v: number, r) => (r.unit === '%' ? `${v}%` : r.unit === '天' ? `${v}天` : v.toLocaleString()),
    },
    {
      title: '上期',
      dataIndex: 'previous',
      key: 'previous',
      align: 'right',
      render: (v: number, r) => (r.unit === '%' ? `${v}%` : r.unit === '天' ? `${v}天` : v.toLocaleString()),
    },
    {
      title: '环比',
      dataIndex: 'change',
      key: 'change',
      align: 'right',
      width: 100,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#059669' : '#dc2626', fontWeight: 500 }}>
          {v >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {v >= 0 ? '+' : ''}{v}%
        </span>
      ),
    },
  ]

  const productColumns: ColumnsType<typeof mockTopProducts[0]> = [
    { title: '产品名称', dataIndex: 'name', key: 'name' },
    { title: '类别', dataIndex: 'category', key: 'category', render: (c: string) => <Tag style={{ borderRadius: 9999, border: 'none' }}>{c}</Tag> },
    { title: '销售额', dataIndex: 'sales', key: 'sales', align: 'right', render: (s: number) => `¥${s.toLocaleString()}` },
    { title: '增长率', dataIndex: 'growth', key: 'growth', align: 'right', render: (g: number) => <span style={{ color: g >= 0 ? '#059669' : '#dc2626' }}>{g >= 0 ? '+' : ''}{g}%</span> },
  ]

  const customerColumns: ColumnsType<typeof mockTopCustomers[0]> = [
    { title: '客户', dataIndex: 'name', key: 'name' },
    { title: '订单数', dataIndex: 'orders', key: 'orders', align: 'right' },
    { title: '金额', dataIndex: 'amount', key: 'amount', align: 'right', render: (a: number) => `¥${a.toLocaleString()}` },
  ]

  const pagePadding = isMobile ? 12 : isSmall ? 16 : 24

  return (
    <div style={{ padding: pagePadding, background: '#f5f5f7', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}>经营分析</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>贸易公司常规经营指标，可按时间与维度筛选</p>
      </div>

      {/* 筛选栏 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Space wrap size={isMobile ? 'small' : 'middle'}>
          <DatePicker.RangePicker
            value={monthRange}
            onChange={(v) => setMonthRange(v as [Dayjs, Dayjs] | null)}
            picker="month"
            style={{ borderRadius: 8 }}
          />
          <Select
            placeholder="维度"
            value={dimension}
            onChange={setDimension}
            style={{ width: 120, borderRadius: 8 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'customer', label: '按客户' },
              { value: 'product', label: '按产品' },
            ]}
          />
        </Space>
        <Button icon={<ReloadOutlined />} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="销售收入" value={1250000} prefix="¥" precision={0} styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowUpOutlined /> 15.7% 较上期</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="毛利率" value={28.5} suffix="%" precision={1} styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowUpOutlined /> 8.8% 较上期</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="订单量" value={156} suffix="单" styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowUpOutlined /> 9.9% 较上期</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="客单价" value={8012} prefix="¥" precision={0} styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowUpOutlined /> 5.3% 较上期</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="回款周期" value={32} suffix="天" styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowDownOutlined /> 8.6% 较上期</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <Statistic title="净利润率" value={12.8} suffix="%" precision={1} styles={{ content: { fontSize: isMobile ? 18 : 20, color: '#111827' } }} />
            <div style={{ marginTop: 6, fontSize: 12, color: '#059669' }}><ArrowUpOutlined /> 10.3% 较上期</div>
          </Card>
        </Col>
      </Row>

      {/* 关键指标表 + 排行 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="关键指标"
            size="small"
            style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Table dataSource={mockMetrics} columns={metricColumns} pagination={false} size="small" rowKey="key" />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="畅销产品 TOP3"
            size="small"
            style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Table dataSource={mockTopProducts} columns={productColumns} pagination={false} size="small" rowKey="key" />
          </Card>
        </Col>
        <Col xs={24}>
          <Card
            title="客户金额排行 TOP3"
            size="small"
            style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            <Table dataSource={mockTopCustomers} columns={customerColumns} pagination={false} size="small" rowKey="key" />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
