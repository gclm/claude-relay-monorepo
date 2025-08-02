import { expect } from 'vitest'
import type { Response } from 'node-fetch'

/**
 * Claude 代理测试断言集合
 * 提供可复用的断言函数，减少重复代码
 */
export class ClaudeProxyAssertions {
  /**
   * 验证 CORS 头信息
   */
  static assertCorsHeaders(response: Response) {
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
  }

  /**
   * 验证流式响应头
   */
  static assertStreamHeaders(response: Response) {
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('X-Accel-Buffering')).toBe('no')
    // 流式响应也应该有 CORS 头
    this.assertCorsHeaders(response)
  }

  /**
   * 验证成功响应
   */
  static async assertSuccessResponse(response: Response, expectedData: any) {
    expect(response.status).toBe(200)
    const responseData = await response.json()
    expect(responseData).toEqual(expectedData)
    this.assertCorsHeaders(response)
  }

  /**
   * 验证错误响应
   */
  static async assertErrorResponse(
    response: Response, 
    expectedStatus: number, 
    expectedErrorType: string,
    expectedErrorMessage?: string
  ) {
    expect(response.status).toBe(expectedStatus)
    const errorData = await response.json() as any
    expect(errorData.error.type).toBe(expectedErrorType)
    if (expectedErrorMessage) {
      expect(errorData.error.message).toContain(expectedErrorMessage)
    }
    this.assertCorsHeaders(response) // 错误响应也应该有 CORS
  }

  /**
   * 验证 Claude API 调用
   */
  static assertClaudeApiCall(mockFetch: any, expectedToken: string, expectedBody: any) {
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${expectedToken}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        }),
        body: JSON.stringify(expectedBody)
      })
    )
  }

  /**
   * 验证请求被转发到第三方供应商
   */
  static async assertProviderForward(providerId: string) {
    const { LLMProxyService } = await import('../../src/services/proxy/llm-proxy')
    const llmProxyInstance = (LLMProxyService as any).mock.results[0].value
    expect(llmProxyInstance.handleRequest).toHaveBeenCalledWith(
      expect.any(Object),
      providerId
    )
  }

  /**
   * 验证供应商注册
   */
  static async assertProviderRegistration(expectedProvider: any) {
    const { LLMProxyService } = await import('../../src/services/proxy/llm-proxy')
    const llmProxyInstance = (LLMProxyService as any).mock.results[0].value
    expect(llmProxyInstance.registerProviderFromConfig).toHaveBeenCalledWith(expectedProvider)
  }

  /**
   * 验证流式响应内容
   */
  static async assertStreamResponse(response: Response, expectedContent: string) {
    this.assertStreamHeaders(response)
    const responseText = await response.text()
    expect(responseText).toBe(expectedContent)
  }

  /**
   * 验证代理错误
   */
  static async assertProxyError(response: Response, errorMessage: string) {
    await this.assertErrorResponse(response, 500, 'proxy_error', errorMessage)
  }
}