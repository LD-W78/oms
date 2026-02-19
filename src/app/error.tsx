'use client'

import { useEffect } from 'react'
import { Button, Result } from 'antd'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f5f5f5',
      }}
    >
      <Result
        status="error"
        title="页面加载异常"
        subTitle={error.message || '请刷新重试或联系管理员'}
        extra={
          <Button type="primary" onClick={reset}>
            重新加载
          </Button>
        }
      />
    </div>
  )
}
