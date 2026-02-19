'use client'

export default function CustomersPage() {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <iframe
        src={process.env.NEXT_PUBLIC_FEISHU_TABLE_CUSTOMERS_URL}
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
        }}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
        title="客户管理"
      />
    </div>
  )
}
