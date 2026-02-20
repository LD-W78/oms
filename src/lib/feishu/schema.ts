import { feishuClient } from '@/lib/feishu/client'
import { TABLE_IDS } from '@/lib/config/env'
import { saveSchemaCache, getSchemaCache } from './schema-cache'
import type { TableSchema, FieldSchema, TableSchemaStats, FieldCategory, FieldFormat } from './types'
import {
  applyFieldMapping,
  applyFieldMappingBatch,
  categorizeFields,
  getMappingStats,
  type MappedField
} from './field-mapping'

export type { TableSchema, FieldSchema } from './types'
export { applyFieldMapping, applyFieldMappingBatch, categorizeFields, getMappingStats }
export type { MappedField }

// 内存中的Schema缓存
const schemaCache: Map<string, TableSchema> = new Map()

// 同步设置中的表：table id 来自 .env.local（TABLE_IDS），表名同步后使用飞书真实表名（feishuSchema.name）
// 说明：物流跟踪模块使用订单表数据，因此不再单独配置/同步「物流表」
const SYNC_TABLES = [
  { id: TABLE_IDS.orders, name: 'oms订单表', key: 'orders' },
  { id: TABLE_IDS.cashFlow, name: 'oms现金表', key: 'cashFlow' },
  { id: TABLE_IDS.finance, name: 'oms财务表', key: 'finance' },
] as const

const tableIdToName: Record<string, string> = {
  [TABLE_IDS.orders || '']: 'oms订单表',
  [TABLE_IDS.cashFlow || '']: 'oms现金表',
  [TABLE_IDS.finance || '']: 'oms财务表',
}

function getDataKey(fieldName: string): string {
  const chineseCharCount = (fieldName.match(/[\u4e00-\u9fa5]/g) || []).length
  const totalCharCount = fieldName.replace(/\s/g, '').length
  
  if (chineseCharCount > totalCharCount * 0.5) {
    return fieldName.replace(/[:：]/g, '').trim()
  }

  return fieldName
    .replace(/[：:]/g, ' ')
    .split(/[\s_\-]+/)
    .map((word, i) => {
      if (i === 0) {
        return word.toLowerCase()
      }
      if (word.length > 1 && word === word.toUpperCase()) {
        return word
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
    .replace(/[^\w\u4e00-\u9fa5]/g, '')
}

/**
 * Schema 用途（统一约定）：
 * - 表结构缓存：飞书改字段后，在「系统管理-数据配置」同步即可让页面与写接口使用新结构。
 * - 读：数据层 getTableData 用 schema 做展示格式化（日期、金额、公式等）。
 * - 写：订单增/改接口用 schema + prepareFieldsForFeishu 做写前按类型转换（数字/日期/公式过滤等）。
 */

/**
 * 同步单个表的 Schema（拉取飞书 fields 并写入内存+文件缓存）
 */
export async function syncTableSchema(tableId: string): Promise<TableSchema> {
  if (!tableId) {
    throw new Error('Table ID is required')
  }

  const feishuSchema = await feishuClient.getTableSchema(tableId)
  
  const schema: TableSchema = {
    tableId: feishuSchema.table_id,
    tableName: feishuSchema.name || tableIdToName[tableId] || tableId,
    fields: feishuSchema.fields.map((field: any) => ({
      fieldId: field.field_id ?? field.field_name,
      fieldName: field.field_name,
      dataKey: getDataKey(field.field_name),
      fieldType: Number(field.field_type ?? field.type ?? 1) || 1,
      uiType: field.ui_type ?? '',
      isPrimary: field.is_primary ?? false,
      isExtend: field.is_extend ?? false,
      property: field.property,
    })),
    syncedAt: new Date().toISOString(),
  }

  // 更新内存缓存
  schemaCache.set(tableId, schema)

  // 写入文件缓存（失败不阻塞，Vercel /tmp 偶发不可写时仍可继续）
  try {
    await saveSchemaCache(schema)
  } catch (e) {
    console.warn('[syncTableSchema] saveSchemaCache failed:', e)
  }

  return schema
}

export async function syncAllSchemas(): Promise<{
  success: TableSchema[]
  failed: Array<{ tableName: string; tableId: string; error: string }>
  unconfigured: Array<{ tableName: string; key: string }>
}> {
  const success: TableSchema[] = []
  const failed: Array<{ tableName: string; tableId: string; error: string }> = []
  const unconfigured: Array<{ tableName: string; key: string }> = []

  for (const table of SYNC_TABLES) {
    if (!table.id) {
      unconfigured.push({ tableName: table.name, key: table.key })
      continue
    }

    try {
      const schema = await syncTableSchema(table.id)
      success.push(schema)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      failed.push({
        tableName: table.name,
        tableId: table.id,
        error: errorMsg,
      })
    }
  }

  return { success, failed, unconfigured }
}

/**
 * 获取单个表的 Schema（优先内存缓存，未命中则读文件，不主动请求飞书）
 */
export async function getTableSchema(tableId: string): Promise<TableSchema | undefined> {
  const cached = schemaCache.get(tableId)
  if (cached) return cached
  const fileCache = await getSchemaCache(tableId)
  if (fileCache) {
    const schema: TableSchema = {
      tableId: fileCache.tableId,
      tableName: fileCache.tableName,
      fields: fileCache.fields,
      syncedAt: fileCache.syncedAt,
    }
    schemaCache.set(tableId, schema)
    return schema
  }
  return undefined
}

/**
 * 获取所有表的Schema（从缓存）
 */
export async function getAllSchemas(): Promise<TableSchema[]> {
  return Array.from(schemaCache.values())
}

/**
 * 获取所有表的基本信息（用于同步设置页面）
 * 优先从内存缓存，未命中则读文件缓存（Vercel 同实例复用 /tmp），保证同步后刷新能正确显示
 */
export async function getTableList(): Promise<Array<{
  tableId: string
  tableName: string
  fieldCount: number
  lastSyncedAt: string
  status: '已同步' | '未同步' | '未配置'
}>> {
  const results = await Promise.all(
    SYNC_TABLES.map(async (table) => {
      if (!table.id) {
        return {
          tableId: table.key,
          tableName: table.name,
          fieldCount: 0,
          lastSyncedAt: '请配置表ID',
          status: '未配置' as const,
        }
      }

      const schema = await getTableSchema(table.id)
      if (schema) {
        return {
          tableId: table.id,
          tableName: schema.tableName,
          fieldCount: schema.fields.length,
          lastSyncedAt: new Date(schema.syncedAt).toLocaleString('zh-CN'),
          status: '已同步' as const,
        }
      }

      return {
        tableId: table.id,
        tableName: table.name,
        fieldCount: 0,
        lastSyncedAt: '-',
        status: '未同步' as const,
      }
    })
  )
  return results
}

/**
 * Enhance schema with field mapping metadata
 * This adds category, format, and priority to each field
 */
export function enhanceSchemaWithMapping(schema: TableSchema): TableSchema {
  const enhancedFields = applyFieldMappingBatch(schema.fields).map(mapped => ({
    ...mapped,
    category: mapped.category,
    format: mapped.format,
    priority: mapped.priority,
    displayName: mapped.displayName
  }))

  return {
    ...schema,
    fields: enhancedFields
  }
}

/**
 * Get schema statistics with mapping information
 */
export function getSchemaStats(schema: TableSchema): TableSchemaStats {
  const mappingStats = getMappingStats(schema.fields)
  const categorized = categorizeFields(applyFieldMappingBatch(schema.fields))

  const fieldsByCategory: Record<FieldCategory, number> = {
    basic: categorized.basic.length,
    logistics: categorized.logistics.length,
    financial: categorized.financial.length,
    product: categorized.product.length,
    other: categorized.other.length
  }

  const fieldsByFormat: Record<FieldFormat, number> = {
    currency: 0,
    percentage: 0,
    date: 0,
    status: 0,
    text: 0,
    number: 0,
    rate: 0
  }

  categorized.basic.forEach(f => { fieldsByFormat[f.format]++ })
  categorized.logistics.forEach(f => { fieldsByFormat[f.format]++ })
  categorized.financial.forEach(f => { fieldsByFormat[f.format]++ })
  categorized.product.forEach(f => { fieldsByFormat[f.format]++ })
  categorized.other.forEach(f => { fieldsByFormat[f.format]++ })

  return {
    totalFields: mappingStats.total,
    fieldsByCategory,
    fieldsByFormat,
    mappedFields: mappingStats.mapped,
    autoGeneratedFields: mappingStats.autoGenerated
  }
}

/**
 * Get fields by category from schema
 */
export function getFieldsByCategory(
  schema: TableSchema,
  category: FieldCategory
): MappedField[] {
  const mappedFields = applyFieldMappingBatch(schema.fields)
  const categorized = categorizeFields(mappedFields)
  return categorized[category] || []
}

/**
 * Check if schema has been enhanced with mapping
 */
export function isSchemaEnhanced(schema: TableSchema): boolean {
  return schema.fields.length > 0 &&
    schema.fields[0].category !== undefined &&
    schema.fields[0].format !== undefined
}
