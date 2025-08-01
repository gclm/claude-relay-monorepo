/**
 * 仪表板相关类型定义
 */

import type { SelectedModel } from './models'

export interface DashboardData {
  hasClaudeToken: boolean
  tokenExpired: boolean
  providerCount: number
  activeConnections: number
  currentModel: SelectedModel
  claudeAccountsCount: number
  activeClaudeAccounts: number
}