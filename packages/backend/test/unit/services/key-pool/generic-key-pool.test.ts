import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GenericKeyPool } from '../../../../src/services/key-pool/generic-key-pool'
import { testKV } from '../../../setup'

describe('GenericKeyPool', () => {
  let keyPool: GenericKeyPool
  const providerId = 'test-provider'
  
  beforeEach(() => {
    keyPool = new GenericKeyPool(providerId, testKV as any)
  })
  
  describe('Key Management', () => {
    it('should add a new key and retrieve it', async () => {
      const keyId = await keyPool.addKey('test-api-key-1')
      expect(keyId).toBeDefined()
      expect(keyId).toMatch(/^key_/)
      
      const nextKey = await keyPool.getNextKey()
      expect(nextKey).toBeDefined()
      expect(nextKey?.key).toBe('test-api-key-1')
      expect(nextKey?.status).toBe('active')
    })
    
    it('should handle multiple keys with round-robin', async () => {
      await keyPool.addKey('test-api-key-1')
      await keyPool.addKey('test-api-key-2')
      
      // 第一轮
      const key1 = await keyPool.getNextKey()
      const key2 = await keyPool.getNextKey()
      
      expect(key1?.key).toBe('test-api-key-1')
      expect(key2?.key).toBe('test-api-key-2')
      
      // 第二轮 - 应该循环回到第一个
      const key3 = await keyPool.getNextKey()
      expect(key3?.key).toBe('test-api-key-1')
    })
    
    it('should return null when no active keys', async () => {
      // 添加一个被禁用的 key
      await keyPool.addKey('test-api-key-1', 'disabled')
      
      const nextKey = await keyPool.getNextKey()
      expect(nextKey).toBeNull()
    })
  })
  
  describe('Key Status Management', () => {
    it('should mark key as exhausted on error', async () => {
      const keyId = await keyPool.addKey('test-api-key-1')
      
      // 使用 key
      const key = await keyPool.getNextKey()
      expect(key).toBeDefined()
      
      // 标记为用尽
      await keyPool.updateKeyStatus(keyId, 'exhausted', 'Rate limit exceeded')
      
      // 再次获取应该返回 null
      const nextKey = await keyPool.getNextKey()
      expect(nextKey).toBeNull()
    })
    
    it('should increment failure count on marking as exhausted', async () => {
      const keyId = await keyPool.addKey('test-api-key-1')
      
      // 标记失败多次 (需要先增加失败计数，再更新状态)
      await keyPool.updateKeyStats(keyId, false) // 失败 1
      await keyPool.updateKeyStats(keyId, false) // 失败 2
      await keyPool.updateKeyStatus(keyId, 'exhausted', 'Error after failures')
      
      // 检查 KV 中的数据
      const data = await testKV.get(`key_pool_${providerId}`, { type: 'json' })
      const key = data.keys.find((k: any) => k.id === keyId)
      
      expect(key.failureCount).toBe(2)
      expect(key.status).toBe('exhausted')
    })
  })
  
  describe('Key Recovery', () => {
    it('should reset exhausted keys after recovery interval', async () => {
      vi.useFakeTimers()
      
      const keyId = await keyPool.addKey('test-api-key-1')
      await keyPool.updateKeyStatus(keyId, 'exhausted', 'Rate limit')
      
      // 初始状态应该没有可用 key
      let nextKey = await keyPool.getNextKey()
      expect(nextKey).toBeNull()
      
      // 快进 61 分钟（默认恢复时间是 60 分钟）
      vi.advanceTimersByTime(61 * 60 * 1000)
      
      // 现在应该可以获取到 key
      nextKey = await keyPool.getNextKey()
      expect(nextKey).toBeDefined()
      expect(nextKey?.key).toBe('test-api-key-1')
      
      vi.useRealTimers()
    })
  })
  
  describe('Rate Limit Detection', () => {
    it('should detect rate limit errors', () => {
      const rateLimitError = { status: 429 }
      expect(keyPool.isRateLimitError(rateLimitError)).toBe(true)
      
      const normalError = { status: 500 }
      expect(keyPool.isRateLimitError(normalError)).toBe(false)
    })
    
    it('should detect rate limit in error messages', () => {
      const messageError = { 
        message: 'Rate limit exceeded for this API key' 
      }
      expect(keyPool.isRateLimitError(messageError)).toBe(true)
      
      const quotaError = {
        message: 'Quota exceeded for this API'
      }
      expect(keyPool.isRateLimitError(quotaError)).toBe(true)
    })
  })
})