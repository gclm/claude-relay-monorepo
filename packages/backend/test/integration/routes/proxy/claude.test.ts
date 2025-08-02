import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestApp, clearTestData, createTestRequest } from '../../../helpers'
import { IntegrationTestFactory } from '../../../factories/integration-test-factory'
import { IntegrationAssertions } from '../../../assertions/integration-assertions'
import { ADMIN_STORAGE_KEYS } from '../../../../../../shared/constants/admin/storage'

// Mock fetch globally for external API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// 供应商类型配置
const PROVIDER_CONFIGS = [
  { 
    name: 'OpenAI', 
    type: 'openai' as const, 
    transformer: 'claude-to-openai',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    authPrefix: 'Bearer'
  },
  { 
    name: 'Gemini', 
    type: 'gemini' as const, 
    transformer: 'claude-to-gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
    authPrefix: 'key'
  }
] as const

describe('Claude Relay 核心集成测试', () => {
  let app: ReturnType<typeof createTestApp>
  
  const mockClaudeToken = {
    access_token: 'test-claude-token',
    expires_at: Date.now() + 3600000,
    refresh_token: 'test-refresh-token'
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    await clearTestData()
    app = createTestApp()
    
    // 设置默认的 Claude 账号
    await app.kv.put('claude_account_ids', JSON.stringify(['test-account']))
    await app.kv.put('claude_account_token:test-account', JSON.stringify(mockClaudeToken))
  })

  afterEach(async () => {
    await clearTestData()
  })

  describe('端到端：Claude 官方 API 代理', () => {
    it('应该成功代理普通请求到官方 Claude API', async () => {
      // Setup
      const claudeRequest = IntegrationTestFactory.createClaudeRequest()
      const claudeResponse = IntegrationTestFactory.createClaudeResponse()
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(claudeResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      
      // Execute
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(claudeRequest)
      })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertSuccessResponse(response)
      const responseData = await response.json()
      expect(responseData).toEqual(claudeResponse)
      IntegrationAssertions.assertClaudeApiCall(mockFetch, mockClaudeToken.access_token)
    })

    it('应该成功处理流式响应', async () => {
      // Setup
      const streamRequest = IntegrationTestFactory.createClaudeRequest({ stream: true })
      const streamData = IntegrationTestFactory.createClaudeStreamData()
      
      mockFetch.mockResolvedValueOnce(new Response(streamData, {
        status: 200,
        headers: { 
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      }))
      
      // Execute
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(streamRequest)
      })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertStreamResponse(response)
      const responseText = await response.text()
      expect(responseText).toBe(streamData)
    })
  })

  describe.each(PROVIDER_CONFIGS)('端到端：$name 供应商代理', ({ name, type, transformer, endpoint, authPrefix }) => {
    it(`应该成功代理请求到 ${name} 供应商`, async () => {
      // Setup
      const { provider, keyPoolData } = IntegrationTestFactory.createProviderWithKeyPool(type)
      const selectedModel = IntegrationTestFactory.createSelectedModel(provider.id, provider.name)
      
      // 存储配置数据
      await app.kv.put(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS, JSON.stringify([provider]))
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      await app.kv.put(`key_pool_${provider.id}`, JSON.stringify(keyPoolData))
      
      // Mock 供应商响应
      const mockResponse = type === 'openai' 
        ? IntegrationTestFactory.createOpenAIResponse()
        : IntegrationTestFactory.createGeminiResponse()
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      
      // Execute
      const claudeRequest = IntegrationTestFactory.createClaudeRequest()
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(claudeRequest)
      })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertSuccessResponse(response)
      const responseData = await response.json()
      IntegrationAssertions.assertClaudeFormatResponse(responseData)
      
      // 验证正确的 API 调用
      if (type === 'openai') {
        IntegrationAssertions.assertOpenAIApiCall(mockFetch, endpoint, keyPoolData.keys[0].key)
      } else {
        IntegrationAssertions.assertGeminiApiCall(mockFetch, provider.model, keyPoolData.keys[0].key)
      }
    })

    it(`应该正确处理 ${name} 供应商的流式请求`, async () => {
      // Setup
      const { provider, keyPoolData } = IntegrationTestFactory.createProviderWithKeyPool(type)
      const selectedModel = IntegrationTestFactory.createSelectedModel(provider.id, provider.name)
      
      await app.kv.put(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS, JSON.stringify([provider]))
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      await app.kv.put(`key_pool_${provider.id}`, JSON.stringify(keyPoolData))
      
      // Mock 流式响应
      const streamData = type === 'openai'
        ? 'data: {"choices":[{"delta":{"content":"Hello from OpenAI!"}}]}\n\ndata: [DONE]\n\n'
        : 'data: {"candidates":[{"content":{"parts":[{"text":"Hello from Gemini!"}]}}]}\n\n'
      
      mockFetch.mockResolvedValueOnce(new Response(streamData, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      }))
      
      // Execute
      const streamRequest = IntegrationTestFactory.createClaudeRequest({ stream: true })
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(streamRequest)
      })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertStreamResponse(response)
      
      // 验证流式端点调用
      if (type === 'gemini') {
        IntegrationAssertions.assertGeminiApiCall(mockFetch, provider.model, keyPoolData.keys[0].key, true)
      }
    })
  })

  describe('关键错误场景处理', () => {
    it('无可用 Claude Token 时应该返回错误', async () => {
      // Setup - 清除所有 token
      await app.kv.delete('claude_account_ids')
      
      // Execute
      const claudeRequest = IntegrationTestFactory.createClaudeRequest()
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(claudeRequest)
      })
      const response = await app.request(request)
      
      // Assert
      await IntegrationAssertions.assertErrorResponse(
        response,
        500,
        'proxy_error',
        '无法获取有效的Claude访问令牌'
      )
    })

    it('第三方供应商无可用 API Key 时应该返回错误', async () => {
      // Setup
      const { provider } = IntegrationTestFactory.createProviderWithKeyPool('openai')
      const selectedModel = IntegrationTestFactory.createSelectedModel(provider.id, provider.name)
      const emptyKeyPool = IntegrationTestFactory.createKeyPoolData(provider.id, [])
      
      await app.kv.put(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS, JSON.stringify([provider]))
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      await app.kv.put(`key_pool_${provider.id}`, JSON.stringify(emptyKeyPool))
      
      // Execute
      const claudeRequest = IntegrationTestFactory.createClaudeRequest()
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(claudeRequest)
      })
      const response = await app.request(request)
      
      // Assert
      await IntegrationAssertions.assertErrorResponse(
        response,
        500,
        'proxy_error',
        'No available API keys'
      )
    })

    it('应该正确传播 API 错误响应', async () => {
      // Setup
      const errorResponse = IntegrationTestFactory.createErrorResponse(
        'rate_limit_error',
        'Rate limit exceeded',
        429
      )
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: errorResponse.error }),
        { status: errorResponse.status }
      ))
      
      // Execute
      const claudeRequest = IntegrationTestFactory.createClaudeRequest()
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(claudeRequest)
      })
      const response = await app.request(request)
      
      // Assert
      await IntegrationAssertions.assertErrorResponse(
        response,
        429,
        'rate_limit_error',
        'Rate limit exceeded'
      )
    })

    it('应该验证请求格式并返回友好错误', async () => {
      // Execute - 发送无效 JSON
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: 'invalid json'
      })
      const response = await app.request(request)
      
      // Assert
      await IntegrationAssertions.assertErrorResponse(
        response,
        500,
        'proxy_error'
      )
    })

    it('应该验证 Content-Type 头', async () => {
      // Execute
      const request = new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(IntegrationTestFactory.createClaudeRequest())
      })
      const response = await app.request(request)
      
      // Assert
      await IntegrationAssertions.assertErrorResponse(
        response,
        400,
        'invalid_request_error',
        'Content-Type must be application/json'
      )
    })
  })

  describe('系统功能测试', () => {
    it('健康检查端点应该正常工作', async () => {
      // Execute
      const request = createTestRequest('/v1/health', { method: 'GET' })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertSuccessResponse(response)
      const responseData = await response.json()
      IntegrationAssertions.assertHealthResponse(responseData)
    })

    it('CORS 预检请求应该正确处理', async () => {
      // Execute
      const request = new Request('http://localhost/v1/messages', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      })
      const response = await app.request(request)
      
      // Assert
      IntegrationAssertions.assertCorsPreflightResponse(response)
    })

    it('错误响应也应该包含 CORS 头', async () => {
      // Setup - 无 token
      await app.kv.delete('claude_account_ids')
      
      // Execute
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        headers: { 'Origin': 'https://example.com' },
        body: JSON.stringify(IntegrationTestFactory.createClaudeRequest())
      })
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(500)
      IntegrationAssertions.assertProxyHeaders(response)
    })
  })
})