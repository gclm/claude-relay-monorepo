/**
 * 管理中心类型定义 - 简化版
 */

// 管理员认证
export interface AdminAuthRequest {
  username: string
  password: string
}

// 模型供应商
export interface ModelProvider {
  id: string
  name: string
  type: 'openai' | 'google'
  endpoint: string
  apiKey: string
  model: string  // 改为必填
  status: 'active' | 'inactive'
  createdAt: number
  transformer?: 'claude-to-openai' | 'claude-to-gemini'  // 可选，默认 'claude-to-openai'
}

export interface AddProviderRequest {
  name: string
  type: 'openai' | 'google'
  endpoint: string
  apiKey: string
  model: string  // 改为必填
  transformer?: 'claude-to-openai' | 'claude-to-gemini'
}

export interface EditProviderRequest {
  name: string
  endpoint: string
  apiKey: string
  model: string
  transformer?: 'claude-to-openai' | 'claude-to-gemini'
}

// 选中的模型
export interface SelectedModel {
  id: string
  name: string
  type: 'official' | 'provider'
  providerId?: string
}

export interface SelectModelRequest {
  modelId: string
  type: 'official' | 'provider'
  providerId?: string
}

// Claude Code 账号
export interface ClaudeAccount {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'expired'
  tokenInfo?: {
    hasToken: boolean
    isExpired: boolean
    expiresAt?: number
    obtainedAt?: number
    scope?: string
  }
  createdAt: number
  lastActiveAt?: number
}

export interface AddClaudeAccountRequest {
  name: string
  description?: string
}

export interface ClaudeAccountOAuthRequest {
  accountId: string
  code: string
  pkce: {
    codeVerifier: string
    codeChallenge: string
    state: string
  }
}

// 仪表板数据
export interface DashboardData {
  hasClaudeToken: boolean
  tokenExpired: boolean
  providerCount: number
  activeConnections: number
  currentModel: SelectedModel
  claudeAccountsCount: number
  activeClaudeAccounts: number
}

// 预设供应商配置
export interface ProviderConfig {
  name: string
  description: string
  icon: string
  type: 'openai' | 'google'
  endpoint: string
  models: string[]
  helpText: string
  transformer: 'claude-to-openai' | 'claude-to-gemini'
  isPreset: boolean  // 是否为预定义供应商
}