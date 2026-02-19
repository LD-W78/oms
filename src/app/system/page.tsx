'use client'

import { useState, useMemo } from 'react'
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

import { useAuthStore } from '@/lib/auth/store'
import AccessLogsPage from './access-logs/page'
import AlertsPage from './alerts/page'
import DataConfigPage from './data-config/page'
import FeishuConfigPage from './feishu-config/page'
import SyncPage from './sync/page'
import UsersPage from './users/page'

const ALL_TAB_ITEMS = [
  { key: 'users', moduleKey: 'system.users', label: '用户管理', icon: UserOutlined, children: <UsersPage /> },
  { key: 'access-logs', moduleKey: 'system.access-logs', label: '访问日志', icon: HistoryOutlined, children: <AccessLogsPage /> },
  { key: 'alerts', moduleKey: 'system.alerts', label: '预警设置', icon: BellOutlined, children: <AlertsPage /> },
  { key: 'data', moduleKey: 'system.data', label: '数据管理', icon: DatabaseOutlined, children: <DataConfigPage /> },
  { key: 'feishu', moduleKey: 'system.feishu', label: '飞书配置', icon: EditOutlined, children: <FeishuConfigPage /> },
  { key: 'sync', moduleKey: 'system.sync', label: '同步设置', icon: SyncOutlined, children: <SyncPage /> },
  { key: 'settings', moduleKey: 'system.settings', label: '系统设置', icon: SettingOutlined, children: (
    <Card style={{ borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', textAlign: 'center', padding: 60 }}>
      <SettingOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16 }} />
      <div style={{ color: '#6b7280' }}>系统设置功能开发中</div>
    </Card>
  ) },
]

export default function SystemPage() {
  const canAccessModule = useAuthStore((s) => s.canAccessModule)
  const filteredItems = useMemo(
    () => ALL_TAB_ITEMS.filter((t) => canAccessModule(t.moduleKey)).map((t) => ({
      key: t.key,
      label: (
        <span>
          <t.icon />
          <span style={{ marginLeft: 8 }}>{t.label}</span>
        </span>
      ),
      children: t.children,
    })),
    [canAccessModule]
  )
  const defaultKey = filteredItems[0]?.key ?? 'users'
  const [activeTab, setActiveTab] = useState(defaultKey)

  if (filteredItems.length === 0) {
    return (
      <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%', textAlign: 'center' }}>
        <Card>
          <div style={{ color: '#6b7280', padding: 48 }}>您没有系统管理相关权限，请联系管理员</div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%' }}>
      <Tabs
        activeKey={filteredItems.some((t) => t.key === activeTab) ? activeTab : defaultKey}
        onChange={(key) => setActiveTab(key)}
        items={filteredItems}
        style={{ borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}
      />
    </div>
  )
}
