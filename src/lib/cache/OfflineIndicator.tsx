'use client'

import { useState, useEffect } from 'react'
import { Badge, message } from 'antd'
import { WifiOutlined, DisconnectOutlined } from '@ant-design/icons'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      message.success('网络已连接')
    }

    const handleOffline = () => {
      setIsOnline(false)
      message.warning('网络已断开，离线模式下仍可查看缓存数据')
    }

    setIsOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <Badge dot status={isOnline ? 'success' : 'error'}>
      {isOnline ? (
        <span style={{ color: '#52c41a' }}>
          <WifiOutlined /> 在线
        </span>
      ) : (
        <span style={{ color: '#ff4d4f' }}>
          <DisconnectOutlined /> 离线
        </span>
      )}
    </Badge>
  )
}
