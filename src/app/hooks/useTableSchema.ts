'use client'

import { useState, useEffect, useCallback } from 'react'
import type { FieldSchema, TableSchema } from '@/lib/feishu/types'

export type { FieldSchema as FieldMeta, TableSchema } from '@/lib/feishu/types'

export function useTableSchema(tableId: string) {
  const [schema, setSchema] = useState<TableSchema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSchema = useCallback(async () => {
    if (!tableId) {
      setSchema(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/schema/${tableId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch schema: ${response.status}`)
      }

      const data = await response.json()
      setSchema(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      setSchema(null)
    } finally {
      setLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    fetchSchema()
  }, [fetchSchema])

  const syncSchema = useCallback(async () => {
    if (!tableId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/schema/${tableId}`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        throw new Error(`Failed to sync schema: ${response.status}`)
      }

      const data = await response.json()
      setSchema(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [tableId])

  return {
    schema,
    loading,
    error,
    refetch: fetchSchema,
    sync: syncSchema,
  }
}
