import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { LLMProxyService } from '../../../../src/services/proxy/llm-proxy'
import { LocalKVStorage } from '../../../../src/utils/local-kv-storage'
import { ModelProvider } from '../../../../../../../shared/types/admin/providers'
import { ClaudeRequest, LLMProvider } from '../../../../src/types/proxy'
import { ApiKey } from '../../../../../../../shared/types/key-pool'

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
  
  // Mock data
  const mockClaudeRequest: ClaudeRequest = {
    model: 'claude-3-opus-20240229',
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    stream: false
  }
  
  const mockOpenAIProvider: ModelProvider = {
    id: 'qwen-provider',
    name: '魔搭 Qwen',
    type: 'qwen',
    endpoint: 'https://api.qwen.ai/v1/chat/completions',
    model: 'qwen-turbo',
    transformer: 'claude-to-openai'
  }
  
  const mockGeminiProvider: ModelProvider = {
    id: 'gemini-provider',
    name: 'Google Gemini',
    type: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
    model: 'gemini-pro',
    transformer: 'claude-to-gemini'
  }
  
  const mockApiKey: ApiKey = {
    id: 'key-123',
    key: 'sk-test-key',
    status: 'active',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    usageCount: 10,
    successCount: 9,
    errorCount: 1
  }

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
    // Clean up test data
    const result = await kv.list()
    for (const key of result.keys) {
      await kv.delete(key.name)
    }
  })

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
      const providers = service.getProviders()
      expect(providers).toContain('qwen-provider')
      
      const transformers = service.getTransformers()
      expect(transformers).toContain('claude-to-openai')
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
      const providers = service.getProviders()
      expect(providers).toContain('gemini-provider')
      
      const transformers = service.getTransformers()
      expect(transformers).toContain('claude-to-gemini')
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
      const mockOpenAIResponse = {
        id: 'chatcmpl-123',
        choices: [{
          message: { role: 'assistant', content: 'Hello! How can I help?' },
          finish_reason: 'stop'
        }]
      }
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockOpenAIResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const mockClaudeResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello! How can I help?' }]
      }
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce(mockClaudeResponse)
      
      // Execute
      const response = await service.handleRequest(mockClaudeRequest, 'qwen-provider')
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.qwen.ai/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            model: 'qwen-turbo',
            messages: mockClaudeRequest.messages,
            stream: false
          })
        })
      )
      
      const responseData = await response.json()
      expect(responseData).toEqual(mockClaudeResponse)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
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
      const mockGeminiResponse = {
        candidates: [{
          content: {
            parts: [{ text: 'Hello from Gemini!' }]
          }
        }]
      }
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify(mockGeminiResponse),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      const mockClaudeResponse = {
        id: 'msg_456',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello from Gemini!' }]
      }
      mockGeminiTransformer.transformResponseIn.mockResolvedValueOnce(mockClaudeResponse)
      
      // Execute
      const response = await service.handleRequest(mockClaudeRequest, 'gemini-provider')
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Hello!' }] }]
          })
        })
      )
      
      // Verify API key in URL for Gemini
      const fetchCall = mockFetch.mock.calls[0]
      expect(fetchCall[0]).toContain('key=sk-test-key')
      
      const responseData = await response.json()
      expect(responseData).toEqual(mockClaudeResponse)
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
      const streamRequest = { ...mockClaudeRequest, stream: true }
      const mockStreamData = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
      
      mockFetch.mockResolvedValueOnce(new Response(
        mockStreamData,
        { 
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' }
        }
      ))
      
      const mockTransformedStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n'))
          controller.close()
        }
      })
      mockOpenAITransformer.convertStreamToClaudeFormat.mockResolvedValueOnce(mockTransformedStream)
      
      // Execute
      const response = await service.handleRequest(streamRequest, 'qwen-provider')
      
      // Assert
      expect(response.headers.get('Content-Type')).toBe('text/event-stream')
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
      expect(mockOpenAITransformer.convertStreamToClaudeFormat).toHaveBeenCalled()
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

    it('当供应商不存在时应该抛出错误', async () => {
      /**
       * 测试场景：请求一个未注册的供应商
       * 验证点：
       * 1. 检查供应商是否存在
       * 2. 抛出明确的错误信息
       * 3. 错误包含供应商名称
       */
      // Execute & Assert
      await expect(service.handleRequest(mockClaudeRequest, 'non-existent'))
        .rejects.toThrow('Provider non-existent not found')
    })

    it('当没有可用的 API 密钥时应该抛出错误', async () => {
      /**
       * 测试场景：Key Pool 中没有可用的密钥
       * 验证点：
       * 1. Key Pool 返回 null
       * 2. 抛出明确的错误信息
       * 3. 不会继续执行请求
       */
      // Setup
      mockKeyPool.getNextKey.mockResolvedValueOnce(null)
      
      // Execute & Assert
      await expect(service.handleRequest(mockClaudeRequest, 'qwen-provider'))
        .rejects.toThrow('No available API keys for provider qwen-provider')
    })

    it('应该正确处理 API 请求错误', async () => {
      /**
       * 测试场景：供应商 API 返回 429 速率限制错误
       * 验证点：
       * 1. 捕获 API 错误响应
       * 2. 抽取错误信息
       * 3. 调用 KeyPoolManager 处理错误
       * 4. 抛出包含详细信息的错误
       */
      // Setup
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      // Execute & Assert
      await expect(service.handleRequest(mockClaudeRequest, 'qwen-provider'))
        .rejects.toThrow('qwen-provider API error: 429')
      
      // Verify error handling was called
      const { KeyPoolManager } = await import('../../../../src/services/key-pool')
      const keyPoolInstance = (KeyPoolManager as any).mock.results[0].value
      expect(keyPoolInstance.handleRequestError).toHaveBeenCalledWith(
        'qwen-provider',
        'key-123',
        expect.any(Error)
      )
    })

    it('应该正确处理网络错误', async () => {
      /**
       * 测试场景：网络请求失败
       * 验证点：
       * 1. 捕获网络异常
       * 2. 调用 KeyPoolManager 的错误处理
       * 3. 保留原始错误信息
       */
      // Setup
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      
      // Execute & Assert
      await expect(service.handleRequest(mockClaudeRequest, 'qwen-provider'))
        .rejects.toThrow('Network error')
      
      // Verify error handling
      const { KeyPoolManager } = await import('../../../../src/services/key-pool')
      const keyPoolInstance = (KeyPoolManager as any).mock.results[0].value
      expect(keyPoolInstance.handleRequestError).toHaveBeenCalled()
    })

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
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [{ message: { content: 'Success' } }] }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Success' }]
      })
      
      // Execute
      await service.handleRequest(mockClaudeRequest, 'qwen-provider')
      
      // Assert
      expect(mockKeyPool.updateKeyStats).toHaveBeenCalledWith('key-123', true)
    })

    it('应该处理响应中的 JSON 解析错误', async () => {
      /**
       * 测试场景：API 返回无效的 JSON
       * 验证点：
       * 1. 尝试解析响应文本
       * 2. 捕获 JSON 解析异常
       * 3. 记录错误信息
       * 4. 抛出有意义的错误
       */
      // Setup
      mockFetch.mockResolvedValueOnce(new Response(
        'Invalid JSON response',
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      ))
      
      // Execute & Assert
      await expect(service.handleRequest(mockClaudeRequest, 'qwen-provider'))
        .rejects.toThrow('Failed to parse JSON')
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

    it('所有请求都应该添加 User-Agent 头', async () => {
      /**
       * 测试场景：验证所有外部 API 请求都包含 User-Agent
       * 验证点：
       * 1. User-Agent 格式为 'Claude-Relay-LLM-Proxy/1.0'
       * 2. 无论供应商类型都会添加
       * 3. 方便 API 提供方识别请求来源
       */
      // Setup
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ choices: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      mockOpenAITransformer.transformResponseIn.mockResolvedValueOnce({ content: [] })
      
      // Execute
      await service.handleRequest(mockClaudeRequest, 'qwen-provider')
      
      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'Claude-Relay-LLM-Proxy/1.0'
          })
        })
      )
    })

    it('应该正确处理 Gemini URL 参数替换', async () => {
      /**
       * 测试场景：Gemini URL 中包含 {{model}} 占位符
       * 验证点：
       * 1. {{model}} 被替换为实际模型名
       * 2. API 密钥作为 key 参数添加到 URL
       * 3. URL 格式符合 Gemini API 要求
       */
      // Setup
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify({ candidates: [] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      mockGeminiTransformer.transformResponseIn.mockResolvedValueOnce({ content: [] })
      
      // Execute
      await service.handleRequest(mockClaudeRequest, 'gemini-provider')
      
      // Assert
      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0]
      expect(url).toContain('/models/gemini-pro:generateContent')
      expect(url).not.toContain('{{model}}')
    })

    it('应该为 Gemini 流式请求使用流式端点', async () => {
      /**
       * 测试场景：Gemini 流式请求需要不同的 API 端点
       * 验证点：
       * 1. 普通请求使用 :generateContent
       * 2. 流式请求使用 :streamGenerateContent
       * 3. URL 替换正确执行
       * 4. 其他参数保持不变
       */
      // Setup
      const streamRequest = { ...mockClaudeRequest, stream: true }
      mockGeminiTransformer.transformRequestOut.mockReturnValueOnce({
        contents: [{ parts: [{ text: 'Hello!' }] }]
      })
      
      mockFetch.mockResolvedValueOnce(new Response(
        JSON.stringify([]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      ))
      
      const mockStream = new ReadableStream()
      mockGeminiTransformer.convertStreamToClaudeFormat.mockResolvedValueOnce(mockStream)
      
      // Execute
      await service.handleRequest(streamRequest, 'gemini-provider')
      
      // Assert
      const fetchCall = mockFetch.mock.calls[0]
      const url = fetchCall[0]
      expect(url).toContain(':streamGenerateContent')
      expect(url).not.toContain(':generateContent?')
    })
  })
})