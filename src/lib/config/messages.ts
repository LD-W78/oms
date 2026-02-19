/**
 * 页面提示文案常量，避免在组件内硬编码长文本
 */
export const MESSAGES = {
  ORDERS: {
    NO_TABLE_TITLE: '未配置订单表',
    NO_TABLE_DESC_PREFIX: '请在 .env.local 中配置 FEISHU_TABLE_ORDERS（飞书多维表格的数据表 ID），保存后重启开发服务。若表未同步过，请前往',
    NO_TABLE_DESC_SUFFIX: '先同步订单表 Schema。',
    NEED_SYNC_TITLE: '订单表 Schema 未同步',
    NEED_SYNC_DESC_PREFIX: '请前往',
    NEED_SYNC_DESC_MID: '，在「订单表」一行点击「同步」获取表结构后再查看订单数据。',
    LOAD_ERROR_TITLE: '加载订单数据失败',
    LOAD_ERROR_FALLBACK: '请检查网络与飞书配置后重试。',
    SYNC_LINK_TEXT: '系统管理 → 同步',
  },
} as const
