/**
 * Provider 解析器
 * 负责加载路由配置、选择模型、加载供应商、获取 API Key 和转换器
 */

import type { ClaudeRequest } from '../../../types/proxy/claude'
import type { ProviderResolution } from './types'
import { RouteConfigRepository, ProviderRepository } from '../../../repositories'
import { ModelRouterService } from './model-router'
import { KeyPoolManager } from '../../key-pool'
import { transformerRegistry } from '../transformers'

export class ProviderResolver {
  private routeConfigRepo: RouteConfigRepository
  private modelRouter: ModelRouterService
  private providerRepo: ProviderRepository
  private keyPoolManager: KeyPoolManager
  
  constructor(kv: KVNamespace) {
    this.routeConfigRepo = new RouteConfigRepository(kv)
    this.modelRouter = new ModelRouterService()
    this.providerRepo = new ProviderRepository(kv)
    this.keyPoolManager = new KeyPoolManager(kv)
  }
  
  /**
   * 解析请求，返回所有必要的 Provider 相关资源
   */
  async resolve(request: ClaudeRequest): Promise<ProviderResolution> {
    // 1. 加载路由配置
    const routeConfig = await this.routeConfigRepo.getActiveRouteConfig()
    if (!routeConfig) {
      throw new Error('No active route configuration found')
    }
    
    // 2. 根据请求内容选择合适的模型
    const target = await this.modelRouter.selectModel(request, routeConfig)
    
    // 3. 加载对应的供应商配置
    const provider = await this.providerRepo.getById(target.providerId)
    if (!provider) {
      throw new Error(`Provider ${target.providerId} not found`)
    }
    
    // 4. 从密钥池获取可用的 API Key
    const keyPool = await this.keyPoolManager.getOrCreatePool(
      provider.id, 
      provider.type
    )
    const apiKey = await keyPool.getNextKey()
    if (!apiKey) {
      throw new Error('No available API keys')
    }
    
    // 5. 获取转换器（作为供应商配置的一部分）
    const transformer = transformerRegistry.get(provider.transformer || '')
    
    return {
      provider,
      selectedModel: target.model,
      apiKey,
      routeConfig,
      transformer
    }
  }
  
  /**
   * 获取 KeyPoolManager 实例
   * 用于与其他服务共享
   */
  getKeyPoolManager(): KeyPoolManager {
    return this.keyPoolManager
  }
}