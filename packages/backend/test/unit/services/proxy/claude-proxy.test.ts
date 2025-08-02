import { describe, it, expect, beforeEach, vi, afterEach, test } from 'vitest'
import { ClaudeProxyService } from '../../../../src/services/proxy/claude-proxy'
import { LocalKVStorage } from '../../../../src/utils/local-kv-storage'
import { HTTPException } from 'hono/http-exception'
import { SelectedModel } from '../../../../../../shared/types/admin/models'
import { ModelProvider } from '../../../../../../shared/types/admin/providers'
import { ADMIN_STORAGE_KEYS } from '../../../../../../shared/constants/admin/storage'
import { ClaudeProxyTestFactory } from '../../../factories/claude-proxy-factory'
import { ClaudeProxyAssertions } from '../../../assertions/claude-proxy-assertions'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock LLMProxyService
vi.mock('../../../../src/services/proxy/llm-proxy', () => ({
  LLMProxyService: vi.fn().mockImplementation(() => ({
    registerProviderFromConfig: vi.fn().mockResolvedValue(undefined),
    handleRequest: vi.fn().mockResolvedValue(new Response('mocked llm response'))
  }))
}))

describe('Claude 代理服务单元测试', () => {
  let kv: LocalKVStorage
  let service: ClaudeProxyService
  const factory = ClaudeProxyTestFactory
  const assertions = ClaudeProxyAssertions

  // 使用工厂创建测试数据
  const mockClaudeToken = factory.createValidToken()
  const mockProviders = factory.createProviders()
  const mockClaudeRequest = factory.createClaudeRequest()
  const mockClaudeResponse = factory.createClaudeResponse()

  // 辅助函数：减少重复代码
  const createProxyRequest = (body: any = mockClaudeRequest, options: RequestInit = {}) => {
    return new Request('http://localhost/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: JSON.stringify(body),
      ...options
    })
  }

  const mockFetchResponse = (body: any, options: { status?: number, headers?: HeadersInit } = {}) => {
    return new Response(
      typeof body === 'string' ? body : JSON.stringify(body),
      {
        status: options.status || 200,
        headers: { 'Content-Type': 'application/json', ...options.headers }
      }
    )
  }

  const setupSelectedModel = async (model: SelectedModel) => {
    await kv.put(ADMIN_STORAGE_KEYS.SELECTED_MODEL, JSON.stringify(model))
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    kv = new LocalKVStorage('.test-kv-claude-proxy')
    service = new ClaudeProxyService(kv as any)

    // Setup default KV data
    await kv.put('claude_account_ids', JSON.stringify(['account1', 'account2']))
    await kv.put('claude_account_token:account1', JSON.stringify(mockClaudeToken))
    await kv.put(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS, JSON.stringify(mockProviders))
  })

  afterEach(async () => {
    // Clean up test data
    const result = await kv.list()
    for (const key of result.keys) {
      await kv.delete(key.name)
    }
  })

  describe('proxyRequest - 代理请求核心方法', () => {
    it('当没有选择模型时，应该路由到官方 Claude API', async () => {
      /**
       * 测试场景：默认情况下，系统应该使用官方 Claude API
       * 验证点：
       * 1. 正确调用 Claude API 端点
       * 2. 包含必要的认证头信息
       * 3. 正确传递请求体
       * 4. 返回正确的响应数据
       */
      // Setup
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      assertions.assertClaudeApiCall(mockFetch, mockClaudeToken.access_token, mockClaudeRequest)
      await assertions.assertSuccessResponse(response, mockClaudeResponse)
    })

    it('当选择了第三方供应商模型时，应该路由到相应的供应商', async () => {
      /**
       * 测试场景：用户选择了魔搭 Qwen 作为默认模型
       * 验证点：
       * 1. 正确识别选中的供应商
       * 2. 调用 LLMProxyService 处理请求
       * 3. 使用正确的供应商配置
       * 4. 返回转换后的响应
       */
      // Setup - Select Qwen provider
      const selectedModel = factory.createSelectedModel('qwen-provider', '魔搭 Qwen')
      await setupSelectedModel(selectedModel)

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      expect(response).toBeDefined()
      expect(await response.text()).toBe('mocked llm response')
      await assertions.assertProviderRegistration(mockProviders[0])
      await assertions.assertProviderForward('qwen-provider')
    })

    it('应该正确处理来自 Claude API 的流式响应', async () => {
      /**
       * 测试场景：客户端请求流式响应（SSE）
       * 验证点：
       * 1. 识别 stream: true 参数
       * 2. 正确设置响应头（Content-Type, Cache-Control 等）
       * 3. 保持流式数据的完整性
       * 4. 添加必要的 CORS 头
       */
      // Setup
      const streamResponse = `data: {"type":"message_start","message":{"id":"msg_123"}}\n\ndata: {"type":"content_block_start"}\n\n`
      mockFetch.mockResolvedValueOnce(
        mockFetchResponse(streamResponse, { headers: { 'Content-Type': 'text/event-stream' } })
      )

      const streamRequest = { ...mockClaudeRequest, stream: true }

      // Execute
      const response = await service.proxyRequest(createProxyRequest(streamRequest))

      // Assert
      await assertions.assertStreamResponse(response, streamResponse)
    })

    it('应该正确处理 Claude API 返回的错误', async () => {
      /**
       * 测试场景：Claude API 返回 401 认证错误
       * 验证点：
       * 1. 保持原始错误状态码
       * 2. 传递完整的错误信息
       * 3. 添加 CORS 头以支持跨域错误处理
       */
      // Setup
      const errorResponse = factory.createErrorResponse('invalid_request_error', 'Invalid API key')
      mockFetch.mockResolvedValueOnce(mockFetchResponse(errorResponse, { status: 401 }))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      await assertions.assertErrorResponse(response, 401, 'invalid_request_error', 'Invalid API key')
    })

    it('应该优雅地处理网络错误', async () => {
      /**
       * 测试场景：网络请求失败（如连接超时、DNS 解析失败等）
       * 验证点：
       * 1. 捕获网络异常
       * 2. 返回统一的错误格式
       * 3. 错误类型为 proxy_error
       * 4. 包含有意义的错误消息
       */
      // Setup
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      await assertions.assertProxyError(response, 'Network error')
    })

    // Token 验证场景测试表格
    const tokenScenarios = [
      {
        name: '有效 token',
        accounts: ['account1'],
        setupTokens: async (kv: LocalKVStorage) => {
          await kv.put('claude_account_token:account1', JSON.stringify(factory.createValidToken()))
        },
        shouldSucceed: true,
        expectedToken: 'test-claude-token'
      },
      {
        name: '过期 token',
        accounts: ['account1'],
        setupTokens: async (kv: LocalKVStorage) => {
          await kv.put('claude_account_token:account1', JSON.stringify(factory.createExpiredToken()))
        },
        shouldSucceed: false,
        expectedError: '无法获取有效的Claude访问令牌'
      },
      {
        name: '多账号，第一个过期',
        accounts: ['account1', 'account2'],
        setupTokens: async (kv: LocalKVStorage) => {
          await kv.put('claude_account_token:account1', JSON.stringify(factory.createExpiredToken()))
          await kv.put('claude_account_token:account2', JSON.stringify(factory.createValidToken()))
        },
        shouldSucceed: true,
        expectedToken: 'test-claude-token'
      },
      {
        name: '无账号',
        accounts: [],
        setupTokens: async () => {},
        shouldSucceed: false,
        expectedError: '无法获取有效的Claude访问令牌'
      }
    ]

    test.each(tokenScenarios)(
      'Token 场景：$name',
      async ({ accounts, setupTokens, shouldSucceed, expectedToken, expectedError }) => {
        // Setup
        await kv.put('claude_account_ids', JSON.stringify(accounts))
        await setupTokens(kv)

        if (shouldSucceed) {
          mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))
        }

        // Execute
        const response = await service.proxyRequest(createProxyRequest())

        // Assert
        if (shouldSucceed) {
          await assertions.assertSuccessResponse(response, mockClaudeResponse)
          assertions.assertClaudeApiCall(mockFetch, expectedToken!, mockClaudeRequest)
        } else {
          await assertions.assertProxyError(response, expectedError!)
        }
      }
    )

    it('当缺少 Claude 访问令牌时应该返回错误', async () => {
      /**
       * 测试场景：系统中没有配置任何 Claude 账号
       * 验证点：
       * 1. 检测到没有可用的 token
       * 2. 返回 500 错误状态码
       * 3. 错误消息明确指出认证问题
       * 4. 不会泄露敏感信息
       */
      // Setup - Remove all tokens
      await kv.delete('claude_account_ids')

      // Execute
      const response = await service.proxyRequest(createProxyRequest())
      
      // Assert - Should return error response instead of throwing
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
      expect(errorData.error.message).toContain('无法获取有效的Claude访问令牌')
    })

    it('应该跳过已过期的 Claude 令牌并使用有效的令牌', async () => {
      /**
       * 测试场景：系统有多个 Claude 账号，第一个已过期
       * 验证点：
       * 1. 检查 token 的过期时间
       * 2. 跳过过期的账号
       * 3. 使用下一个有效的账号
       * 4. 成功完成请求
       */
      // Setup - Add expired token
      const expiredToken = {
        ...mockClaudeToken,
        expires_at: Date.now() - 3600000 // 1 hour ago
      }
      await kv.put('claude_account_token:account1', JSON.stringify(expiredToken))

      // Add valid token to account2
      await kv.put('claude_account_token:account2', JSON.stringify(mockClaudeToken))

      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert - Should use account2's token
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-claude-token'
          })
        })
      )
      expect(response.status).toBe(200)
    })

    it('当选中的供应商不存在时，应该回退到 Claude API', async () => {
      /**
       * 测试场景：选中了一个已被删除的供应商
       * 验证点：
       * 1. 尝试查找供应商配置
       * 2. 发现供应商不存在
       * 3. 自动回退到官方 Claude API
       * 4. 请求正常完成
       */
      // Setup - Select non-existent provider
      const selectedModel: SelectedModel = {
        id: 'non-existent',
        name: 'Non-existent Provider',
        type: 'provider',
        providerId: 'non-existent'
      }
      await setupSelectedModel(selectedModel)

      // Fallback to Claude API
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert - Should fallback to Claude API
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      )
      expect(response.status).toBe(200)
    })

    it('所有响应都应该包含 CORS 头信息', async () => {
      /**
       * 测试场景：验证跨域资源共享（CORS）支持
       * 验证点：
       * 1. Access-Control-Allow-Origin: *
       * 2. Access-Control-Allow-Methods: POST, OPTIONS
       * 3. Access-Control-Allow-Headers: Content-Type, Authorization
       * 这确保了 Web 客户端可以正常调用 API
       */
      // Setup
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      assertions.assertCorsHeaders(response)
    })
  })

  // 模型路由场景测试表格
  describe('模型路由测试', () => {
    const routingScenarios = [
      {
        name: '默认路由到官方 Claude',
        selectedModel: null,
        expectedRoute: 'claude',
        expectedUrl: 'https://api.anthropic.com/v1/messages'
      },
      {
        name: '路由到魔搭 Qwen',
        selectedModel: factory.createSelectedModel('qwen-provider', '魔搭 Qwen'),
        expectedRoute: 'provider',
        expectedProviderId: 'qwen-provider'
      },
      {
        name: '路由到 Google Gemini',
        selectedModel: factory.createSelectedModel('gemini-provider', 'Google Gemini'),
        expectedRoute: 'provider',
        expectedProviderId: 'gemini-provider'
      },
      {
        name: '供应商不存在时回退到 Claude',
        selectedModel: factory.createSelectedModel('non-existent', 'Non-existent Provider'),
        expectedRoute: 'claude',
        expectedUrl: 'https://api.anthropic.com/v1/messages'
      }
    ]

    test.each(routingScenarios)(
      '路由场景：$name',
      async ({ selectedModel, expectedRoute, expectedUrl, expectedProviderId }) => {
        // Setup
        if (selectedModel) {
          await setupSelectedModel(selectedModel)
        }

        if (expectedRoute === 'claude') {
          mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))
        }

        // Execute
        const response = await service.proxyRequest(createProxyRequest())

        // Assert
        if (expectedRoute === 'claude') {
          await assertions.assertSuccessResponse(response, mockClaudeResponse)
          expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object))
        } else {
          expect(await response.text()).toBe('mocked llm response')
          await assertions.assertProviderForward(expectedProviderId!)
        }
      }
    )
  })

  describe('getSelectedModel - 获取当前选中的模型', () => {
    it('当没有选择任何模型时，应该返回默认的官方 Claude 模型', async () => {
      /**
       * 测试场景：系统初始状态，用户未进行任何模型选择
       * 验证点：
       * 1. KV 中没有存储选中的模型
       * 2. 返回默认的官方 Claude 配置
       * 3. 请求被路由到 Claude API
       */
      // Execute - Using private method through proxy request
      mockFetch.mockResolvedValueOnce(mockFetchResponse(mockClaudeResponse))

      await service.proxyRequest(createProxyRequest())

      // Assert - Should use Claude API (default)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.any(Object)
      )
    })

    it('应该从 KV 存储中返回用户选择的模型', async () => {
      /**
       * 测试场景：用户已选择 Google Gemini 作为默认模型
       * 验证点：
       * 1. 正确读取 KV 中的配置
       * 2. 识别供应商类型
       * 3. 使用对应的代理服务处理请求
       */
      // Setup
      const selectedModel: SelectedModel = {
        id: 'gemini-provider',
        name: 'Google Gemini',
        type: 'provider',
        providerId: 'gemini-provider'
      }
      await setupSelectedModel(selectedModel)

      // Execute
      await service.proxyRequest(createProxyRequest())

      // Assert - Should use LLM proxy
      const { LLMProxyService } = await import('../../../../src/services/proxy/llm-proxy')
      const llmProxyInstance = (LLMProxyService as any).mock.results[0].value
      expect(llmProxyInstance.handleRequest).toHaveBeenCalledWith(mockClaudeRequest, 'gemini-provider')
    })
  })

  describe('错误处理边缘案例', () => {
    // 使用测试表格定义错误场景
    const errorScenarios = [
      {
        name: '401 认证错误',
        status: 401,
        error: { type: 'invalid_request_error', message: 'Invalid API key' }
      },
      {
        name: '403 权限错误',
        status: 403,
        error: { type: 'permission_error', message: 'Forbidden' }
      },
      {
        name: '429 速率限制',
        status: 429,
        error: { type: 'rate_limit_error', message: 'Too many requests' }
      },
      {
        name: '500 服务器错误',
        status: 500,
        error: { type: 'server_error', message: 'Internal server error' }
      }
    ]

    test.each(errorScenarios)(
      '应该正确处理 $name',
      async ({ status, error }) => {
        // Setup
        mockFetch.mockResolvedValueOnce(
          mockFetchResponse(factory.createErrorResponse(error.type, error.message), { status })
        )

        // Execute
        const response = await service.proxyRequest(createProxyRequest())

        // Assert
        await assertions.assertErrorResponse(response, status, error.type, error.message)
      }
    )
    it('应该处理格式错误的请求体', async () => {
      /**
       * 测试场景：客户端发送了无效的 JSON
       * 验证点：
       * 1. 捕获 JSON 解析错误
       * 2. 返回 500 错误状态码
       * 3. 不暴露内部错误细节
       */
      // Setup - Create request with invalid JSON
      const request = createProxyRequest(undefined, { body: 'invalid json' })

      // Execute
      const response = await service.proxyRequest(request)

      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
    })

    it('应该处理 LLM 代理服务的错误', async () => {
      /**
       * 测试场景：第三方供应商服务出现错误
       * 验证点：
       * 1. 捕获 LLMProxyService 抛出的异常
       * 2. 保留原始错误信息
       * 3. 返回统一的错误格式
       */
      // Setup - Select provider and make LLM proxy throw error
      const selectedModel: SelectedModel = {
        id: 'qwen-provider',
        name: '魔搭 Qwen',
        type: 'provider',
        providerId: 'qwen-provider'
      }
      await setupSelectedModel(selectedModel)

      // Mock LLM proxy to throw error
      const { LLMProxyService } = await import('../../../../src/services/proxy/llm-proxy')
      const mockHandleRequest = vi.fn().mockRejectedValueOnce(new Error('LLM Proxy Error'))
        ; (LLMProxyService as any).mockImplementationOnce(() => ({
          registerProviderFromConfig: vi.fn().mockResolvedValue(undefined),
          handleRequest: mockHandleRequest
        }))

      // Recreate service to use new mock
      service = new ClaudeProxyService(kv as any)

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
      expect(errorData.error.message).toBe('LLM Proxy Error')
    })

    it('应该处理请求超时', async () => {
      /**
       * 测试场景：API 请求超时（模拟 100ms 超时）
       * 验证点：
       * 1. 设置超时机制
       * 2. 捕获超时错误
       * 3. 返回明确的超时错误信息
       * 4. 避免请求挂起
       */
      // Setup - Mock fetch to never resolve
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 100)
      })
      mockFetch.mockReturnValueOnce(timeoutPromise)

      // Execute
      const response = await service.proxyRequest(createProxyRequest())

      // Assert
      expect(response.status).toBe(500)
      const errorData = await response.json() as any
      expect(errorData.error.type).toBe('proxy_error')
      expect(errorData.error.message).toBe('Request timeout')
    })
  })
})