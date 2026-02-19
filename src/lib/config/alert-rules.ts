/**
 * 预警规则配置
 * 物流跟踪等模块的警告、通知、信息、预警规则统一由此配置驱动
 */

import alertRulesConfig from '../../../config/alert-rules.json'

export type AlertRuleType = 'error' | 'warning' | 'info'

export interface AlertRuleItem {
  id: string
  type: AlertRuleType
  label: string
  condition: string
  conditionDesc: string
  message: string
  threshold?: number
  unit?: string
  enabled: boolean
}

export interface LogisticsAlertRulesConfig {
  moduleId: string
  moduleName: string
  params: {
    arrivingDays: number
    delayDays: number
  }
  rules: AlertRuleItem[]
}

export interface AlertRulesConfig {
  version: string
  modules: {
    logistics?: LogisticsAlertRulesConfig
    [key: string]: unknown
  }
}

const config = alertRulesConfig as AlertRulesConfig

/** 获取物流跟踪模块预警规则配置 */
export function getLogisticsAlertRules(): LogisticsAlertRulesConfig | null {
  return config.modules?.logistics ?? null
}

/** 获取物流模块参数（arrivingDays, delayDays） */
export function getLogisticsAlertParams(): { arrivingDays: number; delayDays: number } {
  const logistics = getLogisticsAlertRules()
  return logistics?.params ?? { arrivingDays: 7, delayDays: 3 }
}

/** 获取物流模块规则描述（用于卡片和详情展示） */
export function getLogisticsAlertRulesDescription(): Array<{
  type: AlertRuleType
  label: string
  condition: string
  message: string
}> {
  const logistics = getLogisticsAlertRules()
  if (!logistics) {
    return [
      { type: 'error', label: '错误', condition: '超过到港日期 ≥ 3 天', message: '超过到港日期X天，请确认物流进度' },
      { type: 'warning', label: '警告', condition: 'ETD 或 ETA 无效/缺失', message: '请确认ETD/ETA时间' },
      { type: 'info', label: '信息', condition: '未来 7 天内到港（未到港）', message: '请注意：货物在未来X天内到港' },
    ]
  }
  return logistics.rules
    .filter((r) => r.enabled)
    .map((r) => ({
      type: r.type as AlertRuleType,
      label: r.label,
      condition: r.conditionDesc,
      message: r.message,
    }))
}
