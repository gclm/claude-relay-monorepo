/**
 * Key Pool 基础抽象类
 * 定义了所有 Key Pool 实现必须遵循的接口
 */

import { ApiKey, ApiKeyStatus, KeyPoolData, KeyPoolConfig, KeyPoolStats } from '../../../../../shared/types/key-pool'

export abstract class BaseKeyPool {
  protected providerId: string
  protected kv: KVNamespace
  protected data: KeyPoolData | null = null

  constructor(providerId: string, kv: KVNamespace) {
    this.providerId = providerId
    this.kv = kv
  }

  /**
   * 获取存储键名
   */
  protected getStorageKey(): string {
    return `key_pool_${this.providerId}`
  }

  /**
   * 加载 Key Pool 数据
   */
  protected async loadData(): Promise<KeyPoolData> {
    if (this.data) return this.data

    const key = this.getStorageKey()
    const stored = await this.kv.get(key)
    
    if (stored) {
      this.data = JSON.parse(stored)
      return this.data!
    }

    // 初始化新的 Key Pool
    this.data = {
      keys: [],
      lastRoundRobinIndex: 0,
      config: this.getDefaultConfig(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    await this.saveData()
    return this.data
  }

  /**
   * 保存 Key Pool 数据
   */
  protected async saveData(): Promise<void> {
    if (!this.data) return
    
    this.data.updatedAt = Date.now()
    const key = this.getStorageKey()
    await this.kv.put(key, JSON.stringify(this.data))
  }

  /**
   * 获取默认配置
   */
  protected getDefaultConfig(): KeyPoolConfig {
    return {
      recoveryInterval: 60, // 60分钟
      maxFailures: 5,
      rotationStrategy: 'round-robin'
    }
  }

  /**
   * 生成唯一的 Key ID
   */
  protected generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取下一个可用的 Key
   */
  abstract getNextKey(): Promise<ApiKey | null>

  /**
   * 添加新的 API Key
   */
  async addKey(key: string, status: ApiKeyStatus = 'active'): Promise<string> {
    const data = await this.loadData()
    
    const apiKey: ApiKey = {
      id: this.generateKeyId(),
      key: key,
      status: status,
      successCount: 0,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    
    data.keys.push(apiKey)
    await this.saveData()
    
    console.log(`✅ Added key ${apiKey.id} to pool ${this.providerId}`)
    return apiKey.id
  }

  /**
   * 批量添加 API Keys
   */
  async addKeys(keys: string[]): Promise<string[]> {
    const data = await this.loadData()
    const addedIds: string[] = []
    
    for (const key of keys) {
      const apiKey: ApiKey = {
        id: this.generateKeyId(),
        key: key,
        status: 'active',
        successCount: 0,
        failureCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      
      data.keys.push(apiKey)
      addedIds.push(apiKey.id)
    }
    
    await this.saveData()
    console.log(`✅ Added ${keys.length} keys to pool ${this.providerId}`)
    return addedIds
  }

  /**
   * 移除 API Key
   */
  async removeKey(keyId: string): Promise<void> {
    const data = await this.loadData()
    const initialLength = data.keys.length
    
    data.keys = data.keys.filter(k => k.id !== keyId)
    
    if (data.keys.length < initialLength) {
      await this.saveData()
      console.log(`🗑️ Removed key ${keyId} from pool ${this.providerId}`)
    }
  }

  /**
   * 更新 Key 状态
   */
  async updateKeyStatus(keyId: string, status: ApiKeyStatus, errorMessage?: string): Promise<void> {
    const data = await this.loadData()
    const key = data.keys.find(k => k.id === keyId)
    
    if (key) {
      key.status = status
      key.updatedAt = Date.now()
      
      if (status === 'exhausted') {
        key.exhaustedAt = Date.now()
      }
      
      if (errorMessage) {
        key.errorMessage = errorMessage
      }
      
      await this.saveData()
      console.log(`📝 Updated key ${keyId} status to ${status}`)
    }
  }

  /**
   * 更新 Key 使用统计
   */
  async updateKeyStats(keyId: string, success: boolean): Promise<void> {
    const data = await this.loadData()
    const key = data.keys.find(k => k.id === keyId)
    
    if (key) {
      key.lastUsedAt = Date.now()
      key.updatedAt = Date.now()
      
      if (success) {
        key.successCount++
      } else {
        key.failureCount++
        
        // 检查是否超过最大失败次数
        if (key.failureCount >= data.config.maxFailures && key.status === 'active') {
          key.status = 'error'
          key.errorMessage = `Too many failures (${key.failureCount})`
          console.warn(`⚠️ Key ${keyId} disabled due to too many failures`)
        }
      }
      
      await this.saveData()
    }
  }

  /**
   * 获取所有 Keys
   */
  async getKeys(): Promise<ApiKey[]> {
    const data = await this.loadData()
    return [...data.keys] // 返回副本
  }

  /**
   * 获取 Key Pool 统计信息
   */
  async getStats(): Promise<KeyPoolStats> {
    const data = await this.loadData()
    const keys = data.keys
    
    return {
      totalKeys: keys.length,
      activeKeys: keys.filter(k => k.status === 'active').length,
      exhaustedKeys: keys.filter(k => k.status === 'exhausted').length,
      errorKeys: keys.filter(k => k.status === 'error').length,
      disabledKeys: keys.filter(k => k.status === 'disabled').length,
      totalRequests: keys.reduce((sum, k) => sum + k.successCount + k.failureCount, 0),
      successfulRequests: keys.reduce((sum, k) => sum + k.successCount, 0),
      failedRequests: keys.reduce((sum, k) => sum + k.failureCount, 0)
    }
  }

  /**
   * 重置过期的 Keys
   */
  async resetExhaustedKeys(): Promise<void> {
    const data = await this.loadData()
    const now = Date.now()
    const recoveryInterval = data.config.recoveryInterval * 60 * 1000 // 转换为毫秒
    let resetCount = 0
    
    for (const key of data.keys) {
      if (key.status === 'exhausted' && key.exhaustedAt) {
        if (now - key.exhaustedAt >= recoveryInterval) {
          key.status = 'active'
          key.exhaustedAt = undefined
          key.updatedAt = now
          resetCount++
        }
      }
    }
    
    if (resetCount > 0) {
      await this.saveData()
      console.log(`♻️ Reset ${resetCount} exhausted keys in pool ${this.providerId}`)
    }
  }

  /**
   * 清理错误的 Keys（可选实现）
   */
  async cleanupErrorKeys(): Promise<void> {
    const data = await this.loadData()
    const beforeCount = data.keys.length
    
    // 移除失败次数过多的 keys
    data.keys = data.keys.filter(k => k.status !== 'error' || k.failureCount < data.config.maxFailures * 2)
    
    if (data.keys.length < beforeCount) {
      await this.saveData()
      console.log(`🧹 Cleaned up ${beforeCount - data.keys.length} error keys from pool ${this.providerId}`)
    }
  }

  /**
   * 更新配置
   */
  async updateConfig(config: Partial<KeyPoolConfig>): Promise<void> {
    const data = await this.loadData()
    data.config = { ...data.config, ...config }
    await this.saveData()
    console.log(`⚙️ Updated config for pool ${this.providerId}`)
  }
}