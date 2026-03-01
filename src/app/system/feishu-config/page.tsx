'use client'

import { useState, useEffect } from 'react'
import { Card, Input, Row, Col, Typography, Spin } from 'antd'
import { LoadingOutlined } from '@ant-design/icons'

interface FeishuConfig {
  appId: string
  appSecret: string
  appToken: string
  cashFlowBaseToken: string
  tableOrders: string
  tableCashFlow: string
  tableFinance: string
  baseUrl: string
  dashboardUrl: string
  iframeUrls: {
    suppliers: string
    customers: string
    products: string
    operations: string
    dashboard: string
  }
}

export default function FeishuConfigPage() {
  const [config, setConfig] = useState<FeishuConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/config/feishu', { cache: 'no-store' })
      const data = await res.json()
      setConfig(data as FeishuConfig)
    } catch {
      setConfig(null)
    } finally {
      setLoading(false)
    }
  }

  const renderConfigItem = (label: string, value: string) => (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
        {label}
      </Typography.Text>
      <Input 
        value={value || '未配置'} 
        readOnly 
        style={{ backgroundColor: '#f5f5f5' }}
      />
    </div>
  )

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />} />
          <p style={{ marginTop: 16, color: '#86909C' }}>正在加载配置...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Typography.Text type="secondary">暂无配置信息</Typography.Text>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24}>
        <Col span={12}>
          <Card title="应用凭证" size="small">
            {renderConfigItem('App ID', config.appId)}
            {renderConfigItem('App Secret', config.appSecret)}
            {renderConfigItem('App Token（默认 Base）', config.appToken)}
            {renderConfigItem('现金表 Base Token', config.cashFlowBaseToken)}
            {renderConfigItem('Base URL', config.baseUrl)}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="数据表配置（API方式）" size="small">
            {renderConfigItem('应收应付/订单表 ID (oms订单表)', config.tableOrders)}
            {renderConfigItem('银行流水 ID（自动汇总现金表）', config.tableCashFlow)}
            {renderConfigItem('经营分析表 ID (oms财务表)', config.tableFinance)}
          </Card>
        </Col>
      </Row>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="飞书嵌入链接" size="small">
            <Row gutter={24}>
              <Col span={12}>
                {renderConfigItem('供应商管理链接', config.iframeUrls.suppliers)}
                {renderConfigItem('客户管理链接', config.iframeUrls.customers)}
                {renderConfigItem('产品管理链接', config.iframeUrls.products)}
              </Col>
              <Col span={12}>
                {renderConfigItem('运营管理链接', config.iframeUrls.operations)}
                {renderConfigItem('仪表板链接', config.iframeUrls.dashboard)}
                {renderConfigItem('仪表板 URL', config.dashboardUrl)}
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            提示：配置信息来自 .env.local 文件，如需修改请直接编辑该文件并重启服务。
          </Typography.Text>
        </Col>
      </Row>
    </div>
  )
}
