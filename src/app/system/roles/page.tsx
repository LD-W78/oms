'use client'

import { Card, Table, Button, Switch, Tree, message } from 'antd'
import { PlusOutlined, EditOutlined, SettingOutlined } from '@ant-design/icons'

interface PermissionNode {
  key: string
  title: string
  children?: PermissionNode[]
}

const permissionData: PermissionNode[] = [
  {
    key: 'orders',
    title: '订单管理',
    children: [
      { key: 'orders.read', title: '查看订单' },
      { key: 'orders.create', title: '创建订单' },
      { key: 'orders.update', title: '编辑订单' },
      { key: 'orders.delete', title: '删除订单' },
    ],
  },
  {
    key: 'customers',
    title: '客户管理',
    children: [
      { key: 'customers.read', title: '查看客户' },
      { key: 'customers.create', title: '添加客户' },
      { key: 'customers.update', title: '编辑客户' },
      { key: 'customers.delete', title: '删除客户' },
    ],
  },
  {
    key: 'products',
    title: '产品管理',
    children: [
      { key: 'products.read', title: '查看产品' },
      { key: 'products.create', title: '添加产品' },
      { key: 'products.update', title: '编辑产品' },
    ],
  },
]

const roleData = [
  { key: 'admin', title: '管理员', desc: '拥有所有权限', permissions: ['*'] },
  { key: 'sales', title: '业务员', desc: '订单、客户、产品、报价、物流等业务模块', permissions: ['orders.*', 'customers.*', 'products.*', 'quotation.*', 'logistics.*', 'finance.receivable-payable'] },
  { key: 'finance', title: '财务', desc: '财务模块：应收应付、银行流水、经营分析', permissions: ['finance.receivable-payable', 'finance.cash-flow', 'finance.business-analysis'] },
]

const columns = [
  { title: '角色', dataIndex: 'title', key: 'title', render: (title: string, record: typeof roleData[0]) => (
    <div>
      <strong>{title}</strong>
      <div style={{ fontSize: 12, color: '#666' }}>{record.desc}</div>
    </div>
  )},
  { title: '权限数量', key: 'count', render: (_: any, record: typeof roleData[0]) => {
    const count = record.permissions.includes('*') ? '全部' : record.permissions.length + '项'
    return count
  }},
  { title: '状态', key: 'status', render: () => <Switch defaultChecked /> },
  { title: '操作', key: 'actions', render: () => (
    <Button type="link" icon={<SettingOutlined />}>配置</Button>
  )},
]

export default function RolesPage() {
  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>角色管理</h1>
        <Button type="primary" icon={<PlusOutlined />}>添加角色</Button>
      </div>

      <Card>
        <Table dataSource={roleData} columns={columns} rowKey="key" />
      </Card>

      <Card title="权限树" style={{ marginTop: 16 }}>
        <Tree treeData={permissionData} height={300} checkable />
      </Card>
    </div>
  )
}
