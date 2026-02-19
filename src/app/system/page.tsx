'use client'

import { useState } from 'react'
import { Card, Tabs } from 'antd'
import {
  UserOutlined,
  BellOutlined,
  DatabaseOutlined,
  EditOutlined,
  SettingOutlined,
  SyncOutlined,
  HistoryOutlined,
} from '@ant-design/icons'

// 导入子页面组件
import AccessLogsPage from './access-logs/page'
import AlertsPage from './alerts/page'
import DataConfigPage from './data-config/page'
import FeishuConfigPage from './feishu-config/page'
import SyncPage from './sync/page'
import UsersPage from './users/page'

const tabItems = [
  {
    key: 'users',
    label: (
      <span>
        <UserOutlined />
        <span style={{ marginLeft: 8 }}>用户管理</span>
      </span>
    ),
    children: <UsersPage />,
  },
  {
    key: 'access-logs',
    label: (
      <span>
        <HistoryOutlined />
        <span style={{ marginLeft: 8 }}>访问日志</span>
      </span>
    ),
    children: <AccessLogsPage />,
  },
  {
    key: 'alerts',
    label: (
      <span>
        <BellOutlined />
        <span style={{ marginLeft: 8 }}>预警设置</span>
      </span>
    ),
    children: <AlertsPage />,
  },
  {
    key: 'data',
    label: (
      <span>
        <DatabaseOutlined />
        <span style={{ marginLeft: 8 }}>数据管理</span>
      </span>
    ),
    children: <DataConfigPage />,
  },
  {
    key: 'feishu',
    label: (
      <span>
        <EditOutlined />
        <span style={{ marginLeft: 8 }}>飞书配置</span>
      </span>
    ),
    children: <FeishuConfigPage />,
  },
  {
    key: 'sync',
    label: (
      <span>
        <SyncOutlined />
        <span style={{ marginLeft: 8 }}>同步设置</span>
      </span>
    ),
    children: <SyncPage />,
  },
  {
    key: 'settings',
    label: (
      <span>
        <SettingOutlined />
        <span style={{ marginLeft: 8 }}>系统设置</span>
      </span>
    ),
    children: (
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', textAlign: 'center', padding: 60 }}>
        <SettingOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
        <div style={{ color: '#6b7280' }}>系统设置功能开发中</div>
      </Card>
    ),
  },
]

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%' }}>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
        items={tabItems}
        style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}
      />
    </div>
  )
}
