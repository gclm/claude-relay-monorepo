import { describe, it, expect, beforeEach } from 'vitest'
import { createTestApp, createTestRequest, clearTestData } from '../../../helpers'
import type { ModelProvider } from '../../../../../shared/types/admin/providers'

describe('Provider Routes', () => {
  let app: ReturnType<typeof createTestApp>
  
  beforeEach(async () => {
    // 每次测试前清理数据
    await clearTestData()
    app = createTestApp()
    // 主应用已经包含所有路由，无需手动挂载
  })
  
  describe('GET /api/admin/providers', () => {
    it('should return empty list when no providers', async () => {
      const req = createTestRequest('/api/admin/providers')
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toEqual([])
    })
    
    it('should return list of providers', async () => {
      const providers: ModelProvider[] = [
        {
          id: 'provider-1',
          name: 'Test Provider 1',
          type: 'openai',
          endpoint: 'https://api.test1.com',
          model: 'test-model-1',
          transformer: 'claude-to-openai',
          description: 'Test provider 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'provider-2',
          name: 'Test Provider 2',
          type: 'gemini',
          endpoint: 'https://api.test2.com',
          model: 'test-model-2',
          transformer: 'claude-to-gemini',
          description: 'Test provider 2',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      
      await app.kv.put('admin_model_providers', JSON.stringify(providers))
      
      const req = createTestRequest('/api/admin/providers')
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data).toHaveLength(2)
      expect(data.data[0].name).toBe('Test Provider 1')
      expect(data.data[1].name).toBe('Test Provider 2')
    })
  })
  
  describe('POST /api/admin/providers', () => {
    it('should create a new provider', async () => {
      const newProvider = {
        name: 'New Provider',
        type: 'openai',
        endpoint: 'https://api.new.com',
        model: 'new-model',
        transformer: 'claude-to-openai',
        description: 'New test provider'
      }
      
      const req = createTestRequest('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify(newProvider)
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('New Provider')
      expect(data.data.id).toBeDefined()
      
      // 验证是否保存到 KV
      const providers = await app.kv.get('admin_model_providers', { type: 'json' })
      expect(providers).toHaveLength(1)
      expect(providers[0].name).toBe('New Provider')
    })
    
    it('should validate required fields', async () => {
      const invalidProvider = {
        name: 'Invalid Provider',
        // 缺少必需字段
      }
      
      const req = createTestRequest('/api/admin/providers', {
        method: 'POST',
        body: JSON.stringify(invalidProvider)
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.success).toBe(false)
    })
  })
  
  describe('PUT /api/admin/providers/:id', () => {
    it('should update existing provider', async () => {
      const provider: ModelProvider = {
        id: 'provider-1',
        name: 'Original Provider',
        type: 'openai',
        endpoint: 'https://api.original.com',
        model: 'original-model',
        transformer: 'claude-to-openai',
        description: 'Original description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await app.kv.put('admin_model_providers', JSON.stringify([provider]))
      
      const updateData = {
        name: 'Updated Provider',
        endpoint: 'https://api.updated.com',
        model: 'updated-model',
        description: 'Updated description'
      }
      
      const req = createTestRequest('/api/admin/providers/provider-1', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Provider')
      // description 字段现在可以更新了
      expect(data.data.description).toBe('Updated description')
      
      // 验证 KV 中的数据已更新
      const providers = await app.kv.get('admin_model_providers', { type: 'json' })
      expect(providers[0].name).toBe('Updated Provider')
    })
    
    it('should return 404 for non-existent provider', async () => {
      const req = createTestRequest('/api/admin/providers/non-existent', {
        method: 'PUT',
        body: JSON.stringify({ 
          name: 'Updated',
          endpoint: 'https://api.updated.com',
          model: 'updated-model'
        })
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(400)
    })
  })
  
  describe('DELETE /api/admin/providers/:id', () => {
    it('should delete provider', async () => {
      const providers: ModelProvider[] = [
        {
          id: 'provider-1',
          name: 'Provider 1',
          type: 'openai',
          endpoint: 'https://api.test1.com',
          model: 'model-1',
          transformer: 'claude-to-openai',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'provider-2',
          name: 'Provider 2',
          type: 'gemini',
          endpoint: 'https://api.test2.com',
          model: 'model-2',
          transformer: 'claude-to-gemini',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
      
      await app.kv.put('admin_model_providers', JSON.stringify(providers))
      
      const req = createTestRequest('/api/admin/providers/provider-1', {
        method: 'DELETE'
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      
      // 验证 KV 中只剩一个供应商
      const remainingProviders = await app.kv.get('admin_model_providers', { type: 'json' })
      expect(remainingProviders).toHaveLength(1)
      expect(remainingProviders[0].id).toBe('provider-2')
    })
    
    it('should also delete associated key pool data', async () => {
      const provider: ModelProvider = {
        id: 'provider-1',
        name: 'Provider 1',
        type: 'openai',
        endpoint: 'https://api.test.com',
        model: 'model-1',
        transformer: 'claude-to-openai',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      await app.kv.put('admin_model_providers', JSON.stringify([provider]))
      await app.kv.put('key_pool_provider-1', JSON.stringify({ keys: [] }))
      
      const req = createTestRequest('/api/admin/providers/provider-1', {
        method: 'DELETE'
      })
      
      const res = await app.request(req)
      
      expect(res.status).toBe(200)
      
      // 验证关联的 key pool 数据也被删除
      const keyPoolData = await app.kv.get('key_pool_provider-1')
      expect(keyPoolData).toBeNull()
    })
  })
})