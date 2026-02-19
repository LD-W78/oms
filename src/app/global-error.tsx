'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, minHeight: '100vh', background: '#f5f5f5', fontFamily: 'sans-serif', padding: 24 }}>
        <div style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, color: '#333', marginBottom: 16 }}>系统异常</h1>
          <p style={{ color: '#666', marginBottom: 24 }}>{error.message || '请刷新页面重试'}</p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              background: '#1677ff',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  )
}
