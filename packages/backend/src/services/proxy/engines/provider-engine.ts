/**
 * 第三方供应商 Engine - Context 模式版本
 */

import type { Engine, RequestContext } from './types'
import type { ClaudeRequest } from '../../../types/proxy/claude'
import { ProviderResolver } from './provider-resolver'
import { RequestExecutor } from './request-executor'
import { ResponseHandler } from './response-handler'
import { HTTPException } from 'hono/http-exception'

export class ProviderEngine implements Engine {
  private providerResolver: ProviderResolver
  private requestExecutor: RequestExecutor
  private responseHandler: ResponseHandler
  
  constructor(private kv: KVNamespace) {
    // 初始化业务服务
    this.providerResolver = new ProviderResolver(kv)
    this.requestExecutor = new RequestExecutor()
    this.responseHandler = new ResponseHandler()
  }
  
  async processRequest(request: ClaudeRequest): Promise<Response> {
    const context: RequestContext = {
      originalRequest: request,
      requestId: crypto.randomUUID(),
      errors: []
    }
    
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
    
    // 3. 处理响应（包括状态检查）
    if (!response.ok) {
      throw new HTTPException(response.status as any, { 
        message: `Provider API error: ${response.statusText}` 
      })
    }
    
    const processedResponse = await this.responseHandler.handle(context)
    context.processedResponse = processedResponse
    
    return processedResponse
  }
  
  
}