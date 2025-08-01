/**
 * Key Pool 相关类型定义
 */

// API Key 状态
export type ApiKeyStatus = 'active' | 'exhausted' | 'error' | 'disabled'

// API Key 定义
export interface ApiKey {
  id: string
  key: string
  status: ApiKeyStatus
  lastUsedAt?: number
  successCount: number
  failureCount: number
  exhaustedAt?: number  // 速率限制触发时间
  errorMessage?: string // 错误信息
  createdAt: number
  updatedAt: number
}

// Key Pool 配置
export interface KeyPoolConfig {
  recoveryInterval: number  // 恢复间隔（分钟），默认 60
  maxFailures: number      // 最大失败次数，默认 5
  rotationStrategy: 'round-robin' | 'random' | 'least-used'  // 轮换策略
}

// Key Pool 数据
export interface KeyPoolData {
  keys: ApiKey[]
  lastRoundRobinIndex: number
  config: KeyPoolConfig
  createdAt: number
  updatedAt: number
}

// Key Pool 统计信息
export interface KeyPoolStats {
  totalKeys: number
  activeKeys: number
  exhaustedKeys: number
  errorKeys: number
  disabledKeys: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
}

// Key 管理请求
export interface AddKeyRequest {
  key: string
  status?: ApiKeyStatus
}

export interface UpdateKeyRequest {
  status?: ApiKeyStatus
  errorMessage?: string
}

// Key 批量操作
export interface BatchAddKeysRequest {
  keys: string[]
}

export interface BatchKeyOperation {
  keyIds: string[]
  operation: 'enable' | 'disable' | 'delete'
}