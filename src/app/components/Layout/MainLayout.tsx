'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Layout,
  Menu,
  Button,
  Badge,
  Avatar,
  Dropdown,
  Breadcrumb,
  Drawer,
  theme,
  Grid,
  Divider,
} from 'antd'
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  DashboardOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  TeamOutlined,
  CalculatorOutlined,
  TruckOutlined,
  TableOutlined,
  SettingOutlined,
  HomeOutlined,
  FundOutlined,
  SwapOutlined,
  DollarOutlined,
  PieChartOutlined,
  FileTextOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import type { ReactNode } from 'react'

import { navConfig } from './navConfig'
import type { NavItem } from './navConfig'
import { useAuthStore } from '@/lib/auth/store'
import styles from './layout.module.css'

const { Header, Sider, Content, Footer } = Layout
const { useBreakpoint } = Grid

interface MainLayoutProps {
  children: ReactNode
}

const iconMap: Record<string, ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  UserOutlined: <UserOutlined />,
  InboxOutlined: <InboxOutlined />,
  TeamOutlined: <TeamOutlined />,
  CalculatorOutlined: <CalculatorOutlined />,
  TruckOutlined: <TruckOutlined />,
  TableOutlined: <TableOutlined />,
  SettingOutlined: <SettingOutlined />,
  HomeOutlined: <HomeOutlined />,
  FundOutlined: <FundOutlined />,
  SwapOutlined: <SwapOutlined />,
  DollarOutlined: <DollarOutlined />,
  PieChartOutlined: <PieChartOutlined />,
  FileTextOutlined: <FileTextOutlined />,
}

function filterNavByPermission(items: NavItem[], canAccess: (key: string) => boolean): NavItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const filteredChildren = item.children.filter((c) => canAccess(`${item.key}.${c.key}`))
        if (filteredChildren.length === 0) return null
        return { ...item, children: filteredChildren }
      }
      return canAccess(item.key) ? item : null
    })
    .filter((item): item is NavItem => item != null)
}

function findPathByKey(key: string): string | undefined {
  for (const item of navConfig) {
    if (item.key === key) return item.path
    if (item.children) {
      const child = item.children.find((c) => c.key === key)
      if (child) return child.path
    }
  }
  return undefined
}

type BreadcrumbItemType = {
  title: string
  href?: string
}

function getBreadcrumbItems(pathname: string) {
  const paths = pathname.split('/').filter(Boolean)
  const items: BreadcrumbItemType[] = [{ title: '首页', href: '/dashboard' }]

  const pathMap: Record<string, string> = {
    dashboard: '首页',
    orders: '订单管理',
    customers: '客户管理',
    products: '产品管理',
    suppliers: '供应商',
    quotation: '报价管理',
    logistics: '物流跟踪',
    finance: '财务管理',
    'receivable-payable': '应收应付',
    'cash-flow': '银行流水',
    'business-analysis': '经营分析',
    'feishu-sheet': '飞书表格',
    system: '系统管理',
  }

  paths.forEach((path) => {
    if (pathMap[path] && path !== 'dashboard') {
      items.push({ title: pathMap[path] })
    }
  })

  return items
}

export function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const screens = useBreakpoint()
  const { user, canAccessModule, logout } = useAuthStore()

  useEffect(() => {
    setIsMobile(screens.md === false)
  }, [screens.md])

  // 未登录则跳转登录页（必须在所有 hooks 之后、条件返回之前调用）
  useEffect(() => {
    if (user === null && pathname !== '/login') {
      router.replace('/login')
    }
  }, [user, pathname, router])

  const { token } = theme.useToken()
  const colorBgContainer = token?.colorBgContainer ?? '#ffffff'
  const colorBgLayout = token?.colorBgLayout ?? '#fafafa'
  const colorBorder = token?.colorBorder ?? '#f0f0f0'

  const mainNavItems = useMemo(
    () => filterNavByPermission(navConfig.filter((item) => !item.isSystem), canAccessModule),
    [canAccessModule]
  )
  const systemNavItems = useMemo(
    () => filterNavByPermission(navConfig.filter((item) => item.isSystem), canAccessModule),
    [canAccessModule]
  )

  const handleMenuClick = useCallback(
    (key: string) => {
      const path = findPathByKey(key)
      if (path) {
        router.push(path)
        setMobileDrawerOpen(false)
      }
    },
    [router]
  )

  const selectedKey = useMemo(() => {
    const segments = (pathname || '').split('/').filter(Boolean)
    if (segments[0] === 'finance' && segments[1]) return segments[1]
    return segments[0] || 'dashboard'
  }, [pathname])

  const buildMenuItems = (items: NavItem[]): MenuProps['items'] =>
    items.map((item) => {
      if (item.children?.length) {
        return {
          key: item.key,
          icon: iconMap[item.icon],
          label: item.label,
          children: item.children.map((child) => ({
            key: child.key,
            icon: iconMap[child.icon],
            label: child.label,
          })),
        }
      }
      return {
        key: item.key,
        icon: iconMap[item.icon],
        label: item.label,
      }
    })

  const mainMenuItems = useMemo(() => buildMenuItems(mainNavItems), [])
  const systemMenuItems = useMemo(() => buildMenuItems(systemNavItems), [])

  const breadcrumbItems = useMemo(
    () => getBreadcrumbItems(pathname || '').map((item, i) => ({ ...item, key: String(i) })),
    [pathname]
  )

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: '个人中心',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: '账户设置',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ]

  const handleUserMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === 'profile' || key === 'settings') {
        router.push('/profile')
      } else if (key === 'logout') {
        logout()
        router.push('/login')
      }
    },
    [router, logout]
  )

  const siderWidth = collapsed ? 80 : 220

  // MainLayout 仅用于非登录页（由 LayoutSwitcher 控制）
  return (
    <Layout className={styles.layout}>
      {!isMobile && (
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          breakpoint="md"
          collapsedWidth={80}
          width={220}
          className={collapsed ? styles.siderCollapsed : styles.sider}
          style={{
            background: colorBgContainer,
            borderRight: `1px solid ${colorBorder}`,
          }}
        >
          <div className={styles.logo}>
            <span className={styles.logoIcon}>
              <img src="/logo.png" alt="RITOS" width={44} height={44} style={{ objectFit: 'contain' }} />
            </span>
            {!collapsed && <span className={styles.logoText}>OMS</span>}
          </div>
          <div className={styles.menuWrap}>
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={mainMenuItems}
              onClick={({ key }) => handleMenuClick(key)}
              className={styles.menu}
              style={{ borderRight: 'none', background: 'transparent' }}
            />
          </div>
          <Divider className={styles.siderDivider} />
          <div className={styles.menuWrapSystem}>
            <Menu
              theme="light"
              mode="inline"
              selectedKeys={[selectedKey]}
              items={systemMenuItems}
              onClick={({ key }) => handleMenuClick(key)}
              className={styles.menu}
              style={{ borderRight: 'none', background: 'transparent' }}
            />
          </div>
        </Sider>
      )}

      <Drawer
        placement="left"
        closable={false}
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        size={220}
        styles={{
          body: {
            padding: 0,
            background: colorBgContainer,
            display: 'flex',
            flexDirection: 'column',
          },
          header: { display: 'none' },
        }}
      >
        <div className={styles.logo}>
          <span className={styles.logoIcon}>
            <img src="/logo.png" alt="RITOS" width={44} height={44} style={{ objectFit: 'contain' }} />
          </span>
          <span className={styles.logoText}>OMS</span>
        </div>
        <div className={styles.menuWrap}>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={mainMenuItems}
            onClick={({ key }) => handleMenuClick(key)}
            className={styles.menu}
            style={{ borderRight: 'none', background: 'transparent' }}
          />
        </div>
        <Divider className={styles.siderDivider} />
        <div className={styles.menuWrapSystem}>
          <Menu
            theme="light"
            mode="inline"
            selectedKeys={[selectedKey]}
            items={systemMenuItems}
            onClick={({ key }) => handleMenuClick(key)}
            className={styles.menu}
            style={{ borderRight: 'none', background: 'transparent' }}
          />
        </div>
      </Drawer>

      <Layout style={{ marginLeft: isMobile ? 0 : siderWidth, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header
          className={styles.header}
          style={{ background: colorBgContainer }}
        >
          <div className={styles.headerLeft}>
            <Button
              type="text"
              icon={
                isMobile ? (
                  <MenuOutlined />
                ) : collapsed ? (
                  <MenuUnfoldOutlined />
                ) : (
                  <MenuFoldOutlined />
                )
              }
              onClick={() => {
                if (isMobile) {
                  setMobileDrawerOpen(true)
                } else {
                  setCollapsed(!collapsed)
                }
              }}
              className={styles.trigger}
            />
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <div className={styles.headerRight}>
            <Badge count={5} size="small">
              <Button type="text" icon={<BellOutlined />} shape="circle" />
            </Badge>

            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              arrow
            >
              <Button type="text" style={{ padding: '4px 8px' }}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ marginRight: 8 }}
                />
                {!screens.xs && <span>{user?.name ?? '用户'}</span>}
              </Button>
            </Dropdown>
          </div>
        </Header>

        <Content className={styles.content}>{children}</Content>

        <Footer className={styles.footer}>
          OMS ©{new Date().getFullYear()} Created by Your Company
        </Footer>
      </Layout>
    </Layout>
  )
}
