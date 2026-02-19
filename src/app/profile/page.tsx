'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Form, Input, Button, message, Descriptions, Tag } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/lib/auth/store'

const roleLabels: Record<string, string> = {
  admin: '管理员',
  sales: '业务员',
  finance: '财务',
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  if (!isAuthenticated || !user) {
    router.push('/login')
    return null
  }

  const onPasswordChange = async (values: { oldPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致')
      return
    }
    if (values.newPassword.length < 6) {
      message.error('新密码至少 6 位')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        }),
      })
      const data = await res.json()
      if (data?.success) {
        message.success('密码修改成功，请重新登录')
        form.resetFields()
        useAuthStore.getState().logout()
        router.push('/login')
      } else {
        message.error(data?.error ?? '修改失败')
      }
    } catch {
      message.error('修改失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <Card title="个人中心" style={{ marginBottom: 24 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
          <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
          <Descriptions.Item label="角色">
            <Tag color={user.role === 'admin' ? 'red' : user.role === 'finance' ? 'blue' : 'green'}>
              {roleLabels[user.role] ?? user.role}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="修改密码">
        <Form form={form} layout="vertical" onFinish={onPasswordChange}>
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve()
                  return Promise.reject(new Error('两次输入的密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
