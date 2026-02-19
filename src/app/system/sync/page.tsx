'use client'

import { useState, useEffect } from 'react'
import { Card, Row, Col, Button, Table, Tag, App, Typography, Alert } from 'antd'
import { SyncOutlined, ApiOutlined, TableOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface TableSchemaInfo {
  key: string
  tableName: string
  tableId: string
  fieldCount: number
  lastSyncedAt: string
  status: '已同步' | '未同步' | '同步中' | '未配置'
}

export default function SyncPage() {
  const { message } = App.useApp()
  const [tables, setTables] = useState<TableSchemaInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncingTable, setSyncingTable] = useState<string | null>(null)

  useEffect(() => {
    fetchTableList()
  }, [])

  const fetchTableList = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/feishu/schema/sync-all')
      const result = await response.json()
      
      if (result.success) {
        setTables(result.tables.map((t: any, index: number) => ({
          key: String(index + 1),
          tableName: t.tableName,
          tableId: t.tableId,
          fieldCount: t.fieldCount,
          lastSyncedAt: t.lastSyncedAt,
          status: t.status,
        })))
      } else {
        message.error('获取表列表失败：' + (result.error || '未知错误'))
      }
    } catch (error) {
      console.error('Fetch table list failed:', error)
      message.error('获取表列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    try {
      const response = await fetch('/api/feishu/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success('飞书连接正常！')
      } else {
        message.error('连接测试失败：' + (result.error || '未知错误'))
      }
    } catch (error) {
      message.error('连接测试失败：' + String(error))
    } finally {
      setTesting(false)
    }
  }

  const handleSyncAll = async () => {
    const unconfiguredTables = tables.filter(t => t.status === '未配置')
    if (unconfiguredTables.length > 0) {
      message.warning(`${unconfiguredTables.map(t => t.tableName).join('、')} 未配置，请先在.env.local中配置表ID`)
    }

    setSyncingAll(true)
    try {
      setTables(prev => prev.map(t => 
        t.status !== '未配置' ? { ...t, status: '同步中' as const } : t
      ))
      
      const response = await fetch('/api/feishu/schema/sync-all', {
        method: 'POST',
      })
      
      const result = await response.json()
      const tables = result.tables || []
      const successCount = tables.filter((t: { status: string }) => t.status === '已同步').length
      const failedCount = result.failed?.length ?? 0

      if (result.success) {
        message.success(`已同步 ${successCount} 个表的Schema`)
      } else if (successCount > 0) {
        message.warning(`已同步 ${successCount} 个表${failedCount > 0 ? `，${failedCount} 个失败` : ''}`)
      } else {
        message.error(result.failed?.[0]?.error || result.error || '同步失败')
      }
      fetchTableList()
    } catch (error) {
      message.error('同步失败：' + String(error))
      fetchTableList()
    } finally {
      setSyncingAll(false)
    }
  }

  const handleSyncTable = async (tableId: string, tableName: string, status: string) => {
    if (status === '未配置') {
      message.warning(`请先在.env.local中配置 ${tableName} 的表ID`)
      return
    }

    setSyncingTable(tableId)
    try {
      setTables(prev => prev.map(t => 
        t.tableId === tableId ? { ...t, status: '同步中' as const } : t
      ))
      
      const response = await fetch(`/api/feishu/schema/sync/${tableId}`, {
        method: 'POST',
      })
      
      const result = await response.json()
      
      if (result.success) {
        message.success(`${tableName} Schema已更新！`)
        fetchTableList()
      } else {
        throw new Error(result.error || '同步失败')
      }
    } catch (error) {
      message.error(`${tableName}同步失败：${String(error)}`)
      fetchTableList()
    } finally {
      setSyncingTable(null)
    }
  }

  const tableColumns: ColumnsType<TableSchemaInfo> = [
    {
      title: '表名',
      dataIndex: 'tableName',
      key: 'tableName',
      render: (text: string) => (
        <span><TableOutlined style={{ marginRight: 8 }} />{text}</span>
      ),
    },
    {
      title: '字段数',
      dataIndex: 'fieldCount',
      key: 'fieldCount',
      width: 100,
    },
    {
      title: '上次同步',
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          '已同步': 'success',
          '未同步': 'default',
          '同步中': 'processing',
          '未配置': 'error',
        }
        return <Tag color={colorMap[status]}>{status}</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (record.status === '未配置') {
          return (
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => message.info(`请在.env.local中配置 ${record.tableName} 的表ID`)}
            >
              配置
            </Button>
          )
        }
        return (
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={syncingTable === record.tableId}
            disabled={syncingAll || record.status === '同步中'}
            onClick={() => handleSyncTable(record.tableId, record.tableName, record.status)}
          >
            刷新
          </Button>
        )
      },
    },
  ]

  const unconfiguredCount = tables.filter(t => t.status === '未配置').length

  return (
    <div style={{ padding: 24 }}>
      {unconfiguredCount > 0 && (
        <Alert
          title="配置提示"
          description={`${tables.filter(t => t.status === '未配置').map(t => t.tableName).join('、')} 未配置表ID，请在.env.local文件中添加相应的环境变量`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Schema同步管理
          </Typography.Text>
          <Button
            icon={<ApiOutlined />}
            loading={testing}
            onClick={handleTestConnection}
          >
            测试连接
          </Button>
          <Button
            type="primary"
            icon={<SyncOutlined />}
            loading={syncingAll}
            disabled={syncingTable !== null}
            onClick={handleSyncAll}
          >
            全部同步
          </Button>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          提示：当飞书表结构发生变更（如添加字段）后，点击"全部同步"或单表"刷新"更新Schema
        </Typography.Text>
      </Card>

      <Card title="各表Schema状态">
        <Table
          columns={tableColumns}
          dataSource={tables}
          pagination={false}
          size="small"
          loading={loading}
        />
      </Card>
    </div>
  )
}
