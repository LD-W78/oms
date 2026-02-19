'use client'

import { useEffect, useState } from 'react'
import { Card, Alert, Button } from 'antd'
import { ReloadOutlined, FullscreenOutlined } from '@ant-design/icons'

interface FeishuIframeProps {
  src: string
  title: string
  height?: number | string
}

export function FeishuIframe({ src, title, height = '100%' }: FeishuIframeProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(src)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
  }, [currentSrc])

  const handleLoad = () => {
    setLoading(false)
  }

  const handleError = () => {
    setLoading(false)
    setError(true)
  }

  const handleRefresh = () => {
    setCurrentSrc(`${currentSrc}${currentSrc.includes('?') ? '&' : '?'}_t=${Date.now()}`)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (error) {
    return (
      <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert
          title="加载失败"
          description="无法加载飞书页面，请检查网络连接或刷新重试。"
          type="error"
          showIcon
          action={
            <Button size="small" type="primary" onClick={handleRefresh}>
              重试
            </Button>
          }
        />
      </Card>
    )
  }

  const containerHeight = isFullscreen ? '100vh' : height

  return (
    <div style={{
      height: containerHeight,
      width: '100%',
      position: 'relative',
      background: '#fff',
    }}>
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 1000,
      }}>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          style={{ color: '#666' }}
        />
        <Button
          type="text"
          size="small"
          icon={<FullscreenOutlined />}
          onClick={toggleFullscreen}
          style={{ color: '#666' }}
        />
      </div>

      <iframe
        id={`iframe-${title}`}
        src={currentSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        frameBorder={0}
        allowFullScreen
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        title={title}
      />
    </div>
  )
}
