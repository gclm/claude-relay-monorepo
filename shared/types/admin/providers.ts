/**
 * 模型供应商相关类型定义
 */

export interface ModelProvider {
  id: string
  name: string
  type: 'openai' | 'google'
  endpoint: string
  model: string
  status: 'active' | 'inactive'
  createdAt: number
  transformer?: 'claude-to-openai' | 'claude-to-gemini'  // 可选，默认 'claude-to-openai'
  keyPoolEnabled?: boolean  // 是否启用 Key Pool（用于向后兼容）
}

export interface AddProviderRequest {
  name: string
  type: 'openai' | 'google'
  endpoint: string
  model: string
  transformer?: 'claude-to-openai' | 'claude-to-gemini'
  initialApiKey?: string  // 初始 API Key（可选）
}

export interface EditProviderRequest {
  name: string
  endpoint: string
  model: string
  transformer?: 'claude-to-openai' | 'claude-to-gemini'
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