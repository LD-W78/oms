/**
 * 模块字段权限配置类型定义
 * 遵循技术规范：Schema驱动 + 动态渲染 + 零硬编码
 */

/**
 * 字段权限配置
 */
export interface FieldPermission {
  /** 是否显示该字段 */
  visible: boolean
  /** 查看权限 */
  view: boolean
  /** 新增权限 */
  create: boolean
  /** 编辑权限 */
  edit: boolean
  /** 删除权限（行级，通常统一控制） */
  delete: boolean
}

/**
 * 模块基础信息
 */
export interface ModuleBase {
  /** 模块唯一标识 */
  moduleId: string
  /** 模块显示名称 */
  moduleName: string
  /** 路由路径 */
  route: string
  /** 图标名称 */
  icon: string
  /** 父模块ID（用于子模块） */
  parentId?: string
}

/**
 * 模块配置（包含字段权限）
 */
export interface ModuleConfig extends ModuleBase {
  /** 关联的数据源表ID */
  tableId: string
  /** 字段权限映射表：fieldId -> FieldPermission */
  fieldPermissions: Record<string, FieldPermission>
}

/**
 * 模块字段配置完整结构
 * 存储在 config/module-fields.json
 */
export interface ModuleFieldsConfig {
  /** 配置版本 */
  version: string
  /** 最后更新时间 */
  lastUpdated: string
  /** 模块列表 */
  modules: ModuleConfig[]
}

/**
 * 字段权限检查选项
 */
export interface PermissionCheckOptions {
  /** 字段ID */
  fieldId: string
  /** 检查的操作类型 */
  action: 'view' | 'create' | 'edit' | 'delete'
}

/**
 * 模块字段配置Hook返回类型
 */
export interface UseModuleConfigReturn {
  /** 模块配置 */
  config: ModuleConfig | null
  /** 是否加载中 */
  loading: boolean
  /** 错误信息 */
  error: Error | null
  /** 检查字段权限 */
  checkPermission: (fieldId: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean
  /** 获取可见字段列表 */
  getVisibleFields: () => string[]
  /** 获取可创建字段列表 */
  getCreatableFields: () => string[]
  /** 获取可编辑字段列表 */
  getEditableFields: () => string[]
  /** 重新加载配置 */
  reload: () => Promise<void>
}

/**
 * 默认字段权限（全部启用）
 */
export const DEFAULT_FIELD_PERMISSION: FieldPermission = {
  visible: true,
  view: true,
  create: true,
  edit: true,
  delete: false
}

/**
 * 默认模块配置
 */
export const DEFAULT_MODULE_CONFIG: Omit<ModuleConfig, 'moduleId' | 'moduleName' | 'route' | 'icon' | 'tableId'> = {
  fieldPermissions: {}
}

/**
 * 系统预定义模块列表
 * 这些模块会在初始化时自动创建
 */
export const PREDEFINED_MODULES: Omit<ModuleConfig, 'fieldPermissions'>[] = [
  {
    moduleId: 'orders',
    moduleName: '订单管理',
    route: '/orders',
    icon: 'shopping-cart',
    tableId: 'tbl16urtK2gXVctO'
  },
  {
    moduleId: 'logistics',
    moduleName: '物流跟踪',
    route: '/logistics',
    icon: 'truck',
    tableId: 'tbl16urtK2gXVctO'
  },
  {
    moduleId: 'finance-receivable',
    moduleName: '应收应付',
    route: '/finance/receivable',
    icon: 'credit-card',
    tableId: 'tbl16urtK2gXVctO'
  },
  {
    moduleId: 'finance-cashflow',
    moduleName: '银行流水',
    route: '/finance/cashflow',
    icon: 'dollar-sign',
    tableId: 'tbl_cash_flow'
  },
  {
    moduleId: 'finance-analysis',
    moduleName: '经营分析',
    route: '/finance/analysis',
    icon: 'bar-chart-2',
    tableId: 'tbl_finance'
  }
]

/**
 * 配置文件路径
 */
export const MODULE_FIELDS_CONFIG_PATH = 'config/module-fields.json'
