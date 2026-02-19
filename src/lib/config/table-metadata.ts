export type FieldType = 
  | 'text' 
  | 'number' 
  | 'currency' 
  | 'date' 
  | 'select' 
  | 'customer' 
  | 'product'
  | 'supplier'
  | 'boolean'

export interface FieldConfig {
  key: string
  label: string
  width?: number
  visible: boolean
  required?: boolean
  sortable?: boolean
  filterable?: boolean
  fieldType: FieldType
  selectOptions?: string[]
}

export interface TableConfig {
  id: string
  name: string
  route: string
  icon: string
  fields: FieldConfig[]
  enableAdd: boolean
  enableEdit: boolean
  enableDelete: boolean
  pageSize?: number
}

const TABLE_CONFIGS: Record<string, TableConfig> = {
  orders: {
    id: process.env.NEXT_PUBLIC_FEISHU_TABLE_ORDERS || 'tbl16urtK2gXVctO',
    name: '订单管理',
    route: '/orders',
    icon: 'shopping-cart',
    enableAdd: true,
    enableEdit: true,
    enableDelete: true,
    pageSize: 10,
    fields: [],
  },
}

export function getTableConfig(route: string): TableConfig | null {
  const config = Object.values(TABLE_CONFIGS).find(
    (table) => table.route === route
  )
  return config || null
}

export function getVisibleFields(route: string): FieldConfig[] {
  const config = getTableConfig(route)
  if (!config) return []
  return config.fields.filter((field) => field.visible)
}

export function getAddableFields(route: string): FieldConfig[] {
  const config = getTableConfig(route)
  if (!config) return []
  return config.fields.filter((field) => field.required || field.fieldType === 'select')
}

export function buildColumnsFromConfig(
  route: string,
  additionalRenderers?: Record<string, (value: unknown, record: Record<string, unknown>) => React.ReactNode>
): import('antd/es/table').ColumnsType<Record<string, unknown>> {
  const config = getTableConfig(route)
  if (!config) return []
  
  return config.fields
    .filter((field) => field.visible)
    .map((field) => ({
      title: field.label,
      dataIndex: field.key,
      key: field.key,
      width: field.width,
      fixed: field.key === 'id' ? ('left' as const) : undefined,
      sorter: field.sortable ? (a: Record<string, unknown>, b: Record<string, unknown>) => {
        const aVal = String(a[field.key] || '')
        const bVal = String(b[field.key] || '')
        return aVal.localeCompare(bVal)
      } : undefined,
      filters: field.filterable && field.selectOptions
        ? field.selectOptions.map((opt) => ({ text: opt, value: opt }))
        : undefined,
      onFilter: field.filterable
        ? (value, record) => record[field.key] === value
        : undefined,
      render: additionalRenderers?.[field.key] || ((value: unknown) => String(value || '')),
    }))
}
