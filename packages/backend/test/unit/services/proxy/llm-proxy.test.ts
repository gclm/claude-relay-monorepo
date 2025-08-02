import { describe, it, expect, beforeEach, vi, afterEach, test } from 'vitest'
import { LLMProxyService } from '../../../../src/services/proxy/llm-proxy'
import { LocalKVStorage } from '../../../../src/utils/local-kv-storage'
import { ModelProvider } from '../../../../../../../shared/types/admin/providers'
import { ClaudeRequest, LLMProvider } from '../../../../src/types/proxy'
import { ApiKey } from '../../../../../../../shared/types/key-pool'
import { LLMProxyTestFactory } from '../../../factories/llm-proxy-factory'
import { LLMProxyAssertions } from '../../../assertions/llm-proxy-assertions'

// Mock transformers
const mockOpenAITransformer = {
  transformRequestOut: vi.fn(),
  transformResponseIn: vi.fn(),
  convertStreamToClaudeFormat: vi.fn()
}

const mockGeminiTransformer = {
  transformRequestOut: vi.fn(),
  transformResponseIn: vi.fn(),
  convertStreamToClaudeFormat: vi.fn(),
  constructor: { name: 'ClaudeToGeminiTransformer' }
}

// Mock transformer modules
vi.mock('../../../../src/services/transformers/claude-to-openai', () => ({
  ClaudeToOpenAITransformer: vi.fn().mockImplementation(() => mockOpenAITransformer)
}))

vi.mock('../../../../src/services/transformers/claude-to-gemini', () => ({
  ClaudeToGeminiTransformer: vi.fn().mockImplementation(() => mockGeminiTransformer)
}))

// Mock KeyPoolManager
const mockKeyPool = {
  getNextKey: vi.fn(),
  updateKeyStats: vi.fn(),
  handleError: vi.fn()
}

vi.mock('../../../../src/services/key-pool', () => ({
  KeyPoolManager: vi.fn().mockImplementation(() => ({
    initializeFromProvider: vi.fn().mockResolvedValue(undefined),
    getOrCreatePool: vi.fn().mockResolvedValue(mockKeyPool),
    handleRequestError: vi.fn().mockResolvedValue(undefined)
  }))
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('LLM 代理服务单元测试', () => {
  let kv: LocalKVStorage
  let service: LLMProxyService
  const factory = LLMProxyTestFactory
  const assertions = LLMProxyAssertions
  
  // 使用工厂创建测试数据
  const mockClaudeRequest = factory.createClaudeRequest()
  const mockOpenAIProvider = factory.createOpenAIProvider()
  const mockGeminiProvider = factory.createGeminiProvider()
  const mockApiKey = factory.createApiKey()

  beforeEach(async () => {
    vi.clearAllMocks()
    kv = new LocalKVStorage('.test-kv-llm-proxy')
    service = new LLMProxyService(kv as any)
    
    // Reset mocks
    mockKeyPool.getNextKey.mockResolvedValue(mockApiKey)
    mockKeyPool.updateKeyStats.mockResolvedValue(undefined)
    mockOpenAITransformer.transformRequestOut.mockReturnValue({
      model: 'qwen-turbo',
      messages: mockClaudeRequest.messages,
      stream: false
    })
    mockGeminiTransformer.transformRequestOut.mockReturnValue({
      contents: [{ parts: [{ text: 'Hello!' }] }]
    })
  })

  afterEach(async () => {
    // 并行清理测试数据
    const result = await kv.list()
    await Promise.all(result.keys.map(key => kv.delete(key.name)))
  })

  // 辅助函数：创建模拟响应
  const mockFetchResponse = (body: any, options: { status?: number, headers?: HeadersInit } = {}) => {
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      {
        status: options.status || 200,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      }
    )
  }

  describe('registerProviderFromConfig - 从配置注册供应商', () => {
    it('应该成功注册 OpenAI 兼容的供应商', async () => {
      /**
       * 测试场景：注册魔搭 Qwen 供应商（OpenAI 兼容 API）
       * 验证点：
       * 1. 供应商被正确添加到服务中
       * 2. 转换器被正确初始化
       * 3. 供应商列表包含新注册的供应商
       */
      // Execute
      await service.registerProviderFromConfig(mockOpenAIProvider)
      
      // Assert
      assertions.assertProviderRegistration(service, 'qwen-provider', 'claude-to-openai')
    })

    it('应该成功注册 Google Gemini 供应商', async () => {
      /**
       * 测试场景：注册 Google Gemini 供应商
       * 验证点：
       * 1. 正确识别 Gemini 类型
       * 2. 使用专用的 Gemini 转换器
       * 3. 供应商被成功添加
       */
      // Execute
      await service.registerProviderFromConfig(mockGeminiProvider)
      
      // Assert
      assertions.assertProviderRegistration(service, 'gemini-provider', 'claude-to-gemini')
    })

    it('应该为供应商初始化密钥池', async () => {
      /**
       * 测试场景：注册供应商时自动初始化 Key Pool
       * 验证点：
       * 1. KeyPoolManager 被正确调用
       * 2. 传递供应商配置信息
       * 3. Key Pool 初始化完成
       */
      // Execute
      await service.registerProviderFromConfig(mockOpenAIProvider)
      
      // Assert
      const { KeyPoolManager } = await import('../../../../src/services/key-pool')
      const keyPoolInstance = (KeyPoolManager as any).mock.results[0].value
      expect(keyPoolInstance.initializeFromProvider).toHaveBeenCalledWith(mockOpenAIProvider)
    })
  })

  describe('handleRequest - 处理 Claude 请求并转发', () => {
    beforeEach(async () => {
      // Pre-register providers
      await service.registerProviderFromConfig(mockOpenAIProvider)
      await service.registerProviderFromConfig(mockGeminiProvider)
    })

    it('应该正确处理 OpenAI 兼容供应商的请求', async () => {
      /**
       * 测试场景：将 Claude 格式请求转发到 OpenAI 兼容 API
       * 验证点：
       * 1. 从 Key Pool 获取可用的 API 密钥
       * 2. 使用转换器将 Claude 请求转换为 OpenAI 格式
       * 3. 正确设置请求头（Authorization, Content-Type）
       * 4. 将 OpenAI 响应转换回 Claude 格式
       * 5. 更新密钥使用统计
       */
      // Setup
      const mockOpenAIResponse = factory.createOpenAIResponse()
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockOpenAIResponse))
      
      const mockClaudeResponse = factory.createClaudeResponse()
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce(mockClaudeResponse)
      
      // Execute
      const response = await service.handleRequest(mockClaudeRequest, 'qwen-provider')
      
      // Assert
      assertions.assertOpenAIApiCall(
        mockFetch,
        'https://api.qwen.ai/v1/chat/completions',
        mockApiKey.key,
        factory.createTransformedOpenAIRequest('qwen-turbo', mockClaudeRequest.messages)
      )
      
      await assertions.assertJsonResponse(response, mockClaudeResponse)
    })

    it('应该正确处理 Google Gemini 供应商的请求', async () => {
      /**
       * 测试场景：将 Claude 格式请求转发到 Gemini API
       * 验证点：
       * 1. 使用 Gemini 专用转换器
       * 2. API 密钥通过 URL 参数传递（Gemini 特性）
       * 3. 模型名称替换到 URL 中
       * 4. 正确转换请求和响应格式
       */
      // Setup
      const mockGeminiResponse = factory.createGeminiResponse()
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockGeminiResponse))
      
      const mockClaudeResponse = factory.createClaudeResponse('Hello from Gemini!', { id: 'msg_456' })
      mockGeminiTransformer.transformResponseIn.mockResolvedValueOnce(mockClaudeResponse)
      
      // Execute
      const response = await service.handleRequest(mockClaudeRequest, 'gemini-provider')
      
      // Assert
      assertions.assertGeminiApiCall(mockFetch, 'gemini-pro', mockApiKey.key, false)
      await assertions.assertJsonResponse(response, mockClaudeResponse)
    })

    it('应该正确处理 OpenAI 的流式请求', async () => {
      /**
       * 测试场景：客户端请求 OpenAI 供应商的流式响应
       * 验证点：
       * 1. 识别 stream: true 参数
       * 2. 返回 SSE 格式的响应
       * 3. 使用转换器将 OpenAI 流转换为 Claude 流格式
       * 4. 正确设置流式响应头
       */
      // Setup
      const streamRequest = factory.createStreamRequest()
      const mockStreamData = factory.createOpenAIStreamData()
      
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(mockStreamData, { headers: { 'Content-Type': 'text/event-stream' } })
      )
      
      const mockTransformedStream = factory.createReadableStream(
        'data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n'
      )
      mockOpenAITransformer.convertStreamToClaudeFormat.mockResolvedValueOnce(mockTransformedStream)
      
      // Execute
      const response = await service.handleRequest(streamRequest, 'qwen-provider')
      
      // Assert
      assertions.assertStreamResponse(response)
      assertions.assertTransformerCalls(mockOpenAITransformer, true, false, true)
    })

    it('应该正确处理 Gemini 的流式请求', async () => {
      /**
       * 测试场景：客户端请求 Gemini 供应商的流式响应
       * 验证点：
       * 1. URL 中使用 streamGenerateContent 端点
       * 2. Gemini 返回的 JSON 数组被转换为 SSE 流
       * 3. 保持响应内容的完整性
       */
      // Setup
      const streamRequest = { ...mockClaudeRequest, stream: true }
      mockGeminiTransformer.transformRequestOut.mockReturnValueOnce({
        contents: [{ parts: [{ text: 'Hello!' }] }]
      })
      
      const mockGeminiStreamResponse = [
        { candidates: [{ content: { parts: [{ text: 'Hello' }] } }] },
        { candidates: [{ content: { parts: [{ text: ' from Gemini!' }] } }] }
      ]
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockGeminiStreamResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const mockTransformedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello from Gemini!"}}\n\n'))
          controller.close()
        }
      })
      mockGeminiTransformer.convertStreamToClaudeFormat.mockResolvedValueOnce(mockTransformedStream)
      
      // Execute
      const response = await service.handleRequest(streamRequest, 'gemini-provider')
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(':streamGenerateContent'),
        expect.any(Object)
      )
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    })

    // 错误场景测试表格
    const errorScenarios = [
      {
        name: '供应商不存在',
        setup: () => {},
        executeRequest: () => service.handleRequest(mockClaudeRequest, 'non-existent'),
        expectedError: 'Provider non-existent not found'
      },
      {
        name: '没有可用的 API 密钥',
        setup: () => {
          mockKeyPool.getNextKey.mockResolvedValueOnce(null)
        },
        executeRequest: () => service.handleRequest(mockClaudeRequest, 'qwen-provider'),
        expectedError: 'No available API keys for provider qwen-provider'
      },
      {
        name: 'API 返回 429 错误',
        setup: () => {
          const errorResponse = factory.createErrorResponse(429, 'Rate limit exceeded')
          mockFetch.mockResolvedValueOnce(
            mockFetchResponse(errorResponse.body, { status: errorResponse.status })
          )
        },
        executeRequest: () => service.handleRequest(mockClaudeRequest, 'qwen-provider'),
        expectedError: 'qwen-provider API error: 429',
        expectKeyPoolError: true
      },
      {
        name: '网络错误',
        setup: () => {
          mockFetch.mockRejectedValueOnce(new Error('Network error'))
        },
        executeRequest: () => service.handleRequest(mockClaudeRequest, 'qwen-provider'),
        expectedError: 'Network error',
        expectKeyPoolError: true
      },
      {
        name: 'JSON 解析错误',
        setup: () => {
          mockFetch.mockResolvedValueOnce(
            mockFetchResponse('Invalid JSON response')
          )
        },
        executeRequest: () => service.handleRequest(mockClaudeRequest, 'qwen-provider'),
        expectedError: 'Failed to parse JSON'
      }
    ]

    test.each(errorScenarios)(
      '应该正确处理错误：$name',
      async ({ setup, executeRequest, expectedError, expectKeyPoolError }) => {
        // Setup
        setup()
        
        // Execute & Assert
        await assertions.assertApiErrorHandling(
          executeRequest(),
          expectedError,
          expectKeyPoolError ? true : undefined,
          expectKeyPoolError ? 'qwen-provider' : undefined,
          expectKeyPoolError ? 'key-123' : undefined
        )
      }
    )


    it('成功请求后应该更新密钥统计信息', async () => {
      /**
       * 测试场景：请求成功完成
       * 验证点：
       * 1. API 请求成功
       * 2. 调用 updateKeyStats 方法
       * 3. 传递正确的密钥 ID 和成功状态
       * 4. 统计信息用于 Key Pool 的智能轮转
       */
      // Setup
      const successResponse = factory.createOpenAIResponse('Success')
      mockFetch.mockResolvedValueOnce(mockFetchResponse(successResponse))
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce(
        factory.createClaudeResponse('Success')
      )
      
      // Execute
      await service.handleRequest(mockClaudeRequest, 'qwen-provider')
      
      // Assert
      assertions.assertKeyPoolCalls(mockKeyPool, true, { keyId: 'key-123', success: true })
    })
  })

  describe('转换器管理', () => {
    it('应该能够添加自定义转换器', () => {
      /**
       * 测试场景：添加一个新的 API 格式转换器
       * 验证点：
       * 1. 转换器被成功添加
       * 2. 可以通过名称获取转换器
       * 3. 支持扩展新的 API 格式
       */
      // Setup
      const customTransformer = {
        transformRequestOut: vi.fn(),
        transformResponseIn: vi.fn()
      }
      
      // Execute
      service.addTransformer('custom-transformer', customTransformer)
      
      // Assert
      const transformers = service.getTransformers()
      expect(transformers).toContain('custom-transformer')
    })

    it('当未指定转换器时应该使用默认转换器', async () => {
      /**
       * 测试场景：供应商配置中没有指定 transformer 字段
       * 验证点：
       * 1. 默认使用 claude-to-openai 转换器
       * 2. 请求被正确转换
       * 3. 兼容旧版本配置
       */
      // Setup
      const providerWithoutTransformer = {
        ...mockOpenAIProvider,
        transformer: undefined
      }
      
      // Mock fetch response
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [{ message: { content: 'Test' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Test' }] })
      
      // Execute
      await service.registerProviderFromConfig(providerWithoutTransformer)
      
      // Assert - Should use claude-to-openai as default
      await service.handleRequest(mockClaudeRequest, providerWithoutTransformer.id)
      expect(mockOpenAITransformer.transformRequestOut).toHaveBeenCalled()
    })
  })

  describe('请求准备阶段', () => {
    beforeEach(async () => {
      await service.registerProviderFromConfig(mockOpenAIProvider)
      await service.registerProviderFromConfig(mockGeminiProvider)
    })

    // 供应商特性测试表格
    const providerFeatures = [
      {
        name: 'OpenAI 兼容供应商',
        providerId: 'qwen-provider',
        features: {
          authMethod: 'header',
          authHeader: 'Authorization',
          authPrefix: 'Bearer',
          streamEndpoint: 'same',
          requiresUserAgent: true
        }
      },
      {
        name: 'Google Gemini',
        providerId: 'gemini-provider',
        features: {
          authMethod: 'url',
          authParam: 'key',
          streamEndpoint: 'different',
          modelInUrl: true,
          requiresUserAgent: true
        }
      }
    ]

    test.each(providerFeatures)(
      '$name 特性验证',
      async ({ providerId, features }) => {
        // Setup
        const request = features.streamEndpoint ? factory.createStreamRequest() : mockClaudeRequest
        mockFetch.mockResolvedValueOnce(mockFetchResponse({}))
        
        if (providerId === 'gemini-provider') {
          mockGeminiTransformer.transformResponseIn.mockResolvedValueOnce(factory.createClaudeResponse())
          if (features.streamEndpoint === 'different') {
            const mockStream = factory.createReadableStream('data: test\n\n')
            mockGeminiTransformer.convertStreamToClaudeFormat.mockResolvedValueOnce(mockStream)
          }
        } else {
          mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce(factory.createClaudeResponse())
        }
        
        // Execute
        await service.handleRequest(request, providerId)
        
        // Assert
        const fetchCall = mockFetch.mock.calls[0]
        const [url, options] = fetchCall
        
        // 验证认证方式
        if (features.authMethod === 'header') {
          expect(options.headers[features.authHeader]).toBe(`${features.authPrefix} ${mockApiKey.key}`)
        } else if (features.authMethod === 'url') {
          expect(url).toContain(`${features.authParam}=${mockApiKey.key}`)
        }
        
        // 验证 User-Agent
        if (features.requiresUserAgent) {
          assertions.assertUserAgentHeader(mockFetch)
        }
        
        // 验证流式端点
        if (features.streamEndpoint === 'different' && request.stream) {
          expect(url).toContain('streamGenerateContent')
        }
        
        // 验证模型在 URL 中
        if (features.modelInUrl) {
          expect(url).not.toContain('{{model}}')
          expect(url).toContain('/models/')
        }
      }
    )

  })
})