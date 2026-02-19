'use client'

import { useState, useEffect } from 'react'
import { Card, Button, Spin, Alert, Descriptions, Tag, Space, Typography } from 'antd'
import { ReloadOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

interface SchemaCheckResult {
  success: boolean
  tableId: string
  message?: string
  feishu?: { fieldCount: number; fieldNames: string[] }
  synced?: { fieldCount: number; syncedAt: string }
  verdict?: {
    schemaUpToDate: boolean
    inFeishuNotInSynced: string[]
  }
  receivablePage?: {
    foundInSchema: string[]
    missingFromSchema: string[]
    allRequiredPresent: boolean
  }
  error?: string
}

export default function DebugPage() {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<SchemaCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchSchemaCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug/schema-check')
      const data = await res.json()
      setResult(data)
      if (!res.ok) setError(data.error || '请求失败')
      else if (data.feishuError || data.syncError) setError(data.feishuError || data.syncError)
      else setError(null)
    } catch (e) {
      setError(String(e))
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchemaCheck()
  }, [])

  return (
    <div style={{ padding: 24, background: '#f5f5f7', minHeight: '100%' }}>
      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>调试工具</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchSchemaCheck} loading={loading}>
            刷新
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Typography.Paragraph type="secondary">
          检查数据层 Schema 是否与飞书一致，以及应收应付页所需字段是否完整。
        </Typography.Paragraph>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" tip="正在检查..." />
        </div>
      ) : (
        <>
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              description={
                <div>
                  <p>请确认：</p>
                  <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                    <li>开发服务器已启动（npm run dev）</li>
                    <li>.env.local 中已配置 FEISHU_TABLE_ORDERS、FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_BASE_APP_TOKEN</li>
                    {/拒绝|permission|denied|403|401/i.test(error) && (
                      <li>飞书应用是否有权限访问多维表格？请在飞书开放平台检查应用权限与数据表访问范围</li>
                    )}
                  </ul>
                  <p style={{ marginTop: 12, marginBottom: 0 }}>
                    <a href="/api/debug" target="_blank" rel="noreferrer">直接测试 /api/debug</a>
                    {' · '}
                    <a href="/api/debug/schema-check" target="_blank" rel="noreferrer">直接测试 /api/debug/schema-check</a>
                  </p>
                </div>
              }
              style={{ marginBottom: result ? 16 : 0 }}
            />
          )}
          {result ? (
            <>
              {!result.success && result.error && (
                <Alert type="error" showIcon message={result.error} style={{ marginBottom: 16 }} />
              )}

              <Card title="Schema 检查" size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="表 ID">{result.tableId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="飞书字段数">{result.feishu?.fieldCount ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="同步后字段数">{result.synced?.fieldCount ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="Schema 是否最新">
                    {result.verdict?.schemaUpToDate != null ? (
                      result.verdict.schemaUpToDate ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">是</Tag>
                      ) : (
                        <Tag icon={<CloseCircleOutlined />} color="error">否</Tag>
                      )
                    ) : (
                      '-'
                    )}
                  </Descriptions.Item>
                  {result.verdict?.inFeishuNotInSynced?.length ? (
                    <Descriptions.Item label="飞书有但未同步的字段">
                      {result.verdict.inFeishuNotInSynced.join(', ')}
                    </Descriptions.Item>
                  ) : null}
                  <Descriptions.Item label="结论">{result.message ?? '-'}</Descriptions.Item>
                </Descriptions>
              </Card>

              {result.receivablePage && (
                <Card title="应收应付页字段" size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Schema 中已找到">
                      {result.receivablePage.foundInSchema?.join(', ') || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Schema 中缺失">
                      {result.receivablePage.missingFromSchema?.length ? (
                        <Tag color="error">{result.receivablePage.missingFromSchema.join(', ')}</Tag>
                      ) : (
                        <Tag color="success">无</Tag>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="所需字段是否齐全">
                      {result.receivablePage.allRequiredPresent ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">是</Tag>
                      ) : (
                        <Tag icon={<CloseCircleOutlined />} color="warning">否</Tag>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              <Card title="其他调试 API" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <a href="/api/debug" target="_blank" rel="noreferrer">GET /api/debug</a>
                  <a href="/api/debug/data-layer-check" target="_blank" rel="noreferrer">GET /api/debug/data-layer-check</a>
                  <a href="/api/debug/schema-check" target="_blank" rel="noreferrer">GET /api/debug/schema-check</a>
                </Space>
              </Card>
            </>
          ) : !error ? (
            <Alert type="info" message="无数据" description="请检查网络连接或 API 是否正常。" />
          ) : null}
        </>
      )}
    </div>
  )
}
