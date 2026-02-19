'use client'

import { useState, useEffect, useCallback } from 'react'
import { App, Card, Table, Button, Space, Tag, Checkbox, Collapse, Badge } from 'antd'
import { ReloadOutlined, SaveOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { ModuleConfig, FieldPermission, ModuleFieldsConfig } from '@/types/module-fields'
import { PREDEFINED_MODULES } from '@/types/module-fields'

interface TableSchema {
  tableId: string
  tableName: string
  fields: Array<{
    fieldId: string
    fieldName: string
    fieldType: string
  }>
  syncedAt: string
}

interface DataSourceStatus {
  key: string
  tableId: string
  tableName: string
  fieldCount: number
  lastSyncedAt: string
  isAvailable: boolean
}

interface ModuleFieldRow {
  key: string
  fieldId: string
  fieldName: string
  permission: FieldPermission
}

export default function DataConfigPage() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([])
  const [moduleConfigs, setModuleConfigs] = useState<Record<string, ModuleConfig>>({})
  const [schemas, setSchemas] = useState<Record<string, TableSchema>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. 表列表来自同步设置（env 配置的 table id + 飞书真实表名），与同步设置页一致
      const syncRes = await fetch('/api/feishu/schema/sync-all')
      const syncResult = await syncRes.json()
      if (!syncResult.success) {
        message.error('获取同步表列表失败：' + (syncResult.error || '未知错误'))
        setLoading(false)
        return
      }
      const syncTables: Array<{ tableId: string; tableName: string; fieldCount: number; lastSyncedAt: string; status: string }> = syncResult.tables || []

      // 2. 模块配置（字段权限）仍从 config 拉取
      const configRes = await fetch('/api/config/modules')
      const config: ModuleFieldsConfig = await configRes.json()
      const configsMap: Record<string, ModuleConfig> = {}
      config.modules.forEach(m => {
        configsMap[m.moduleId] = m
      })
      PREDEFINED_MODULES.forEach(mod => {
        if (!configsMap[mod.moduleId]) {
          configsMap[mod.moduleId] = {
            ...mod,
            fieldPermissions: {}
          }
        }
      })
      setModuleConfigs(configsMap)

      // 3. 按同步设置结果拉取各表 schema（与同步设置里 schema 缓存一致）
      const schemaResults = await Promise.all(
        syncTables.map(t =>
          fetch(`/api/schema/${t.tableId}`)
            .then(res => res.ok ? res.json() : null)
            .catch(() => null)
        )
      )
      const schemasMap: Record<string, TableSchema> = {}
      syncTables.forEach((t, index) => {
        const schema = schemaResults[index]
        if (schema && schema.fields) schemasMap[t.tableId] = schema
      })
      const dataSourcesList: DataSourceStatus[] = syncTables.map(t => ({
        key: t.tableId,
        tableId: t.tableId,
        tableName: t.tableName,
        fieldCount: t.fieldCount,
        lastSyncedAt: t.lastSyncedAt,
        isAvailable: t.status === '已同步',
      }))
      setSchemas(schemasMap)
      setDataSources(dataSourcesList)
    } catch (error) {
      message.error('加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    setSaving(true)
    try {
      const config: ModuleFieldsConfig = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        modules: Object.values(moduleConfigs)
      }

      const response = await fetch('/api/config/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', data: config })
      })

      if (response.ok) {
        message.success('配置保存成功')
        if (typeof BroadcastChannel !== 'undefined') {
          new BroadcastChannel('oms_module_config').postMessage({ type: 'config-saved' })
        }
      } else {
        throw new Error('Save failed')
      }
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const updateFieldPermission = (moduleId: string, fieldId: string, updates: Partial<FieldPermission>) => {
    setModuleConfigs(prev => {
      const config = prev[moduleId]
      if (!config) return prev

      const currentPermission = config.fieldPermissions[fieldId] || {
        visible: true, view: true, create: true, edit: true, delete: false
      }

      return {
        ...prev,
        [moduleId]: {
          ...config,
          fieldPermissions: {
            ...config.fieldPermissions,
            [fieldId]: { ...currentPermission, ...updates }
          }
        }
      }
    })
  }

  const dataSourceColumns: ColumnsType<DataSourceStatus> = [
    { title: '表名', dataIndex: 'tableName', key: 'tableName' },
    { title: '表ID', dataIndex: 'tableId', key: 'tableId', ellipsis: true },
    { title: '字段数', dataIndex: 'fieldCount', key: 'fieldCount', width: 100 },
    {
      title: '同步状态',
      key: 'status',
      width: 120,
      render: (_, record) => (
        record.isAvailable ? (
          <Tag icon={<CheckCircleOutlined />} color="success">已同步</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">未同步</Tag>
        )
      )
    },
    {
      title: '最后同步',
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
      render: (date: string) => new Date(date).toLocaleString()
    }
  ]

  const renderModuleConfig = (moduleConfig: ModuleConfig) => {
    const schema = schemas[moduleConfig.tableId]
    if (!schema) return null

    const fields: ModuleFieldRow[] = schema.fields.map((field, index) => {
      const permission = moduleConfig.fieldPermissions[field.fieldId] || {
        visible: true, view: true, create: true, edit: true, delete: false
      }
      return {
        key: `${moduleConfig.moduleId}_${field.fieldId}`,
        fieldId: field.fieldId,
        fieldName: field.fieldName,
        permission
      }
    })

    const visibleCount = fields.filter(f => f.permission.visible).length
    const totalCount = fields.length

    const fieldColumns: ColumnsType<ModuleFieldRow> = [
      {
        title: '字段名',
        dataIndex: 'fieldName',
        key: 'fieldName',
        width: 200
      },
      {
        title: '显示',
        key: 'visible',
        width: 80,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.permission.visible}
            onChange={(e) => updateFieldPermission(
              moduleConfig.moduleId,
              record.fieldId,
              { visible: e.target.checked }
            )}
          />
        )
      },
      {
        title: '查看',
        key: 'view',
        width: 80,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.permission.view}
            disabled={!record.permission.visible}
            onChange={(e) => updateFieldPermission(
              moduleConfig.moduleId,
              record.fieldId,
              { view: e.target.checked }
            )}
          />
        )
      },
      {
        title: '新增',
        key: 'create',
        width: 80,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.permission.create}
            disabled={!record.permission.visible}
            onChange={(e) => updateFieldPermission(
              moduleConfig.moduleId,
              record.fieldId,
              { create: e.target.checked }
            )}
          />
        )
      },
      {
        title: '编辑',
        key: 'edit',
        width: 80,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.permission.edit}
            disabled={!record.permission.visible}
            onChange={(e) => updateFieldPermission(
              moduleConfig.moduleId,
              record.fieldId,
              { edit: e.target.checked }
            )}
          />
        )
      },
      {
        title: '删除',
        key: 'delete',
        width: 80,
        align: 'center',
        render: (_, record) => (
          <Checkbox
            checked={record.permission.delete}
            disabled={!record.permission.visible}
            onChange={(e) => updateFieldPermission(
              moduleConfig.moduleId,
              record.fieldId,
              { delete: e.target.checked }
            )}
          />
        )
      }
    ]

    return (
      <Card
        key={moduleConfig.moduleId}
        title={
          <Space>
            <span>{moduleConfig.moduleName}</span>
            <Tag color="blue">{moduleConfig.route}</Tag>
            <Badge
              count={`${visibleCount}/${totalCount}`}
              style={{ backgroundColor: visibleCount === 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Space>
        }
        size="small"
        style={{ marginBottom: 16 }}
      >
        <div style={{ marginBottom: 8 }}>
          <Space>
            <span>使用表:</span>
            <Tag>{schema.tableName || moduleConfig.tableId}</Tag>
          </Space>
        </div>
        <Table
          columns={fieldColumns}
          dataSource={fields}
          pagination={false}
          size="small"
          scroll={{ y: 300 }}
        />
      </Card>
    )
  }

  const collapseItems = Object.values(moduleConfigs).map(config => ({
    key: config.moduleId,
    label: (
      <Space>
        <span>{config.moduleName}</span>
        <Tag color="blue">{config.route}</Tag>
      </Space>
    ),
    children: renderModuleConfig(config)
  }))

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="数据源状态"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          columns={dataSourceColumns}
          dataSource={dataSources}
          pagination={false}
          loading={loading}
        />
      </Card>

      <Card
        title="模块字段权限配置"
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存配置
          </Button>
        }
      >
        <p style={{ color: '#666', marginBottom: 16 }}>
          为每个功能模块配置可见字段及其操作权限。勾选表示启用该权限。
        </p>
        <Collapse items={collapseItems} defaultActiveKey={['orders']} />
      </Card>
    </div>
  )
}
