'use client'

import { Card, Typography, Button, Space } from 'antd'

const { Title, Text, Paragraph } = Typography

export default function TestUIPage() {
  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2} style={{ fontFamily: 'Inter, PingFang SC, sans-serif' }}>
          OMS 系统 UI 测试页
        </Title>

        <Paragraph>
          <Text type="secondary">此页面用于验证布局与样式是否正常。</Text>
        </Paragraph>

        <div style={{ marginTop: '24px' }}>
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <Card size="small" title="已完成的 UI 优化">
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>图标与配色优化</li>
                <li>侧边栏浅色主题</li>
                <li>导航字体与系统管理菜单分区</li>
                <li>Logo 与全局字体样式</li>
              </ul>
            </Card>

            <Card size="small" title="按钮示例">
              <Space>
                <Button type="primary">主要按钮</Button>
                <Button>默认按钮</Button>
                <Button type="dashed">虚线按钮</Button>
              </Space>
            </Card>

            <Card size="small" title="字体与排版">
              <Typography>
                <Paragraph>
                  本页使用优化后的字体与行高，便于阅读。若侧边栏为浅色、系统管理在底部，说明 UI 更新已生效。
                </Paragraph>
              </Typography>
            </Card>
          </Space>
        </div>
      </Card>
    </div>
  )
}
