import type {
  ModuleFieldsConfig,
  ModuleConfig,
  FieldPermission,
  PREDEFINED_MODULES,
  DEFAULT_FIELD_PERMISSION
} from '@/types/module-fields'

const CONFIG_FILE_NAME = 'module-fields.json'

function getConfigPath(): string {
  return `${process.cwd()}/config/${CONFIG_FILE_NAME}`
}

export async function loadModuleFieldsConfig(): Promise<ModuleFieldsConfig> {
  try {
    const fs = await import('fs/promises')
    const path = getConfigPath()
    let config: ModuleFieldsConfig
    try {
      const content = await fs.readFile(path, 'utf-8')
      config = JSON.parse(content)
    } catch {
      return initializeDefaultConfig()
    }
    // 返回前按 env 解析每个模块的 tableId，与同步设置/数据源一致，保证银行流水/经营分析等能命中 schema 并展示字段权限
    config.modules = config.modules.map(m => ({
      ...m,
      tableId: getTableIdFromEnv(m.moduleId, m.tableId),
    }))
    return config
  } catch {
    return initializeDefaultConfig()
  }
}

export async function saveModuleFieldsConfig(config: ModuleFieldsConfig): Promise<void> {
  const fs = await import('fs/promises')
  const path = getConfigPath()
  
  await fs.mkdir(`${process.cwd()}/config`, { recursive: true })
  
  const configWithTimestamp: ModuleFieldsConfig = {
    ...config,
    lastUpdated: new Date().toISOString()
  }
  
  await fs.writeFile(path, JSON.stringify(configWithTimestamp, null, 2), 'utf-8')
}

/** 按模块从环境变量解析 tableId，未配置时使用预定义默认值（避免硬编码表 ID） */
function getTableIdFromEnv(moduleId: string, fallback: string): string {
  const env = process.env as Record<string, string | undefined>
  const map: Record<string, string | undefined> = {
    orders: env.FEISHU_TABLE_ORDERS,
    // 物流跟踪模块使用订单表数据
    logistics: env.FEISHU_TABLE_ORDERS,
    'finance-receivable': env.FEISHU_TABLE_ORDERS,
    'finance-cashflow': env.FEISHU_TABLE_CASH_FLOW,
    'finance-analysis': env.FEISHU_TABLE_FINANCE
  }
  return map[moduleId] ?? fallback
}

function initializeDefaultConfig(): ModuleFieldsConfig {
  const { PREDEFINED_MODULES } = require('@/types/module-fields')
  
  const modules: ModuleConfig[] = PREDEFINED_MODULES.map((mod: Omit<ModuleConfig, 'fieldPermissions'>) => ({
    ...mod,
    tableId: getTableIdFromEnv(mod.moduleId, mod.tableId),
    fieldPermissions: {}
  }))
  
  return {
    version: '1.0',
    lastUpdated: new Date().toISOString(),
    modules
  }
}

export async function getModuleConfig(moduleId: string): Promise<ModuleConfig | null> {
  const config = await loadModuleFieldsConfig()
  return config.modules.find(m => m.moduleId === moduleId) || null
}

export async function updateModuleConfig(
  moduleId: string,
  updates: Partial<ModuleConfig>
): Promise<void> {
  const config = await loadModuleFieldsConfig()
  const index = config.modules.findIndex(m => m.moduleId === moduleId)
  
  if (index >= 0) {
    config.modules[index] = { ...config.modules[index], ...updates }
  } else {
    const { PREDEFINED_MODULES } = require('@/types/module-fields')
    const baseModule = PREDEFINED_MODULES.find((m: Omit<ModuleConfig, 'fieldPermissions'>) => m.moduleId === moduleId)
    if (baseModule) {
      config.modules.push({
        ...baseModule,
        fieldPermissions: {},
        ...updates
      })
    }
  }
  
  await saveModuleFieldsConfig(config)
}

export async function updateFieldPermission(
  moduleId: string,
  fieldId: string,
  permission: FieldPermission
): Promise<void> {
  const config = await loadModuleFieldsConfig()
  const module = config.modules.find(m => m.moduleId === moduleId)
  
  if (module) {
    module.fieldPermissions[fieldId] = permission
    await saveModuleFieldsConfig(config)
  }
}

export async function batchUpdateFieldPermissions(
  moduleId: string,
  permissions: Record<string, FieldPermission>
): Promise<void> {
  const config = await loadModuleFieldsConfig()
  const module = config.modules.find(m => m.moduleId === moduleId)
  
  if (module) {
    module.fieldPermissions = { ...module.fieldPermissions, ...permissions }
    await saveModuleFieldsConfig(config)
  }
}

export function checkFieldPermission(
  moduleConfig: ModuleConfig | null,
  fieldId: string,
  action: 'view' | 'create' | 'edit' | 'delete'
): boolean {
  if (!moduleConfig) return true
  
  const permission = moduleConfig.fieldPermissions[fieldId]
  
  if (!permission) return true
  
  if (!permission.visible && action === 'view') return false
  
  return permission[action] ?? true
}

export function getVisibleFields(moduleConfig: ModuleConfig | null): string[] {
  if (!moduleConfig) return []
  
  return Object.entries(moduleConfig.fieldPermissions)
    .filter(([_, perm]) => perm.visible)
    .map(([fieldId]) => fieldId)
}

export function getCreatableFields(moduleConfig: ModuleConfig | null): string[] {
  if (!moduleConfig) return []
  
  return Object.entries(moduleConfig.fieldPermissions)
    .filter(([_, perm]) => perm.visible && perm.create)
    .map(([fieldId]) => fieldId)
}

export function getEditableFields(moduleConfig: ModuleConfig | null): string[] {
  if (!moduleConfig) return []
  
  return Object.entries(moduleConfig.fieldPermissions)
    .filter(([_, perm]) => perm.visible && perm.edit)
    .map(([fieldId]) => fieldId)
}
