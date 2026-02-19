'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  ModuleConfig,
  UseModuleConfigReturn,
  FieldPermission
} from '@/types/module-fields'

const STORAGE_KEY = 'oms_module_config'
const CONFIG_CACHE_TTL_MS = 60_000
const configCache = new Map<string, { config: ModuleConfig | null; ts: number }>()

async function fetchModuleConfig(moduleId: string, forceRefresh = false): Promise<ModuleConfig | null> {
  if (!forceRefresh) {
    const cached = configCache.get(moduleId)
    if (cached && Date.now() - cached.ts < CONFIG_CACHE_TTL_MS) return cached.config
  }
  try {
    const response = await fetch(`/api/config/modules/${moduleId}`)
    if (!response.ok) throw new Error('Failed to fetch config')
    const data = await response.json()
    configCache.set(moduleId, { config: data, ts: Date.now() })
    return data
  } catch {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${moduleId}`)
    return stored ? JSON.parse(stored) : null
  }
}

export function useModuleConfig(moduleId: string): UseModuleConfigReturn {
  const [config, setConfig] = useState<ModuleConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadConfig = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchModuleConfig(moduleId, forceRefresh)
      setConfig(data)
      if (data) {
        localStorage.setItem(`${STORAGE_KEY}_${moduleId}`, JSON.stringify(data))
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      const stored = localStorage.getItem(`${STORAGE_KEY}_${moduleId}`)
      if (stored) setConfig(JSON.parse(stored))
    } finally {
      setLoading(false)
    }
  }, [moduleId])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel('oms_module_config')
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'config-saved') {
        configCache.delete(moduleId)
        loadConfig(true)
      }
    }
    ch.addEventListener('message', onMessage)
    return () => ch.removeEventListener('message', onMessage)
  }, [loadConfig, moduleId])

  const checkPermission = useCallback((
    fieldId: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ): boolean => {
    if (!config) return true
    
    const permission = config.fieldPermissions[fieldId]
    if (!permission) return true
    
    if (!permission.visible && action === 'view') return false
    return permission[action] ?? true
  }, [config])

  const getVisibleFields = useCallback((): string[] => {
    if (!config) return []
    
    return Object.entries(config.fieldPermissions)
      .filter(([_, perm]) => perm.visible)
      .map(([fieldId]) => fieldId)
  }, [config])

  const getCreatableFields = useCallback((): string[] => {
    if (!config) return []
    
    return Object.entries(config.fieldPermissions)
      .filter(([_, perm]) => perm.visible && perm.create)
      .map(([fieldId]) => fieldId)
  }, [config])

  const getEditableFields = useCallback((): string[] => {
    if (!config) return []
    
    return Object.entries(config.fieldPermissions)
      .filter(([_, perm]) => perm.visible && perm.edit)
      .map(([fieldId]) => fieldId)
  }, [config])

  return useMemo(() => ({
    config,
    loading,
    error,
    checkPermission,
    getVisibleFields,
    getCreatableFields,
    getEditableFields,
    reload: loadConfig
  }), [
    config,
    loading,
    error,
    checkPermission,
    getVisibleFields,
    getCreatableFields,
    getEditableFields,
    loadConfig
  ])
}

export function useModuleConfigWithSchema(
  moduleId: string,
  schemaFields: Array<{ fieldId: string; fieldName: string }>
) {
  const moduleConfig = useModuleConfig(moduleId)
  
  const fieldsWithPermissions = useMemo(() => {
    return schemaFields.map(field => {
      const perm = moduleConfig.config?.fieldPermissions[field.fieldId]
      return {
        ...field,
        permission: perm || { visible: true, view: true, create: true, edit: true, delete: false }
      }
    })
  }, [schemaFields, moduleConfig.config])

  const visibleFields = useMemo(() => 
    fieldsWithPermissions.filter(f => f.permission.visible),
    [fieldsWithPermissions]
  )

  return {
    ...moduleConfig,
    fieldsWithPermissions,
    visibleFields
  }
}
