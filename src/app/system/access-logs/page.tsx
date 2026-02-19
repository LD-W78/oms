'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, Table, message } from 'antd'
import { HistoryOutlined } from '@ant-design/icons'

interface AccessLogEntry {
  id: string
  username: string
  loginTime: string
  logoutTime?: string
}

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/access-logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data?.logs ?? [])
      }
    } catch {
      message.error('加载访问日志失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleString('zh-CN')
    } catch {
      return iso
    }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    { title: '登录时间', dataIndex: 'loginTime', key: 'loginTime', render: (v: string) => formatTime(v) },
    { title: '退出时间', dataIndex: 'logoutTime', key: 'logoutTime', render: (v: string) => (v ? formatTime(v) : '-') },
  ]

  return (
    <Card title={<span><HistoryOutlined style={{ marginRight: 8 }} />用户访问日志</span>}>
      <Table
        loading={loading}
        dataSource={logs}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />
    </Card>
  )
}
