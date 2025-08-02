/**
 * 集成测试通用断言函数
 * 用于验证集成测试中的常见行为模式
 */
export class IntegrationAssertions {
  /**
   * 验证代理响应头
   */
  static assertProxyHeaders(response: Response) {
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    
    if (response.headers.get('Content-Type')?.includes('event-stream')) {
      expect(response.headers.get('Cache-Control')).toBe('no-cache')
    }
  }

  /**
   * 验证 API 调用参数
   */
  static assertApiCall(
    mockFetch: any,
    expectedUrl: string,
    expectedAuth: string,
    expectedMethod: string = 'POST'
  ) {
    expect(mockFetch).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: expectedMethod,
        headers: expect.objectContaining({
          'Authorization': expectedAuth
        })
      })
    )
  }

  /**
   * 验证 Claude API 调用
   */
  static assertClaudeApiCall(mockFetch: any, token: string) {
    this.assertApiCall(
      mockFetch,
      'https://api.anthropic.com/v1/messages',
      `Bearer ${token}`
    )
    
    // 验证 Claude 特有的头信息
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'anthropic-version': '2023-06-01'
        })
      })
    )
  }

  /**
   * 验证 OpenAI 兼容 API 调用
   */
  static assertOpenAIApiCall(mockFetch: any, endpoint: string, apiKey: string) {
    this.assertApiCall(mockFetch, endpoint, `Bearer ${apiKey}`)
  }

  /**
   * 验证 Gemini API 调用
   */
  static assertGeminiApiCall(mockFetch: any, model: string, apiKey: string, isStream: boolean = false) {
    const expectedEndpoint = isStream
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
    
    expect(mockFetch).toHaveBeenCalledWith(
      `${expectedEndpoint}?key=${apiKey}`,
      expect.objectContaining({
        method: 'POST'
      })
    )
  }

  /**
   * 验证成功的响应格式
   */
  static assertSuccessResponse(response: Response, expectedStatus: number = 200) {
    expect(response.status).toBe(expectedStatus)
    this.assertProxyHeaders(response)
  }

  /**
   * 验证错误响应格式
   */
  static assertErrorResponse(
    response: Response,
    expectedStatus: number,
    expectedErrorType: string,
    expectedMessagePattern?: string | RegExp
  ) {
    expect(response.status).toBe(expectedStatus)
    this.assertProxyHeaders(response)
    
    return response.json().then((data: any) => {
      expect(data.error).toBeDefined()
      expect(data.error.type).toBe(expectedErrorType)
      
      if (expectedMessagePattern) {
        if (typeof expectedMessagePattern === 'string') {
          expect(data.error.message).toContain(expectedMessagePattern)
        } else {
          expect(data.error.message).toMatch(expectedMessagePattern)
        }
      }
      
      return data
    })
  }

  /**
   * 验证 Claude 格式的响应
   */
  static assertClaudeFormatResponse(responseData: any) {
    expect(responseData.type).toBe('message')
    expect(responseData.role).toBe('assistant')
    expect(responseData.content).toBeInstanceOf(Array)
    expect(responseData.content.length).toBeGreaterThan(0)
    expect(responseData.content[0]).toHaveProperty('type', 'text')
    expect(responseData.content[0]).toHaveProperty('text')
  }

  /**
   * 验证流式响应格式
   */
  static assertStreamResponse(response: Response) {
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    this.assertProxyHeaders(response)
  }

  /**
   * 验证 CORS 预检响应
   */
  static assertCorsPreflightResponse(response: Response) {
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
  }

  /**
   * 验证健康检查响应
   */
  static assertHealthResponse(responseData: any) {
    expect(responseData.status).toBe('ok')
    expect(responseData.service).toBe('Claude API Proxy')
    expect(responseData.timestamp).toBeDefined()
    
    // 验证时间戳格式
    const timestamp = new Date(responseData.timestamp)
    expect(timestamp.getTime()).toBeGreaterThan(0)
  }
}