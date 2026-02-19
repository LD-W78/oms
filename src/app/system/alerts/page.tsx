'use client'

import { useState } from 'react'
import { Card, Table, Button, Space, Switch, Tag, Modal, Form, Input, InputNumber, Select, TimePicker, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, BellOutlined, TruckOutlined, ExclamationCircleOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { getLogisticsAlertRules } from '@/lib/config/alert-rules'

interface AlertRule {
  key: string
  ruleName: string
  alertType: '合同超期' | '回款超期' | '物流超期' | '库存预警' | '订单异常'
  condition: string
  threshold: number
  unit: string
  channel: string
  status: '启用' | '停用'
}

const alertData: AlertRule[] = [
  { key: '1', ruleName: '合同即将超期提醒', alertType: '合同超期', condition: '提前', threshold: 7, unit: '天', channel: '邮件+短信', status: '启用' },
  { key: '2', ruleName: '回款超期提醒', alertType: '回款超期', condition: '超过', threshold: 0, unit: '天', channel: '邮件', status: '启用' },
  { key: '3', ruleName: '物流延误提醒', alertType: '物流超期', condition: '超过', threshold: 3, unit: '天', channel: '邮件+短信', status: '启用' },
  { key: '4', ruleName: '库存不足预警', alertType: '库存预警', condition: '低于', threshold: 100, unit: '件', channel: '系统通知', status: '停用' },
  { key: '5', ruleName: '大额订单预警', alertType: '订单异常', condition: '超过', threshold: 50000, unit: '元', channel: '邮件', status: '启用' },
]

const columns: ColumnsType<AlertRule> = [
  { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName' },
  {
    title: '预警类型',
    dataIndex: 'alertType',
    key: 'alertType',
    render: (type: string) => {
      const colorMap: Record<string, string> = {
        '合同超期': 'blue',
        '回款超期': 'red',
        '物流超期': 'orange',
        '库存预警': 'purple',
        '订单异常': 'cyan',
      }
      return <Tag color={colorMap[type]}>{type}</Tag>
    },
  },
  {
    title: '触发条件',
    key: 'condition',
    render: (_, record) => `${record.condition} ${record.threshold} ${record.unit}`,
  },
  { title: '通知渠道', dataIndex: 'channel', key: 'channel' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Switch
        checked={status === '启用'}
        checkedChildren="启用"
        unCheckedChildren="停用"
      />
    ),
  },
  {
    title: '操作',
    key: 'action',
    render: () => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
      </Space>
    ),
  },
]

export default function AlertsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const handleAdd = () => {
    setIsModalOpen(true)
  }

  const handleOk = () => {
    form.validateFields().then(() => {
      message.success('预警规则保存成功')
      setIsModalOpen(false)
      form.resetFields()
    })
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    form.resetFields()
  }

  const logisticsRules = getLogisticsAlertRules()

  return (
    <div style={{ padding: 24 }}>
      {/* 物流跟踪模块预警规则（来自 config/alert-rules.json） */}
      {logisticsRules && (
        <Card
          title={
            <span>
              <TruckOutlined style={{ marginRight: 8 }} />
              {logisticsRules.moduleName} 预警规则
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280' }}>
            参数：到港前 {logisticsRules.params.arrivingDays} 天提醒 · 延误 {logisticsRules.params.delayDays} 天预警
          </div>
          <Table
            size="small"
            dataSource={logisticsRules.rules}
            rowKey="id"
            pagination={false}
            columns={[
              {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                width: 100,
                render: (type: string) => {
                  const config = {
                    error: { icon: <ExclamationCircleOutlined />, color: '#dc2626', label: '错误' },
                    warning: { icon: <WarningOutlined />, color: '#d97706', label: '警告' },
                    info: { icon: <InfoCircleOutlined />, color: '#2563eb', label: '信息' },
                  }[type] ?? { icon: null, color: '#6b7280', label: type }
                  return (
                    <Tag color={config.color} style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'fit-content' }}>
                      {config.icon}
                      {config.label}
                    </Tag>
                  )
                },
              },
              { title: '触发条件', dataIndex: 'conditionDesc', key: 'conditionDesc', ellipsis: true },
              { title: '提示文案', dataIndex: 'message', key: 'message', ellipsis: true },
              {
                title: '阈值',
                key: 'threshold',
                render: (_, r) => (r.threshold != null ? `${r.threshold} ${r.unit ?? ''}` : '-'),
              },
              {
                title: '状态',
                dataIndex: 'enabled',
                key: 'enabled',
                width: 80,
                render: (enabled: boolean) => (
                  <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '停用'}</Tag>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Card
        title={
          <span>
            <BellOutlined style={{ marginRight: 8 }} />
            系统通知
          </span>
        }
      >
        <Table
          columns={columns}
          dataSource={alertData}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="预警规则配置"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ruleName" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item name="alertType" label="预警类型" rules={[{ required: true }]}>
            <Select placeholder="请选择预警类型">
              <Select.Option value="contract">合同超期</Select.Option>
              <Select.Option value="payment">回款超期</Select.Option>
              <Select.Option value="logistics">物流超期</Select.Option>
              <Select.Option value="inventory">库存预警</Select.Option>
              <Select.Option value="order">订单异常</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="触发条件" required>
            <Space>
              <Form.Item name="condition" noStyle rules={[{ required: true }]}>
                <Select style={{ width: 120 }}>
                  <Select.Option value="before">提前</Select.Option>
                  <Select.Option value="after">超过</Select.Option>
                  <Select.Option value="below">低于</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="threshold" noStyle rules={[{ required: true }]}>
                <InputNumber min={0} placeholder="数值" />
              </Form.Item>
              <Form.Item name="unit" noStyle rules={[{ required: true }]}>
                <Select style={{ width: 100 }}>
                  <Select.Option value="day">天</Select.Option>
                  <Select.Option value="hour">小时</Select.Option>
                  <Select.Option value="amount">元</Select.Option>
                  <Select.Option value="quantity">件</Select.Option>
                </Select>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item name="channel" label="通知渠道" rules={[{ required: true }]}>
            <Select placeholder="请选择通知渠道">
              <Select.Option value="email">邮件</Select.Option>
              <Select.Option value="sms">短信</Select.Option>
              <Select.Option value="both">邮件+短信</Select.Option>
              <Select.Option value="notification">系统通知</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="recipients" label="通知人员">
            <Input placeholder="请输入通知人员邮箱或手机号，多个用逗号分隔" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
