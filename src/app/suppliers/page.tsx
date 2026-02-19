'use client'

export default function SuppliersPage() {
  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <iframe
        src={process.env.NEXT_PUBLIC_FEISHU_TABLE_SUPPLIERS_URL}
        style={{
          width: '100%',
          height: '100vh',
          border: 'none',
        }}
        allow="clipboard-write; fullscreen"
        referrerPolicy="no-referrer"
        title="供应商"
      />
    </div>
  )
}
