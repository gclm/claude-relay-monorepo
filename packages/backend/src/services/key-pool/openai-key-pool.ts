/**
 * OpenAI Key Pool 实现
 * 适用于 OpenAI 兼容的 API 供应商
 */

import { BaseKeyPool } from './base-key-pool'
import { ApiKey } from '../../../../../shared/types/key-pool'

export class OpenAIKeyPool extends BaseKeyPool {
  /**
   * 获取下一个可用的 Key
   * 对于 OpenAI 兼容的供应商，支持多 Key 轮询
   */
  async getNextKey(): Promise<ApiKey | null> {
    // 先尝试重置过期的 keys
    await this.resetExhaustedKeys()
    
    const data = await this.loadData()
    const activeKeys = data.keys.filter(k => k.status === 'active')
    
    if (activeKeys.length === 0) {
      console.warn(`⚠️ No active keys available in pool ${this.providerId}`)
      return null
    }
    
    // 如果只有一个 Key，直接返回
    if (activeKeys.length === 1) {
      return activeKeys[0]
    }
    
    // 多 Key 时使用轮询策略
    const selectedKey = activeKeys[data.lastRoundRobinIndex % activeKeys.length]
    
    // 更新索引
    data.lastRoundRobinIndex = (data.lastRoundRobinIndex + 1) % activeKeys.length
    await this.saveData()
    
    console.log(`🔑 Selected key ${selectedKey.id} from pool ${this.providerId}`)
    return selectedKey
  }

  /**
   * 分析 OpenAI 兼容 API 的错误
   */
  isRateLimitError(error: any): boolean {
    // OpenAI 标准的速率限制状态码
    if (error.status === 429) {
      return true
    }
    
    // 检查错误消息
    if (error.message) {
      const message = error.message.toLowerCase()
      if (
        message.includes('rate limit') ||
        message.includes('quota exceeded') ||
        message.includes('too many requests') ||
        message.includes('requests per minute')
      ) {
        return true
      }
    }
    
    // 检查 OpenAI 格式的错误响应
    if (error.error?.type === 'rate_limit_error') {
      return true
    }
    
    return false
  }

  /**
   * 处理请求错误
   */
  async handleRequestError(keyId: string, error: any): Promise<void> {
    console.error(`❌ Key ${keyId} encountered error:`, error)
    
    if (this.isRateLimitError(error)) {
      // 速率限制错误 - 标记为 exhausted
      await this.updateKeyStatus(keyId, 'exhausted', 'Rate limit exceeded')
      console.log(`⏱️ Key ${keyId} marked as exhausted due to rate limit`)
    } else {
      // 其他错误 - 增加失败计数
      await this.updateKeyStats(keyId, false)
      
      // 如果是认证错误，立即禁用
      if (this.isAuthError(error)) {
        await this.updateKeyStatus(keyId, 'error', 'Authentication failed')
        console.error(`🔐 Key ${keyId} disabled due to auth error`)
      }
    }
  }

  /**
   * 检查是否为认证错误
   */
  private isAuthError(error: any): boolean {
    if (error.status === 401 || error.status === 403) {
      return true
    }
    
    if (error.message) {
      const message = error.message.toLowerCase()
      if (
        message.includes('invalid api key') ||
        message.includes('incorrect api key') ||
        message.includes('authentication failed') ||
        message.includes('unauthorized')
      ) {
        return true
      }
    }
    
    // OpenAI 格式的认证错误
    if (error.error?.type === 'invalid_api_key' || error.error?.type === 'authentication_error') {
      return true
    }
    
    return false
  }
}