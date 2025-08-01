/**
 * Gemini Key Pool 实现
 * 支持多 Key 轮询和 Gemini 特定的错误处理
 */

import { BaseKeyPool } from './base-key-pool'
import { ApiKey } from '../../../../../shared/types/key-pool'

export class GeminiKeyPool extends BaseKeyPool {
  /**
   * 获取下一个可用的 Key（轮询策略）
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
    
    // Round-robin 策略
    const selectedKey = activeKeys[data.lastRoundRobinIndex % activeKeys.length]
    
    // 更新索引
    data.lastRoundRobinIndex = (data.lastRoundRobinIndex + 1) % activeKeys.length
    await this.saveData()
    
    console.log(`🔑 Selected key ${selectedKey.id} from pool ${this.providerId}`)
    return selectedKey
  }

  /**
   * 分析 Gemini 错误并返回是否为速率限制错误
   */
  isRateLimitError(error: any): boolean {
    // Gemini 速率限制错误通常包含特定的错误码或消息
    if (error.status === 429) {
      return true
    }
    
    if (error.message) {
      const message = error.message.toLowerCase()
      if (
        message.includes('rate limit') ||
        message.includes('quota exceeded') ||
        message.includes('too many requests') ||
        message.includes('resource exhausted')
      ) {
        return true
      }
    }
    
    // 检查 Gemini 特定的错误结构
    if (error.error?.code === 429 || error.error?.status === 'RESOURCE_EXHAUSTED') {
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
        message.includes('unauthorized') ||
        message.includes('forbidden') ||
        message.includes('invalid api key') ||
        message.includes('api key not valid')
      ) {
        return true
      }
    }
    
    return false
  }

  /**
   * 获取健康的 Key 数量
   */
  async getHealthyKeyCount(): Promise<number> {
    const data = await this.loadData()
    return data.keys.filter(k => k.status === 'active').length
  }

  /**
   * 智能 Key 选择（未来可以实现更复杂的策略）
   */
  async getSmartKey(): Promise<ApiKey | null> {
    const data = await this.loadData()
    const activeKeys = data.keys.filter(k => k.status === 'active')
    
    if (activeKeys.length === 0) {
      return null
    }
    
    // 可以根据成功率、最后使用时间等因素选择最优 Key
    // 目前简单返回成功率最高的 Key
    const sortedKeys = activeKeys.sort((a, b) => {
      const aSuccessRate = a.successCount / (a.successCount + a.failureCount || 1)
      const bSuccessRate = b.successCount / (b.successCount + b.failureCount || 1)
      return bSuccessRate - aSuccessRate
    })
    
    return sortedKeys[0]
  }
}