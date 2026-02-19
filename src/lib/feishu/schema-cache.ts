'use server'

import { promises as fs } from 'fs'
import { join } from 'path'
import type { TableSchema, FieldSchema } from '@/lib/feishu/schema'

const CACHE_DIR = join(process.cwd(), 'config', '.schema-cache')

interface SchemaCache {
  tableId: string
  tableName: string
  fields: FieldSchema[]
  syncedAt: string
  version: number
}

/**
 * 确保缓存目录存在
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.access(CACHE_DIR)
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true })
  }
}

/**
 * 获取缓存文件路径
 */
function getCacheFilePath(tableId: string): string {
  return join(CACHE_DIR, `${tableId}.json`)
}

/**
 * 保存Schema到缓存
 */
export async function saveSchemaCache(schema: TableSchema): Promise<void> {
  await ensureCacheDir()
  
  const cache: SchemaCache = {
    tableId: schema.tableId,
    tableName: schema.tableName,
    fields: schema.fields,
    syncedAt: schema.syncedAt,
    version: 1,
  }
  
  const filePath = getCacheFilePath(schema.tableId)
  await fs.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf-8')
}

/**
 * 从缓存读取Schema
 */
export async function getSchemaCache(tableId: string): Promise<SchemaCache | null> {
  try {
    const filePath = getCacheFilePath(tableId)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as SchemaCache
  } catch {
    return null
  }
}

/**
 * 删除缓存
 */
export async function deleteSchemaCache(tableId: string): Promise<void> {
  try {
    const filePath = getCacheFilePath(tableId)
    await fs.unlink(filePath)
  } catch {
    // 文件不存在，忽略错误
  }
}

/**
 * 获取所有缓存的Schema
 */
export async function getAllSchemaCaches(): Promise<SchemaCache[]> {
  try {
    await ensureCacheDir()
    const files = await fs.readdir(CACHE_DIR)
    const caches: SchemaCache[] = []
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(join(CACHE_DIR, file), 'utf-8')
        caches.push(JSON.parse(content))
      }
    }
    
    return caches
  } catch {
    return []
  }
}
