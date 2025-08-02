import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestApp, clearTestData, createTestRequest } from '../../../helpers'
import { ADMIN_STORAGE_KEYS } from '../../../../../../shared/constants/admin/storage'
import { SelectedModel } from '../../../../../../shared/types/admin/models'
import { ModelProvider } from '../../../../../../shared/types/admin/providers'

// Mock fetch globally for external API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock transformers
vi.mock('../../../../../src/services/transformers/claude-to-openai', () => ({
  ClaudeToOpenAITransformer: vi.fn().mockImplementation(() => ({
    transformRequestOut: vi.fn().mockImplementation((request) => ({
      messages: request.messages,
      model: 'gpt-4',
      max_tokens: request.max_tokens,
      stream: request.stream
    })),
    transformResponseIn: vi.fn().mockImplementation((response) => ({
      id: 'msg_' + response.id,
      type: 'message',
      role: 'assistant',
      content: [{ 
        type: 'text', 
        text: response.choices?.[0]?.message?.content || 'Hello from OpenAI!' 
      }]
    })),
    convertStreamToClaudeFormat: vi.fn()
  }))
}))

vi.mock('../../../../../src/services/transformers/claude-to-gemini', () => ({
  ClaudeToGeminiTransformer: vi.fn().mockImplementation(() => ({
    transformRequestOut: vi.fn().mockImplementation(() => ({
      contents: [{ parts: [{ text: 'Hello!' }] }]
    })),
    transformResponseIn: vi.fn(),
    convertStreamToClaudeFormat: vi.fn().mockImplementation((stream) => {
      // Return a promise that resolves to a mock stream
      return Promise.resolve(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello from Gemini!"}}\n\n'))
          controller.close()
        }
      }))
    }),
    constructor: { name: 'ClaudeToGeminiTransformer' }
  }))
}))

describe('Claude API 代理路由集成测试', () => {
  let app: ReturnType<typeof createTestApp>
  
  // Mock data
  const mockClaudeToken = {
    access_token: 'test-claude-token',
    expires_at: Date.now() + 3600000, // 1 hour from now
    refresh_token: 'test-refresh-token'
  }
  
  const mockProviders: ModelProvider[] = [
    {
      id: 'test-openai-provider',
      name: 'Test OpenAI Provider',
      type: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4',
      transformer: 'claude-to-openai',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'test-gemini-provider',
      name: 'Test Gemini Provider',
      type: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
      model: 'gemini-pro',
      transformer: 'claude-to-gemini',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
  
  const mockClaudeRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'Hello, Claude!' }
    ],
    max_tokens: 100
  }
  
  const mockClaudeResponse = {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'text', text: 'Hello! How can I help you today?' }
    ],
    model: 'claude-3-opus-20240229',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 10,
      output_tokens: 20
    }
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    await clearTestData()
    app = createTestApp()
    
    // Setup default data
    await app.kv.put('claude_account_ids', JSON.stringify(['test-account']))
    await app.kv.put('claude_account_token:test-account', JSON.stringify(mockClaudeToken))
    await app.kv.put(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS, JSON.stringify(mockProviders))
  })

  afterEach(async () => {
    await clearTestData()
  })

  describe('POST /v1/messages - Claude Messages API 代理', () => {
    it('使用默认模型时应该代理到官方 Claude API', async () => {
      /**
       * 测试场景：完整的端到端请求流程，从路由到服务再到响应
       * 验证点：
       * 1. 路由正确接收请求
       * 2. 调用 ClaudeProxyService 处理
       * 3. 使用正确的认证信息
       * 4. 返回正确的响应格式
       */
      // Setup
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockClaudeResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(200)
      const responseData = await response.json()
      expect(responseData).toEqual(mockClaudeResponse)
      
      // Verify Claude API was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-claude-token',
            'anthropic-version': '2023-06-01'
          })
        })
      )
    })

    it('应该验证 Content-Type 请求头', async () => {
      /**
       * 测试场景：客户端发送错误的 Content-Type
       * 验证点：
       * 1. 检查 Content-Type 是否为 application/json
       * 2. 返回 400 错误状态码
       * 3. 错误信息明确指出问题
       */
      // Setup
      const request = new Request('http://localhost/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain' // Wrong content type
        },
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(400)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('invalid_request_error')
      expect(errorData.error.message).toBe('Content-Type must be application/json')
    })

    it('应该正确处理流式响应', async () => {
      /**
       * 测试场景：客户端请求 SSE 流式响应
       * 验证点：
       * 1. 识别 stream: true 参数
       * 2. 返回 text/event-stream 类型
       * 3. 保持流式数据完整性
       * 4. 包含必要的流式响应头
       */
      // Setup
      const streamData = [
        'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-opus-20240229"}}\n\n',
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}\n\n',
        'data: {"type":"content_block_stop","index":0}\n\n',
        'data: {"type":"message_stop"}\n\n'
      ].join('')
      
      mockFetch.mockResolvedValueOnce(new Response(
        streamData,
        { 
          status: 200,
          headers: { 
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          }
        }
      ))
      
      const streamRequest = { ...mockClaudeRequest, stream: true }
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(streamRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      
      const responseText = await response.text()
      expect(responseText).toBe(streamData)
    })

    it('选择第三方供应商时应该正确代理请求', async () => {
      /**
       * 测试场景：用户选择了 OpenAI 兼容供应商
       * 验证点：
       * 1. 从 KV 读取选中的模型配置
       * 2. 使用 Key Pool 获取 API 密钥
       * 3. 调用正确的供应商 API
       * 4. 响应被转换为 Claude 格式
       */
      // Setup - Select OpenAI provider
      const selectedModel: SelectedModel = {
        id: 'test-openai-provider',
        name: 'Test OpenAI Provider',
        type: 'provider',
        providerId: 'test-openai-provider'
      }
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      
      // Add API key for the provider
      await app.kv.put('key_pool_test-openai-provider', JSON.stringify({
        keys: [{
          id: 'key-1',
          key: 'sk-test-key',
          status: 'active',
          createdAt: Date.now(),
          usageCount: 0,
          successCount: 0,
          errorCount: 0
        }],
        stats: {
          total: 1,
          active: 1,
          inactive: 0,
          error: 0
        },
        config: {
          rotationStrategy: 'round-robin',
          recoveryInterval: 60,
          maxRetries: 3,
          retryDelay: 1000
        }
      }))
      
      // Mock OpenAI response
      const mockOpenAIResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: 'Hello from OpenAI!'
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      }
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockOpenAIResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(200)
      const responseData = await response.json() as any
      
      // Should be transformed to Claude format
      expect(responseData.type).toBe('message')
      expect(responseData.role).toBe('assistant')
      expect(responseData.content).toHaveLength(1)
      expect(responseData.content[0].text).toBe('Hello from OpenAI!')
      
      // Verify OpenAI API was called
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key'
          })
        })
      )
    })

    it('应该正确处理 Claude API 的错误响应', async () => {
      /**
       * 测试场景：Claude API 返回 429 速率限制错误
       * 验证点：
       * 1. 保持原始错误状态码
       * 2. 返回完整的错误信息
       * 3. 包含 CORS 头信息
       */
      // Setup
      const errorResponse = {
        error: {
          type: 'rate_limit_error',
          message: 'Rate limit exceeded'
        }
      }
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(errorResponse),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(429)
      const responseData = await response.json()
      expect(responseData).toEqual(errorResponse)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('缺少 Claude 令牌时应该返回错误', async () => {
      /**
       * 测试场景：系统中没有配置 Claude 账号
       * 验证点：
       * 1. 服务检测到没有可用 token
       * 2. 返回 500 错误
       * 3. 错误类型为 proxy_error
       * 4. 包含清晰的错误描述
       */
      // Setup - Remove token
      await app.kv.delete('claude_account_ids')
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
      expect(errorData.error.message).toContain('无法获取有效的Claude访问令牌')
    })

    it('应该正确处理第三方供应商的错误', async () => {
      /**
       * 测试场景：Key Pool 中没有可用的 API 密钥
       * 验证点：
       * 1. Key Pool 返回空
       * 2. 服务抛出错误
       * 3. 路由层捕获并处理错误
       * 4. 返回统一的错误格式
       */
      // Setup - Select provider
      const selectedModel: SelectedModel = {
        id: 'test-openai-provider',
        name: 'Test OpenAI Provider',
        type: 'provider',
        providerId: 'test-openai-provider'
      }
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      
      // No API keys available
      await app.kv.put('key_pool_test-openai-provider', JSON.stringify({
        keys: [],
        stats: { total: 0, active: 0, inactive: 0, error: 0 },
        config: {
          rotationStrategy: 'round-robin',
          recoveryInterval: 60,
          maxRetries: 3,
          retryDelay: 1000
        }
      }))
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
      expect(errorData.error.message).toContain('No available API keys')
    })

    it('应该处理格式错误的请求体', async () => {
      /**
       * 测试场景：发送无效的 JSON 数据
       * 验证点：
       * 1. JSON 解析失败
       * 2. 返回 500 错误
       * 3. 不暴露内部异常细节
       */
      // Setup
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: 'invalid json'
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
    })

    it('应该正确处理 Gemini 供应商的流式请求', async () => {
      /**
       * 测试场景：选择 Gemini 供应商并请求流式响应
       * 验证点：
       * 1. 使用 Gemini 流式 API 端点
       * 2. 正确转换请求格式
       * 3. 返回 SSE 格式的响应
       * 4. 转换器正确工作
       */
      // Setup - Select Gemini provider
      const selectedModel: SelectedModel = {
        id: 'test-gemini-provider',
        name: 'Test Gemini Provider',
        type: 'provider',
        providerId: 'test-gemini-provider'
      }
      await app.kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(selectedModel))
      
      // Add API key
      await app.kv.put('key_pool_test-gemini-provider', JSON.stringify({
        keys: [{
          id: 'key-1',
          key: 'gemini-test-key',
          status: 'active',
          createdAt: Date.now(),
          usageCount: 0,
          successCount: 0,
          errorCount: 0
        }],
        stats: { total: 1, active: 1, inactive: 0, error: 0 },
        config: {
          rotationStrategy: 'round-robin',
          recoveryInterval: 60,
          maxRetries: 3,
          retryDelay: 1000
        }
      }))
      
      // Mock Gemini stream response
      const mockGeminiResponse = [
        {
          candidates: [{
            content: {
              parts: [{ text: 'Hello' }],
              role: 'model'
            }
          }]
        },
        {
          candidates: [{
            content: {
              parts: [{ text: ' from Gemini!' }],
              role: 'model'
            }
          }]
        }
      ]
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockGeminiResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const streamRequest = { ...mockClaudeRequest, stream: true }
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        body: JSON.stringify(streamRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      
      // Verify Gemini stream endpoint was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(':streamGenerateContent'),
        expect.any(Object)
      )
    })
  })

  describe('GET /v1/health - 健康检查端点', () => {
    it('应该返回健康状态', async () => {
      /**
       * 测试场景：检查服务是否正常运行
       * 验证点：
       * 1. 返回 200 状态码
       * 2. 包含服务名称和状态
       * 3. 包含时间戳
       * 4. 时间戳格式正确
       */
      // Setup
      const request = createTestRequest('/v1/health', {
        method: 'GET'
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.status).toBe('ok')
      expect(data.service).toBe('Claude API Proxy')
      expect(data.timestamp).toBeDefined()
      
      // Verify timestamp format
      const timestamp = new Date(data.timestamp)
      expect(timestamp.getTime()).toBeGreaterThan(0)
    })
  })

  describe('CORS 支持 - 跨域资源共享', () => {
    it('应该正确处理 OPTIONS 预检请求', async () => {
      /**
       * 测试场景：浏览器发送 CORS 预检请求
       * 验证点：
       * 1. 返回 204 No Content（标准 CORS 响应）
       * 2. 包含 Access-Control-Allow-Origin: *
       * 3. 包含允许的方法和头信息
       * 4. 支持所有必要的 Claude API 头
       */
      // Setup
      const request = new Request('http://localhost/v1/messages', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type, Authorization'
        }
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    })

    it('错误响应也应该包含 CORS 头信息', async () => {
      /**
       * 测试场景：错误情况下仍需支持跨域
       * 验证点：
       * 1. 即使请求失败也返回 CORS 头
       * 2. 确保浏览器能正确处理错误
       * 3. 避免 CORS 错误掩盖真实错误
       */
      // Setup - No token available
      await app.kv.delete('claude_account_ids')
      
      const request = createTestRequest('/v1/messages', {
        method: 'POST',
        headers: {
          'Origin': 'https://example.com'
        },
        body: JSON.stringify(mockClaudeRequest)
      })
      
      // Execute
      const response = await app.request(request)
      
      // Assert
      expect(response.status).toBe(500)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })
})