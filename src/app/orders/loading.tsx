/** 与订单页 !hasMounted 占位符保持一致，避免 Suspense 流式加载时服务端与客户端 hydration 不匹配 */
export default function OrdersLoading() {
  return (
    <div
      style={{
        padding: 24,
        background: '#f5f5f7',
        minHeight: '100%',
        boxSizing: 'border-box',
      }}
      data-orders-placeholder
    />
  )
}
