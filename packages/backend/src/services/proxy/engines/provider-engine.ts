/**
 * 第三方供应商 Engine - Context 模式版本
 */

import type { Engine, RequestContext } from './types'
import type { ClaudeRequest } from '../../../types/proxy/claude'
import { ProviderResolver } from './provider-resolver'
import { RequestExecutor } from './request-executor'
import { ResponseHandler } from './response-handler'
import { KeyPoolManager } from '../../key-pool'

export class ProviderEngine implements Engine {
  private providerResolver: ProviderResolver
  private requestExecutor: RequestExecutor
  private responseHandler: ResponseHandler
  private keyPoolManager: KeyPoolManager
  
  constructor(private kv: KVNamespace) {
    // 初始化业务服务
    this.providerResolver = new ProviderResolver(kv)
    this.requestExecutor = new RequestExecutor()
    this.responseHandler = new ResponseHandler()
    
    // 使用 ProviderResolver 中的 KeyPoolManager 实例，确保状态一致
    this.keyPoolManager = this.providerResolver.getKeyPoolManager()
  }
  
  async processRequest(request: ClaudeRequest): Promise<Response> {
    const context: RequestContext = {
      originalRequest: request,
      requestId: crypto.randomUUID(),
      errors: []
    }
    
    let requestSent = false
    
    try {
      // 1. 解析 Provider（使用解构赋值更新 context）
      const resolution = await this.providerResolver.resolve(request)
      const { provider, selectedModel, apiKey, routeConfig, transformer } = resolution
      
      context.provider = provider
      context.selectedModel = selectedModel
      context.apiKey = apiKey
      context.routeConfig = routeConfig
      context.transformer = transformer
      
      // 2. 执行请求
      const response = await this.requestExecutor.execute(context)
      context.rawResponse = response
      requestSent = true  // 标记请求已发送
      
      // 3. 处理响应（包括状态检查）
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const processedResponse = await this.responseHandler.handle(context)
      context.processedResponse = processedResponse
      
      // 4. 更新密钥统计（成功情况）
      if (context.provider && context.apiKey) {
        await this.keyPoolManager.recordSuccess(
          context.provider.id,
          context.provider.type as 'openai' | 'gemini',
          context.apiKey.id
        )
      }
      
      return processedResponse
      
    } catch (error) {
      context.errors.push(error as Error)
      
      // 只有在请求已发送的情况下才更新密钥统计
      if (requestSent && context.provider && context.apiKey) {
        await this.keyPoolManager.recordFailure(
          context.provider.id,
          context.apiKey.id,
          error as Error
        )
      }
      
      return this.createErrorResponse(error)
    }
  }
  
  /**
   * 创建错误响应
   */
  private createErrorResponse(error: any): Response {
    console.error('Provider engine error:', error)
    
    return new Response(JSON.stringify({
      error: {
        type: 'proxy_error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  }
  
}