import { env } from '@/lib/config/env'

interface FeishuToken {
  app_access_token: string
  expire: number
}

interface FeishuRecord {
  record_id: string
  fields: Record<string, unknown>
}

interface FeishuTableSchema {
  table_id: string
  name: string
  fields: FeishuField[]
}

interface FeishuField {
  field_id?: string
  field_name: string
  field_type: string
  is_primary?: boolean
  is_extend?: boolean
  ui_type?: string
  /** 单选/多选等字段的配置，含 options 菜单项，以飞书配置为准 */
  property?: Record<string, unknown>
}

class FeishuClient {
  private baseUrl = env.FEISHU_BASE_URL
  private token: string | null = null
  private tokenExpiry: number = 0

  /**
   * Get app access token
   */
  async getAppToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token
    }

    const response = await fetch(`${this.baseUrl}/auth/v3/app_access_token/internal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: (env.FEISHU_APP_ID || '').trim(),
        app_secret: (env.FEISHU_APP_SECRET || '').trim(),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to get app token:', {
        status: response.status,
        statusText: response.statusText,
        baseUrl: this.baseUrl,
        appId: env.FEISHU_APP_ID,
        error: errorText.substring(0, 500)
      })
      throw new Error(`Failed to get app token: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`Failed to get app token: ${data.msg}`)
    }

    this.token = data.app_access_token
    this.tokenExpiry = Date.now() + (data.expire - 60) * 1000

    return this.token as string
  }

  /**
   * Get table schema by fetching table metadata and fields
   */
  async getTableSchema(tableId: string): Promise<FeishuTableSchema> {
    const token = await this.getAppToken()

    // Step 1: Get table list to find table name
    const tablesUrl = `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables`
    const tablesResponse = await fetch(tablesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!tablesResponse.ok) {
      throw new Error(`Failed to get tables: ${tablesResponse.statusText}`)
    }

    const tablesData = await tablesResponse.json()
    const table = tablesData.data?.items?.find((t: any) => t.table_id === tableId)

    if (!table) {
      throw new Error(`Table ${tableId} not found`)
    }

    // Step 2: Get table fields
    const fieldsUrl = `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/fields`
    const fieldsResponse = await fetch(fieldsUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    let fields: FeishuField[] = []
    if (fieldsResponse.ok) {
      const fieldsData = await fieldsResponse.json()
      fields = (fieldsData.data?.items ?? []).map((f: any) => ({
        field_id: f.field_id,
        field_name: f.field_name,
        field_type: f.field_type ?? f.type,
        is_primary: f.is_primary,
        is_extend: f.is_extend,
        ui_type: f.ui_type,
        property: f.property,
      }))
    }

    return {
      table_id: tableId,
      name: table.name,
      fields: fields,
    }
  }

  /**
   * Get records from a table
   */
  async getRecords(tableId: string, options?: {
    pageSize?: number
    pageToken?: string
    filter?: string
  }): Promise<{ items: FeishuRecord[]; has_more: boolean; page_token?: string }> {
    const token = await this.getAppToken()
    
    const params = new URLSearchParams()
    if (options?.pageSize) params.set('page_size', String(options.pageSize))
    if (options?.pageToken) params.set('page_token', options.pageToken)
    if (options?.filter) params.set('filter', options.filter)

    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get records: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      items: data.data.items || [],
      has_more: data.data.has_more || false,
      page_token: data.data.page_token,
    }
  }

  /**
   * Get a single record
   */
  async getRecord(tableId: string, recordId: string): Promise<FeishuRecord> {
    const token = await this.getAppToken()
    
    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records/${recordId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get record: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      record_id: data.data.record_id,
      fields: data.data.fields || {},
    }
  }

  /**
   * Create a new record.
   * 请求体与飞书官方示例一致：{ data: { fields: { 字段名: 值 } } }，其中日期=毫秒时间戳 number、数字=number。
   */
  async createRecord(tableId: string, fields: Record<string, unknown>): Promise<FeishuRecord> {
    const token = await this.getAppToken()
    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fields }),
      }
    )

    const data = await response.json().catch(() => ({})) as { code?: number; msg?: string; data?: { record_id?: string; fields?: Record<string, unknown> } }
    if (!response.ok) {
      const msg = (data.msg && String(data.msg).trim()) || response.statusText
      throw new Error(msg || 'Failed to create record')
    }
    if (data.code != null && data.code !== 0) {
      throw new Error(String(data.msg || data.code || '创建记录失败'))
    }
    return {
      record_id: data.data?.record_id ?? '',
      fields: data.data?.fields || {},
    }
  }

  /**
   * Update an existing record
   */
  async updateRecord(tableId: string, recordId: string, fields: Record<string, unknown>): Promise<FeishuRecord> {
    const token = await this.getAppToken()
    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records/${recordId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields,
        }),
      }
    )

    const data = await response.json().catch(() => ({})) as { code?: number; msg?: string; data?: { record_id?: string; fields?: Record<string, unknown> } }
    if (!response.ok) {
      const msg = (data.msg && String(data.msg).trim()) ?? response.statusText
      throw new Error(msg || '更新记录失败')
    }
    if (data.code != null && data.code !== 0) {
      throw new Error(String(data.msg || data.code || '更新记录失败'))
    }
    return {
      record_id: data.data?.record_id ?? recordId,
      fields: data.data?.fields || {},
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(tableId: string, recordId: string): Promise<void> {
    const token = await this.getAppToken()
    
    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records/${recordId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to delete record: ${response.statusText}`)
    }
  }

  /**
   * Batch delete records
   */
  async batchDeleteRecords(tableId: string, recordIds: string[]): Promise<void> {
    const token = await this.getAppToken()
    
    const response = await fetch(
      `${this.baseUrl}/bitable/v1/apps/${env.FEISHU_BASE_APP_TOKEN}/tables/${tableId}/records/batch_delete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          records: recordIds,
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to batch delete records: ${response.statusText}`)
    }
  }
}

export const feishuClient = new FeishuClient()
export type { FeishuRecord, FeishuTableSchema, FeishuField }
