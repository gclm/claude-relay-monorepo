/**
 * 第三方供应商代理引擎
 * 直接使用转换器的 processRequest 方法，大幅简化架构
 */

import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'
import { ProviderResolver } from './provider-resolver'
import { ResponseWrapper } from './response-wrapper'

export class ProviderEngine {
  private providerResolver: ProviderResolver
  
  constructor(kv: any) {  // 使用 any 避免 KVNamespace 类型错误
    this.providerResolver = new ProviderResolver(kv)
  }
  
  /**
   * 处理请求 - 使用完整的 ProviderResolver
   */
  async processRequest(request: MessageCreateParamsBase): Promise<Response> {
    // 1. 使用 ProviderResolver 解析完整的供应商配置
    const resolution = await this.providerResolver.resolve(request)
    const { provider, selectedModel, apiKey, transformer } = resolution
    
    // 2. 初始化转换器客户端
    if (transformer.initializeClient && apiKey) {
      transformer.initializeClient(apiKey.key)
    }
    
    // 3. 直接调用转换器的 processRequest 方法
    console.log(`🚀 使用新版 ProviderEngine 调用 ${selectedModel} (供应商: ${provider.name})`)
    const result = await transformer.processRequest(request, selectedModel)
    
    // 4. 使用响应包装器包装结果
    return ResponseWrapper.wrap(result)
  }
  
}