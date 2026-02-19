'use client'

import { useState } from 'react'
import { App, Card, Tabs, Input, InputNumber, Select, Checkbox, Button, Row, Col, Space } from 'antd'
import {
  FileTextOutlined,
  FileAddOutlined,
  HistoryOutlined,
  DollarOutlined,
} from '@ant-design/icons'

interface QuotationFormData {
  factoryName: string
  productName: string
  quantity: number
  packageSpec: string
  currency: string
  hasTaxRefund: boolean
  tradeTerm: 'FOB' | 'CIF'
  unitPrice: number
  bankFeeRate: number
  profitRate: number
  inlandFreight: number
}

const initialData: QuotationFormData = {
  factoryName: '',
  productName: '环己酮',
  quantity: 28,
  packageSpec: '28MT/GP40x1/19 Tan',
  currency: 'USD',
  hasTaxRefund: true,
  tradeTerm: 'FOB',
  unitPrice: 20505.18,
  bankFeeRate: 0.15,
  profitRate: 5,
  inlandFreight: 1500,
}

export default function QuotationPage() {
  const { message } = App.useApp()
  const [formData, setFormData] = useState<QuotationFormData>(initialData)

  const calculateSummary = () => {
    const productCost = formData.quantity * formData.unitPrice
    const bankFee = productCost * (formData.bankFeeRate / 100)
    const profit = productCost * (formData.profitRate / 100)
    const taxCost = formData.hasTaxRefund ? productCost * 0.13 : 0
    const total = productCost + taxCost + formData.inlandFreight + bankFee + profit

    return { productCost, bankFee, profit, taxCost, inlandFreight: formData.inlandFreight, total }
  }

  const summary = calculateSummary()

  const tabItems = [
    {
      key: 'calculate',
      label: <span><FileTextOutlined /> 1. 报价核算</span>,
      children: (
        <Card>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>1</span>
              基础信息设置
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>工厂名称</div>
                  <Input placeholder="输入工厂名称" value={formData.factoryName} onChange={(e) => setFormData({...formData, factoryName: e.target.value})} />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>产品名称</div>
                  <Input value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value})} />
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>数量 (MT)</div>
                  <InputNumber style={{ width: '100%' }} value={formData.quantity} onChange={(value) => setFormData({...formData, quantity: value || 0})} />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>包装规格</div>
                  <Input value={formData.packageSpec} onChange={(e) => setFormData({...formData, packageSpec: e.target.value})} />
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>货币单位</div>
                  <Select style={{ width: '100%' }} value={formData.currency} onChange={(value) => setFormData({...formData, currency: value})} options={[{ value: 'USD', label: 'USD (美元)' }, { value: 'CNY', label: 'CNY (人民币)' }]} />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16, paddingTop: 8 }}>
                  <Checkbox checked={formData.hasTaxRefund} onChange={(e) => setFormData({...formData, hasTaxRefund: e.target.checked})}>13%退税率</Checkbox>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>2</span>
              贸易条款选择
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <div onClick={() => setFormData({...formData, tradeTerm: 'FOB'})} style={{ border: `2px solid ${formData.tradeTerm === 'FOB' ? '#1976d2' : '#e5e7eb'}`, borderRadius: 8, padding: 16, cursor: 'pointer', background: formData.tradeTerm === 'FOB' ? '#f0f7ff' : '#fff' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>FOB (Free On Board)</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>装运港船上交货</div>
                  <div style={{ fontSize: 12, color: '#10b981' }}>✓ 含: 货物成本+内陆运费+港口费用</div>
                  <div style={{ fontSize: 12, color: '#ef4444' }}>× 不含: 国际海运+保险</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>买方负责海运费及保险费</div>
                </div>
              </Col>
              <Col span={12}>
                <div onClick={() => setFormData({...formData, tradeTerm: 'CIF'})} style={{ border: `2px solid ${formData.tradeTerm === 'CIF' ? '#1976d2' : '#e5e7eb'}`, borderRadius: 8, padding: 16, cursor: 'pointer', background: formData.tradeTerm === 'CIF' ? '#f0f7ff' : '#fff' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>CIF (Cost Insurance Freight)</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>成本加保险费运费</div>
                  <div style={{ fontSize: 12, color: '#10b981' }}>✓ 含: FOB全部+国际海运+保险</div>
                  <div style={{ fontSize: 12, color: '#10b981' }}>✓ 目的港卸货前风险由卖方承担</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>卖方负责安排运输及保险</div>
                </div>
              </Col>
            </Row>
          </div>

          <div style={{ paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>3</span>
              货物成本 (PRODUCT COST)
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>货物成本单价</div>
                  <Space.Compact>
                    <InputNumber style={{ width: '60%' }} value={formData.unitPrice} onChange={(value) => setFormData({...formData, unitPrice: value || 0})} />
                    <Input style={{ width: '40%', textAlign: 'center' }} value="USD" disabled />
                  </Space.Compact>
                  <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>USD {summary.productCost.toLocaleString()}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>银行手续费率 (%)</div>
                  <Space.Compact>
                    <InputNumber style={{ width: '60%' }} value={formData.bankFeeRate} onChange={(value) => setFormData({...formData, bankFeeRate: value || 0})} />
                    <Input style={{ width: '40%', textAlign: 'center' }} value="%" disabled />
                  </Space.Compact>
                  <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>USD {summary.bankFee.toFixed(2)}</div>
                </div>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>利润 (%)</div>
                  <Space.Compact>
                    <InputNumber style={{ width: '60%' }} value={formData.profitRate} onChange={(value) => setFormData({...formData, profitRate: value || 0})} />
                    <Input style={{ width: '40%', textAlign: 'center' }} value="%" disabled />
                  </Space.Compact>
                  <div style={{ fontSize: 12, color: '#1976d2', marginTop: 4 }}>USD {summary.profit.toFixed(2)}</div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>内陆运费 (USD)</div>
                  <InputNumber style={{ width: '100%' }} value={formData.inlandFreight} onChange={(value) => setFormData({...formData, inlandFreight: value || 0})} />
                </div>
              </Col>
            </Row>
          </div>
        </Card>
      ),
    },
    {
      key: 'pi',
      label: <span><FileAddOutlined /> 2. 报价生成(PI)</span>,
      children: <Card><div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}><FileAddOutlined style={{ fontSize: 48, marginBottom: 16 }} /><div>请先完成报价核算，然后生成PI</div></div></Card>,
    },
    {
      key: 'history',
      label: <span><HistoryOutlined /> 3. 历史记录</span>,
      children: <Card><div style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}><HistoryOutlined style={{ fontSize: 48, marginBottom: 16 }} /><div>暂无历史记录</div></div></Card>,
    },
  ]

  const handleGeneratePI = () => message.success('PI报价单生成成功')
  const handleSaveDraft = () => message.success('草稿保存成功')

  return (
    <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#111827' }}><DollarOutlined style={{ marginRight: 8 }} />报价管理</h2>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>USD/CNY: 7.2450</div>
      </div>
      <Tabs defaultActiveKey="calculate" items={tabItems} />
      {formData.tradeTerm && (
        <Card style={{ marginTop: 24, background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><DollarOutlined />报价汇总</div>
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>货物成本</span><span style={{ fontWeight: 500 }}>USD {summary.productCost.toLocaleString()}</span></div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>税费成本</span><span style={{ fontWeight: 500 }}>USD {summary.taxCost.toFixed(2)}</span></div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>内陆运费</span><span style={{ fontWeight: 500 }}>USD {summary.inlandFreight.toFixed(2)}</span></div>
            </Col>
            <Col span={12}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>银行手续费</span><span style={{ fontWeight: 500 }}>USD {summary.bankFee.toFixed(2)}</span></div>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#6b7280' }}>利润</span><span style={{ fontWeight: 500 }}>USD {summary.profit.toFixed(2)}</span></div>
              <div style={{ paddingTop: 12, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 600 }}>总计</span><span style={{ fontSize: 20, fontWeight: 700, color: '#1976d2' }}>USD {summary.total.toLocaleString()}</span></div>
            </Col>
          </Row>
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <Button type="primary" size="large" onClick={handleGeneratePI}>生成PI报价单</Button>
            <Button size="large" onClick={handleSaveDraft}>保存草稿</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
