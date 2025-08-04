/**
 * Claude API 代理服务 - Engine 架构版本
 */

import type { ClaudeRequest } from '../../types/proxy/claude'
import type { SelectedConfig } from './engines/types'
import { ClaudeEngine, ProviderEngine } from './engines'
import { RouteConfigRepository } from '../../repositories'
import { ValidationError } from '../../utils/errors'

export class ClaudeProxyService {
  private claudeEngine: ClaudeEngine
  private providerEngine: ProviderEngine
  private routeConfigRepo: RouteConfigRepository
  
  constructor(private kv: KVNamespace) {
    this.claudeEngine = new ClaudeEngine(kv)
    this.providerEngine = new ProviderEngine(kv)
    this.routeConfigRepo = new RouteConfigRepository(kv)
  }
  
  /**
   * 代理请求到适当的 API 端点
   */
  async proxyRequest(request: Request): Promise<Response> {
    // 解析请求
    const claudeRequest = await request.json() as ClaudeRequest
    
    // 获取选择的配置
    const selectedConfig = await this.routeConfigRepo.getSelectedConfig()
    if (!selectedConfig) {
      // 默认使用 Claude
      return await this.claudeEngine.processRequest(claudeRequest)
    }
    
    // 根据配置类型选择引擎
    if (selectedConfig.type === 'claude') {
      return await this.claudeEngine.processRequest(claudeRequest)
    } else if (selectedConfig.type === 'route') {
      return await this.providerEngine.processRequest(claudeRequest)
    } else {
      throw new ValidationError(`Unknown configuration type: ${selectedConfig.type}`)
    }
  }
}