/**
 * 请求执行器
 * 负责转换请求、构建 HTTP 请求并发送
 */

import type { RequestContext } from './types'
import type { ModelProvider } from '../../../../../../shared/types/admin/providers'

export class RequestExecutor {
  /**
   * 执行请求
   * 包括：转换请求格式、构建 HTTP 请求、发送请求到供应商 API
   */
  async execute(context: RequestContext): Promise<Response> {
    const { originalRequest, provider, apiKey, selectedModel, transformer } = context
    
    if (!transformer || !selectedModel || !provider || !apiKey) {
      throw new Error('Required context properties not available')
    }
    
    // 1. 转换请求格式（Claude -> Provider 格式）
    const updatedRequest = {
      ...originalRequest,
      model: selectedModel
    }
    
    const transformedRequest = transformer.transformRequest(updatedRequest)
    
    // 特殊处理：非 Gemini 供应商需要设置模型
    const isGemini = transformer.constructor.name === 'ClaudeToGeminiTransformer'
    if (!isGemini) {
      transformedRequest.model = provider.model
    }
    context.transformedRequest = transformedRequest
    
    // 2. 构建 HTTP 请求
    const url = this.buildRequestUrl(provider, apiKey.key, originalRequest.stream)
    const headers = this.buildRequestHeaders(provider, apiKey.key)
    
    // 3. 发送请求
    return await this.sendHttpRequest(url, headers, transformedRequest)
  }
  
  /**
   * 构建请求 URL
   */
  private buildRequestUrl(provider: ModelProvider, apiKey: string, isStream?: boolean): string {
    const isGemini = provider.transformer === 'claude-to-gemini'
    
    let url = provider.endpoint
    
    if (isGemini) {
      // 替换模型占位符
      url = url.replace('{{model}}', provider.model)
      
      // 添加 API Key 参数
      const urlObj = new URL(url)
      urlObj.searchParams.append('key', apiKey)
      
      // 流式请求需要修改端点
      if (isStream) {
        url = urlObj.toString().replace(':generateContent', ':streamGenerateContent')
      } else {
        url = urlObj.toString()
      }
    }
    
    return url
  }
  
  /**
   * 构建请求头
   */
  private buildRequestHeaders(provider: ModelProvider, apiKey: string): Record<string, string> {
    const isGemini = provider.transformer === 'claude-to-gemini'
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Claude-Relay/1.0'
    }
    
    // 非 Gemini API 需要 Authorization 头
    if (!isGemini) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }
    
    return headers
  }
  
  /**
   * 发送 HTTP 请求
   */
  private async sendHttpRequest(
    url: string,
    headers: Record<string, string>,
    body: any
  ): Promise<Response> {
    return await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
  }
}