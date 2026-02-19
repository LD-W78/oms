'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FieldConfig, TableConfig, FieldType } from '@/lib/config/table-metadata'

const STORAGE_KEY = 'oms_table_configs'

interface UseTableConfigReturn {
  config: TableConfig | null
  loading: boolean
  error: string | null
  saveFieldConfig: (fields: FieldConfig[]) => void
  toggleFieldVisibility: (fieldKey: string, visible: boolean) => void
  refreshConfig: () => Promise<void>
}

const DEFAULT_FIELD_CONFIGS: Record<string, FieldConfig[]> = {
  orders: [
    { key: 'id', label: '订单号', width: 220, visible: true, required: true, sortable: true, fieldType: 'text' },
    { key: 'customer', label: '客户', width: 150, visible: true, required: true, sortable: true, fieldType: 'customer' },
    { key: 'product', label: '产品', width: 180, visible: true, required: true, sortable: true, fieldType: 'product' },
    { key: 'mts', label: '数量(MTS)', width: 100, visible: true, required: true, sortable: true, fieldType: 'text' },
    { key: 'amount', label: '订单金额', width: 120, visible: true, required: true, sortable: true, fieldType: 'currency' },
    { key: 'contractDate', label: '签约日期', width: 120, visible: true, sortable: true, filterable: true, fieldType: 'date' },
    { key: 'status', label: '商务进度', width: 100, visible: true, sortable: true, filterable: true, fieldType: 'select', selectOptions: ['签约中', '已签约', '已收款', '已结款', '待退税', '已退税'] },
  ],
}

function getDefaultFields(route: string): FieldConfig[] {
  const normalizedRoute = route.replace(/^\//, '')
  return DEFAULT_FIELD_CONFIGS[normalizedRoute] || []
}

function loadStoredConfig(route: string): TableConfig | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    const configs: Record<string, TableConfig> = JSON.parse(stored)
    const normalizedRoute = route.replace(/^\//, '')

    // Check if we have a stored config for this route
    if (configs[normalizedRoute]) {
      return configs[normalizedRoute]
    }
  } catch {
    console.error('Failed to load stored config')
  }

  return null
}

function saveStoredConfig(config: TableConfig): void {
  if (typeof window === 'undefined') return

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const configs: Record<string, TableConfig> = stored ? JSON.parse(stored) : {}

    configs[config.route.replace(/^\//, '')] = config
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch {
    console.error('Failed to save config')
  }
}

export function useTableConfig(route: string): UseTableConfigReturn {
  const [config, setConfig] = useState<TableConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // First try to load from API
      const response = await fetch(`/api/tables?route=${encodeURIComponent(route)}`)

      if (response.ok) {
        const data = await response.json()
        if (data.config && data.config.fields && data.config.fields.length > 0) {
          // Store the API config
          saveStoredConfig(data.config)
          setConfig(data.config)
          setLoading(false)
          return
        }
      }

      // Fallback to stored config
      const stored = loadStoredConfig(route)
      if (stored) {
        setConfig(stored)
        setLoading(false)
        return
      }

      // Use default config
      const defaultFields = getDefaultFields(route)
      const defaultConfig: TableConfig = {
        id: '',
        name: route === '/orders' ? '订单管理' : route,
        route,
        icon: 'table',
        enableAdd: true,
        enableEdit: true,
        enableDelete: true,
        pageSize: 10,
        fields: defaultFields,
      }
      saveStoredConfig(defaultConfig)
      setConfig(defaultConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
      // Use default on error
      const defaultFields = getDefaultFields(route)
      const defaultConfig: TableConfig = {
        id: '',
        name: route === '/orders' ? '订单管理' : route,
        route,
        icon: 'table',
        enableAdd: true,
        enableEdit: true,
        enableDelete: true,
        pageSize: 10,
        fields: defaultFields,
      }
      setConfig(defaultConfig)
    } finally {
      setLoading(false)
    }
  }, [route])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const saveFieldConfig = useCallback((fields: FieldConfig[]) => {
    if (!config) return

    const newConfig = { ...config, fields }
    saveStoredConfig(newConfig)
    setConfig(newConfig)
  }, [config])

  const toggleFieldVisibility = useCallback((fieldKey: string, visible: boolean) => {
    if (!config) return

    const newFields = config.fields.map((field) =>
      field.key === fieldKey ? { ...field, visible } : field
    )
    saveFieldConfig(newFields)
  }, [config, saveFieldConfig])

  const refreshConfig = useCallback(async () => {
    await loadConfig()
  }, [loadConfig])

  return { config, loading, error, saveFieldConfig, toggleFieldVisibility, refreshConfig }
}
