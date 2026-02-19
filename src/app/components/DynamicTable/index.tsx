'use client'

import { useState, useCallback } from 'react'
import { Table, Tag, Space, Button, Input, Select, Card, message } from 'antd'
import { SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons'
import type { TableColumnsType, TableProps } from 'antd'

export interface FieldSchema {
  fieldName: string
  fieldType: 'text' | 'number' | 'select' | 'date' | 'user' | 'attachment' | 'checkbox'
  options?: { label: string; value: string }[]
  required?: boolean
  width?: number | string
}

interface DynamicTableProps {
  tableId: string
  title?: string
  fields: FieldSchema[]
  onView?: (record: any) => void
  onEdit?: (record: any) => void
  onDelete?: (record: any) => void
  onAdd?: () => void
  pageSize?: number
}

export function DynamicTable({
  tableId,
  title = '数据列表',
  fields,
  onView,
  onEdit,
  onDelete,
  onAdd,
  pageSize = 10,
}: DynamicTableProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({ current: 1, pageSize, total: 0 })
  const [searchText, setSearchText] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ tableId })
      const response = await fetch(`/api/feishu/records?${params}`)
      const result = await response.json()
      
      if (result.items) {
        setData(result.items.map((item: any) => ({ ...item.fields, record_id: item.record_id })))
        setPagination(prev => ({ ...prev, total: result.items.length }))
      }
    } catch (error) {
      message.error('获取数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [tableId])

  const handleSearch = (value: string) => {
    setSearchText(value)
  }

  const filteredData = data.filter((item: any) => {
    if (!searchText) return true
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchText.toLowerCase())
    )
  })

  const renderCell = (value: any, fieldType: FieldSchema['fieldType']) => {
    if (value === null || value === undefined) return '-'

    switch (fieldType) {
      case 'select':
        const option = fields.find(f => f.fieldType === 'select')?.options?.find(o => o.value === value)
        return option?.label || value
      case 'date':
        return new Date(value).toLocaleDateString()
      case 'user':
        return value?.name || value
      case 'checkbox':
        return <Tag color={value ? 'green' : 'red'}>{value ? '是' : '否'}</Tag>
      default:
        return String(value)
    }
  }

  const columns: TableColumnsType<any> = fields.map(field => ({
    title: field.fieldName,
    dataIndex: field.fieldName,
    key: field.fieldName,
    width: field.width,
    render: (value: any) => renderCell(value, field.fieldType),
  }))

  columns.push({
    title: '操作',
    key: 'actions',
    width: 180,
    render: (_: any, record: any) => (
      <Space size="small">
        {onView && <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onView(record)}>查看</Button>}
        {onEdit && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)}>编辑</Button>}
        {onDelete && <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)}>删除</Button>}
      </Space>
    ),
  })

  const tableProps: TableProps<any> = {
    columns,
    dataSource: filteredData,
    rowKey: 'record_id',
    loading,
    pagination: { ...pagination, showSizeChanger: true, showTotal: (total: number) => `共 ${total} 条` },
    onChange: (newPagination) => setPagination(prev => ({ ...prev, current: newPagination.current || 1 })),
  }

  return (
    <Card
      title={
        <Space wrap>
          <span>{title}</span>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>刷新</Button>
        </Space>
      }
      extra={
        <Space wrap>
          <Input placeholder="搜索" prefix={<SearchOutlined />} value={searchText} onChange={(e) => handleSearch(e.target.value)} style={{ width: 200 }} allowClear />
          {onAdd && <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>}
        </Space>
      }
    >
      <Table {...tableProps} />
    </Card>
  )
}
