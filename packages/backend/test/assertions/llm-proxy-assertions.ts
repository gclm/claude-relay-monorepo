import { expect } from 'vitest'
import type { Response } from 'node-fetch'

/**
 * LLM 代理测试断言集合
 * 提供 LLM 代理相关的可复用断言函数
 */
export class LLMProxyAssertions {
  /**
   * 验证 API 请求被正确调用
   */
  static assertApiCall(
    mockFetch: any,
    expectedUrl: string,
    expectedHeaders: Record<string, string>,
    expectedBody?: any
  ) {
    expect(mockFetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining(expectedHeaders),
        ...(expectedBody && { body: JSON.stringify(expectedBody) })
      })
    )
  }

  /**
   * 验证 OpenAI API 调用
   */
  static assertOpenAIApiCall(
    mockFetch: any,
    endpoint: string,
    apiKey: string,
    requestBody: any
  ) {
    this.assertApiCall(
      mockFetch,
      endpoint,
      {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Claude-Relay-LLM-Proxy/1.0'
      },
      requestBody
    )
  }

  /**
   * 验证 Gemini API 调用
   */
  static assertGeminiApiCall(
    mockFetch: any,
    model: string,
    apiKey: string,
    isStream: boolean = false
  ) {
    const fetchCall = mockFetch.mock.calls[0]
    const url: string = fetchCall[0]
    
    // 验证 URL 格式
    expect(url).toContain(`/models/${model}:`)
    expect(url).toContain(isStream ? 'streamGenerateContent' : 'generateContent')
    expect(url).toContain(`key=${apiKey}`)
    expect(url).not.toContain('{{model}}')
    
    // 验证请求头
    expect(fetchCall[1].headers).toMatchObject({
      'Content-Type': 'application/json',
      'User-Agent': 'Claude-Relay-LLM-Proxy/1.0'
    })
  }

  /**
   * 验证流式响应设置
   */
  static assertStreamResponse(response: Response) {
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  }

  /**
   * 验证 JSON 响应
   */
  static async assertJsonResponse(response: Response, expectedData: any) {
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    
    const responseData = await response.json()
    expect(responseData).toEqual(expectedData)
  }

  /**
   * 验证转换器调用
   */
  static assertTransformerCalls(
    transformer: any,
    expectedRequestCall: boolean = true,
    expectedResponseCall: boolean = true,
    expectedStreamCall: boolean = false
  ) {
    if (expectedRequestCall) {
      expect(transformer.transformRequestOut).toHaveBeenCalled()
    }
    
    if (expectedResponseCall) {
      expect(transformer.transformResponseIn).toHaveBeenCalled()
    }
    
    if (expectedStreamCall) {
      expect(transformer.convertStreamToClaudeFormat).toHaveBeenCalled()
    }
  }

  /**
   * 验证 Key Pool 管理调用
   */
  static assertKeyPoolCalls(
    mockKeyPool: any,
    expectedGetKey: boolean = true,
    expectedUpdateStats?: { keyId: string, success: boolean },
    expectedHandleError?: { providerId: string, keyId: string }
  ) {
    if (expectedGetKey) {
      expect(mockKeyPool.getNextKey).toHaveBeenCalled()
    }
    
    if (expectedUpdateStats) {
      expect(mockKeyPool.updateKeyStats).toHaveBeenCalledWith(
        expectedUpdateStats.keyId,
        expectedUpdateStats.success
      )
    }
    
    if (expectedHandleError) {
      expect(mockKeyPool.handleError).toHaveBeenCalledWith(
        expectedHandleError.keyId,
        expect.any(Error)
      )
    }
  }

  /**
   * 验证 KeyPoolManager 错误处理
   */
  static async assertKeyPoolManagerErrorHandling(
    providerId: string,
    keyId: string,
    error?: any
  ) {
    const { KeyPoolManager } = await import('../../src/services/key-pool')
    const keyPoolInstance = (KeyPoolManager as any).mock.results[0].value
    
    expect(keyPoolInstance.handleRequestError).toHaveBeenCalledWith(
      providerId,
      keyId,
      error || expect.any(Error)
    )
  }

  /**
   * 验证供应商注册
   */
  static assertProviderRegistration(
    service: any,
    providerId: string,
    transformer: string
  ) {
    const providers = service.getProviders()
    const transformers = service.getTransformers()
    
    expect(providers).toContain(providerId)
    expect(transformers).toContain(transformer)
  }

  /**
   * 验证错误抛出
   */
  static async assertThrowsError(
    promise: Promise<any>,
    errorMessage: string | RegExp
  ) {
    await expect(promise).rejects.toThrow(errorMessage)
  }

  /**
   * 验证 User-Agent 头
   */
  static assertUserAgentHeader(mockFetch: any) {
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'Claude-Relay-LLM-Proxy/1.0'
        })
      })
    )
  }

  /**
   * 验证响应状态和错误处理
   */
  static async assertApiErrorHandling(
    promise: Promise<any>,
    expectedErrorPattern: string | RegExp,
    expectKeyPoolError?: boolean,
    providerId?: string,
    keyId?: string
  ) {
    await this.assertThrowsError(promise, expectedErrorPattern)
    
    if (expectKeyPoolError && providerId && keyId) {
      await this.assertKeyPoolManagerErrorHandling(providerId, keyId)
    }
  }
}