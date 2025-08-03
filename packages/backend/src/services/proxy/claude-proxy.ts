/**
 * Claude API 代理服务 - Engine 架构版本
 */

import type { ClaudeRequest } from '../../types/proxy/claude'
import type { SelectedConfig } from './engines/types'
import { ClaudeEngine, ProviderEngine } from './engines'
import { RouteConfigRepository } from '../../repositories'

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
    try {
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
        throw new Error(`Unknown configuration type: ${selectedConfig.type}`)
      }
      
    } catch (error) {
      console.error('Proxy request failed:', error)
      
      return new Response(JSON.stringify({
        error: {
          type: 'proxy_error',
          message: error instanceof Error ? error.message : 'Proxy request failed'
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
  
  /**
   * 清理资源
   */
  destroy() {
    // 目前 ProviderEngine 没有需要清理的资源
    // 如果未来需要清理，可以在这里添加
  }
}