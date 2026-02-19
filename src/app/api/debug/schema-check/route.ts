/**
 * Schema 与配置检查：验证数据层 schema 是否与飞书一致，页面是否按配置获取新字段
 * GET /api/debug/schema-check?tableId=xxx （不传则用订单表）
 */
import { NextResponse } from 'next/server'
import { feishuClient } from '@/lib/feishu/client'
import { getTableSchema, syncTableSchema } from '@/lib/feishu/schema'
import { getSchemaCache } from '@/lib/feishu/schema-cache'
import { getModuleConfig } from '@/lib/config/module-fields'
import { TABLE_IDS } from '@/lib/config/env'

export async function GET(request: Request) {
  let defaultTableId = ''
  try {
    defaultTableId = TABLE_IDS.orders ?? ''
  } catch {
    // env 解析失败时不影响返回
  }
  const { searchParams } = new URL(request.url)
  const tableId = searchParams.get('tableId')?.trim() || defaultTableId

  if (!tableId) {
    return NextResponse.json(
      {
        success: false,
        error: 'tableId required',
        hint: 'Set env FEISHU_TABLE_ORDERS or use ?tableId=你的多维表格ID',
      },
      { status: 200 }
    )
  }

  let feishuError: string | null = null
  let feishuSchema: { fields: Array<{ field_id?: string; field_name?: string }> } | null = null
  try {
    feishuSchema = await feishuClient.getTableSchema(tableId)
  } catch (e) {
    feishuError = e instanceof Error ? e.message : String(e)
    console.error('[schema-check] Feishu getTableSchema failed:', e)
  }

  let cachedSchema: Awaited<ReturnType<typeof getTableSchema>> = undefined
  let fileCache: Awaited<ReturnType<typeof getSchemaCache>> = null
  try {
    cachedSchema = await getTableSchema(tableId)
    fileCache = await getSchemaCache(tableId)
  } catch (e) {
    console.error('[schema-check] getTableSchema/getSchemaCache failed:', e)
  }

  let syncedSchema: Awaited<ReturnType<typeof syncTableSchema>> | null = null
  let syncError: string | null = null
  try {
    syncedSchema = await syncTableSchema(tableId)
  } catch (e) {
    syncError = e instanceof Error ? e.message : String(e)
    console.error('[schema-check] syncTableSchema failed:', e)
  }

  const feishuFieldNames = (feishuSchema?.fields || []).map((f: { field_name?: string }) => f.field_name)
  const feishuFieldIds = (feishuSchema?.fields || []).map((f: { field_id?: string }) => f.field_id)
  const cachedFieldNames = (cachedSchema?.fields || []).map((f) => f.fieldName)
  const syncedFieldNames = (syncedSchema?.fields || []).map((f) => f.fieldName)

  const feishuCount = feishuFieldNames.length
  const cachedCount = cachedFieldNames.length
  const syncedCount = syncedFieldNames.length
  const fileCacheCount = fileCache?.fields?.length ?? 0

  const feishuSet = new Set(feishuFieldNames)
  const syncedSet = new Set(syncedFieldNames)
  const inFeishuNotInSynced = feishuFieldNames.filter((n) => !syncedSet.has(n))
  const inSyncedNotInFeishu = syncedFieldNames.filter((n) => !feishuSet.has(n))

  let moduleConfig: Awaited<ReturnType<typeof getModuleConfig>> = null
  try {
    moduleConfig = await getModuleConfig('finance-receivable')
  } catch (e) {
    console.error('[schema-check] getModuleConfig failed:', e)
  }
  const fieldPermissionsCount = moduleConfig ? Object.keys(moduleConfig.fieldPermissions).length : 0

  const receivablePageFields = ['订单金额', '订单金额CNY', '应收', '应收款', '已收款', '已收', '应付', '应付款', '已付款', '已付', '货币', '进度', '商务进度']
  const receivableFieldsInSchema = receivablePageFields.filter((name) => syncedSet.has(name) || feishuSet.has(name))
  const receivableFieldsMissing = receivablePageFields.filter((name) => !syncedSet.has(name) && !feishuSet.has(name))

  const summary = {
      /** 飞书原始 */
      feishu: {
        fieldCount: feishuCount,
        fieldNames: feishuFieldNames,
        fieldIds: feishuFieldIds,
      },
      /** 数据层缓存（同步前） */
      cached: {
        fieldCount: cachedCount,
        fieldNames: cachedFieldNames,
        inMemory: !!cachedSchema,
      },
      /** 文件缓存 */
      fileCache: {
        fieldCount: fileCacheCount,
        syncedAt: fileCache?.syncedAt ?? null,
      },
      /** 同步后 schema */
      synced: {
        fieldCount: syncedCount,
        fieldNames: syncedFieldNames,
        syncedAt: syncedSchema?.syncedAt ?? null,
      },
      /** 对比结论 */
      verdict: {
        schemaUpToDate: feishuCount === syncedCount && inFeishuNotInSynced.length === 0,
        cacheMatchesFeishu: cachedCount === feishuCount,
        fileCacheMatches: fileCacheCount === feishuCount,
        inFeishuNotInSynced,
        inSyncedNotInFeishu,
      },
      /** 模块配置（finance-receivable） */
      moduleConfig: {
        tableId: moduleConfig?.tableId ?? null,
        fieldPermissionsCount,
        hasConfig: !!moduleConfig,
      },
      /** 应收应付页字段覆盖 */
      receivablePage: {
        requiredFields: receivablePageFields,
        foundInSchema: receivableFieldsInSchema,
        missingFromSchema: receivableFieldsMissing,
        allRequiredPresent: receivableFieldsMissing.length === 0,
      },
      message:
        feishuError || syncError
          ? `飞书 API 调用失败: ${feishuError || syncError}。以下为缓存数据。`
          : inFeishuNotInSynced.length > 0
            ? `飞书有 ${inFeishuNotInSynced.length} 个字段未同步到数据层: ${inFeishuNotInSynced.join(', ')}`
            : feishuCount !== syncedCount
              ? `字段数不一致: 飞书=${feishuCount} 同步后=${syncedCount}`
              : 'Schema 已与飞书一致',
  }

  return NextResponse.json({
    success: !feishuError && !syncError,
    tableId,
    feishuError: feishuError ?? undefined,
    syncError: syncError ?? undefined,
    ...summary,
  })
}
