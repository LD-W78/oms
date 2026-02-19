'use client'

import type { ColumnsType } from 'antd/es/table'
import type { FieldConfig } from '@/lib/config/table-metadata'
import { Space, Button, Tooltip } from 'antd'
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons'

interface UseDynamicColumnsOptions<T extends Record<string, unknown>> {
  additionalRenderers?: Record<string, (value: unknown, record: T) => React.ReactNode>
  actionColumn?: boolean
  onEdit?: (record: T) => void
  onDelete?: (record: T) => void
  onView?: (record: T) => void
}

export function useDynamicColumns<T extends Record<string, unknown>>(
  options: UseDynamicColumnsOptions<T> = {}
) {
  const { additionalRenderers = {}, actionColumn = true, onEdit, onDelete, onView } = options

  const buildColumns = (fields: FieldConfig[]): ColumnsType<T> => {
    const columns: ColumnsType<T> = fields
      .filter((field) => field.visible)
      .map((field) => {
        const column: Record<string, unknown> = {
          title: field.label,
          dataIndex: field.key,
          key: field.key,
          width: field.width || 120,
          fixed: field.key === 'id' || field.key === '订单号' ? 'left' : undefined,
        }

        // Add sorting
        if (field.sortable) {
          column.sorter = (a: T, b: T) => {
            const aVal = String(a[field.key] || '')
            const bVal = String(b[field.key] || '')
            return aVal.localeCompare(bVal)
          }
        }

        // Add filtering for select fields
        if (field.filterable && field.selectOptions && field.selectOptions.length > 0) {
          column.filters = field.selectOptions.map((opt) => ({ text: opt, value: opt }))
          column.onFilter = (value: unknown, record: T) => record[field.key] === value
        }

        // Add custom renderer
        if (additionalRenderers[field.key]) {
          column.render = additionalRenderers[field.key]
        } else {
          column.render = (value: unknown) => String(value ?? '')
        }

        return column as ColumnsType<T>[number]
      })

    // Add action column if needed
    if (actionColumn) {
      columns.push({
        title: '操作',
        key: 'action',
        fixed: 'right',
        width: 120,
        render: (_: unknown, record: T) => {
          const hasFormula = (record as Record<string, unknown>).hasFormula === true
          return (
            <Space size="small">
              <Tooltip title="查看详情">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  style={{ color: '#6b7280' }}
                  onClick={() => onView?.(record)}
                />
              </Tooltip>
              <Tooltip title={hasFormula ? '带公式订单不可编辑' : '编辑'}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  style={{ color: hasFormula ? '#d1d5db' : '#6b7280' }}
                  disabled={hasFormula}
                  onClick={() => !hasFormula && onEdit?.(record)}
                />
              </Tooltip>
              <Tooltip title="删除">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  style={{ color: '#6b7280' }}
                  onClick={() => onDelete?.(record)}
                />
              </Tooltip>
            </Space>
          )
        },
      } as ColumnsType<T>[number])
    }

    return columns
  }

  return { buildColumns }
}
