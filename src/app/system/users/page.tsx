'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, message, Space, Checkbox, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { useAuthStore, type Role } from '@/lib/auth/store'

type UserRow = { id: string; username: string; name: string; role: Role; moduleKeys?: string[]; enabled?: boolean }

const moduleOptions = [
  { key: 'dashboard', label: '首页' },
  { key: 'orders', label: '订单管理' },
  { key: 'customers', label: '客户管理' },
  { key: 'products', label: '产品管理' },
  { key: 'suppliers', label: '供应商' },
  { key: 'quotation', label: '报价管理' },
  { key: 'logistics', label: '物流跟踪' },
  { key: 'finance.receivable-payable', label: '应收应付' },
  { key: 'finance.cash-flow', label: '银行流水' },
  { key: 'finance.business-analysis', label: '经营分析' },
  { key: 'feishu-sheet', label: '飞书表格' },
  { key: 'system', label: '系统管理（全部）' },
  { key: 'system.users', label: '  └ 用户管理' },
  { key: 'system.access-logs', label: '  └ 访问日志' },
  { key: 'system.alerts', label: '  └ 预警设置' },
  { key: 'system.data', label: '  └ 数据管理' },
  { key: 'system.feishu', label: '  └ 飞书配置' },
  { key: 'system.sync', label: '  └ 同步设置' },
  { key: 'system.settings', label: '  └ 系统设置' },
]

const roleOptions = [
  { label: '管理员', value: 'admin' },
  { label: '业务员', value: 'sales' },
  { label: '财务', value: 'finance' },
]

const roleColors: Record<Role, string> = {
  admin: 'red',
  sales: 'blue',
  finance: 'green',
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [form] = Form.useForm()

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data?.users ?? [])
      }
    } catch {
      message.error('加载用户失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '角色', dataIndex: 'role', key: 'role', render: (role: Role) => <Tag color={roleColors[role]}>{role}</Tag> },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', render: (v: boolean | undefined) => (v !== false ? <Tag color="green">启用</Tag> : <Tag color="default">停用</Tag>) },
    { title: '模块权限', dataIndex: 'moduleKeys', key: 'moduleKeys', ellipsis: true, render: (keys: string[] | undefined) => keys?.length ? `${keys.length} 个模块` : '按角色默认' },
    { title: '操作', key: 'actions', render: (_: unknown, record: UserRow) => (
      <Space>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
      </Space>
    )},
  ]

  const handleEdit = (user: UserRow) => {
    setEditingUser(user)
    form.setFieldsValue({ ...user, moduleKeys: user.moduleKeys ?? [], enabled: user.enabled !== false, password: '' })
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingUser(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true })
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const { password, moduleKeys, enabled, ...rest } = values
      const payload = {
        ...rest,
        moduleKeys: Array.isArray(moduleKeys) && moduleKeys.length > 0 ? moduleKeys : undefined,
        enabled: enabled !== false,
      }
      const list = editingUser
        ? users.map((u) =>
            u.id === editingUser.id
              ? { ...u, ...payload, ...(typeof password === 'string' && password.length >= 6 ? { password } : {}) }
              : u
          )
        : [...users, { id: `u${Date.now()}`, ...payload, password: password ?? '123456' }]
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', data: list }),
      })
      if (res.ok) {
        message.success('保存成功')
        setModalOpen(false)
        const state = useAuthStore.getState()
        if (state.user && editingUser?.id === state.user.id) {
          useAuthStore.setState({ user: { ...state.user, moduleKeys: payload.moduleKeys } })
        }
        fetchUsers()
      } else {
        message.error('保存失败')
      }
    } catch {
      // validation failed
    }
  }

  const handleDelete = async (id: string) => {
    const list = users.filter((u) => u.id !== id)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', data: list }),
    })
    if (res.ok) {
      message.success('已删除')
      fetchUsers()
    } else {
      message.error('删除失败')
    }
  }

  return (
    <div style={{ padding: 24 }}>

      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加用户
          </Button>
        }
      >
        <Table loading={loading} dataSource={users} columns={columns} rowKey="id" />
      </Card>

      <Modal
        title={editingUser ? '编辑用户' : '添加用户'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select placeholder="请选择角色" options={roleOptions} />
          </Form.Item>
          <Form.Item name="moduleKeys" label="模块权限" extra="留空则使用角色默认权限" initialValue={[]}>
            <Checkbox.Group
              options={moduleOptions.map((m) => ({ label: m.label, value: m.key }))}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            />
          </Form.Item>
          <Form.Item name="enabled" label="访问权限" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          {!editingUser ? (
            <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6, message: '至少6位' }]} initialValue="123456">
              <Input.Password placeholder="默认123456" />
            </Form.Item>
          ) : editingUser.id !== currentUser?.id ? (
            <Form.Item name="password" label="修改密码" extra="留空则不修改">
              <Input.Password placeholder="输入新密码（至少6位）" />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </div>
  )
}
