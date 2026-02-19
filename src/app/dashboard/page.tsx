'use client'

const dashboardUrl = process.env.NEXT_PUBLIC_FEISHU_DASHBOARD_URL || ''

/**
 * 嵌入飞书仪表盘。控制台可能出现来自飞书页面的错误（跨域、第三方脚本等），
 * 属嵌入第三方站点的正常现象，不影响使用。
 */
export default function DashboardPage() {
  if (!dashboardUrl) {
    return (
      <div
        style={{
          padding: 24,
          minHeight: 280,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          background: '#fafafa',
          borderRadius: 8,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: 8, fontSize: 16 }}>首页</p>
          <p style={{ margin: 0, fontSize: 14 }}>
            请在 .env.local 中配置 NEXT_PUBLIC_FEISHU_DASHBOARD_URL 以嵌入飞书仪表盘，或从左侧菜单进入其他模块。
          </p>
        </div>
      </div>
    )
  }
  return (
    <div style={{ height: 'calc(100vh - 64px - 48px)', margin: -24, minHeight: 400 }}>
      <iframe
        src={dashboardUrl}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="fullscreen"
        referrerPolicy="no-referrer"
        title="飞书仪表盘"
      />
    </div>
  )
}
