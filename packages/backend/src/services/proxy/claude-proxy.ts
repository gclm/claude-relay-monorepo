/**
 * Claude API 代理服务 - 精简版
 * 支持官方Claude API和魔搭Qwen模型的智能路由
 */

import { ModelProvider } from '../../../../../shared/types/admin/providers'
import { SelectedModel } from '../../../../../shared/types/admin/models'
import { ADMIN_STORAGE_KEYS, getProviderStorageKey } from '../../../../../shared/constants/admin/storage'
import { HTTPException } from 'hono/http-exception'
import { LLMProxyService } from './llm-proxy'

import { ClaudeToken } from '../../types/proxy'

export class ClaudeProxyService {
  private llmProxy: LLMProxyService

  constructor(private kv: KVNamespace) {
    this.llmProxy = new LLMProxyService(kv)
  }

  /**
   * 代理请求到适当的API端点
   */
  async proxyRequest(request: Request): Promise<Response> {
    try {
      // 获取当前选中的模型
      const selectedModel = await this.getSelectedModel()
      
      if (selectedModel.type === 'provider' && selectedModel.providerId) {
        // 使用第三方供应商
        const provider = await this.getProvider(selectedModel.providerId)
        if (provider) {
          return await this.forwardToProvider(request, provider)
        }
      }
      
      // 使用官方Claude API
      return await this.forwardToClaude(request)
      
    } catch (error) {
      console.error('代理请求失败:', error)
      return new Response(JSON.stringify({
        error: {
          type: 'proxy_error',
          message: error instanceof Error ? error.message : '代理请求失败'
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  /**
   * 转发请求到官方Claude API - 简化版
   */
  private async forwardToClaude(request: Request): Promise<Response> {
    try {
      // 获取有效的Claude token
      const token = await this.getValidClaudeToken()
      if (!token) {
        throw new HTTPException(401, { message: '无法获取有效的Claude访问令牌，请设置Claude认证' })
      }

      // 获取请求体并转发到 Claude API
      const requestBody = await request.json() as any
      const isStream = requestBody.stream === true
      
      console.log(`🚀 官方Claude API: ${isStream ? '🌊' : '📄'}, ${JSON.stringify(requestBody).length}B`)

      const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14'
        },
        body: JSON.stringify(requestBody)
      })

      const responseContentType = claudeResponse.headers.get('Content-Type')
      const isStreamResponse = responseContentType?.includes('text/event-stream')
      
      console.log(`📡 官方Claude响应: ${claudeResponse.status}, ${isStreamResponse ? '🌊' : '📄'}`)

      if (!claudeResponse.ok) {
        const errorText = await claudeResponse.text()
        console.error(`❌ 官方Claude请求失败: ${claudeResponse.status}`)
        
        return new Response(errorText, {
          status: claudeResponse.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })
      }

      // 直接转发响应体（支持流式和非流式）
      return new Response(claudeResponse.body, {
        status: claudeResponse.status,
        headers: {
          'Content-Type': responseContentType || 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          ...(isStreamResponse && {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
          })
        }
      })

    } catch (error) {
      console.error('官方Claude API转发失败:', error)
      throw error
    }
  }

  /**
   * 转发请求到第三方LLM提供商 - 使用LLM代理服务
   */
  private async forwardToProvider(request: Request, provider: ModelProvider): Promise<Response> {
    try {
      const claudeRequest = await request.json() as any
      
      console.log(`🚀 转发到${provider.name}: ${claudeRequest.stream ? '🌊' : '📄'}`)

      // 动态注册供应商到 llmProxy
      await this.llmProxy.registerProviderFromConfig(provider)
      
      // 使用provider.id作为providerType，确保与注册时一致
      return await this.llmProxy.handleRequest(claudeRequest, provider.id)

    } catch (error) {
      console.error(`${provider.name} API转发失败:`, error)
      throw error
    }
  }

  // 移除getProviderType方法，改用provider.id直接作为类型标识


  /**
   * 获取有效的Claude访问令牌
   * 使用admin.ts中的多账号token管理
   */
  private async getValidClaudeToken(): Promise<ClaudeToken | null> {
    try {
      // 获取所有Claude账号
      const accountIdsData = await this.kv.get('claude_account_ids')
      if (!accountIdsData) return null

      const accountIds: string[] = JSON.parse(accountIdsData)
      
      // 找到第一个有效的token
      for (const accountId of accountIds) {
        const tokenData = await this.kv.get(`claude_account_token:${accountId}`)
        if (!tokenData) continue

        const token: ClaudeToken = JSON.parse(tokenData)
        
        // 检查token是否过期
        if (Date.now() > token.expires_at) {
          console.log(`Claude账号 ${accountId} token已过期`)
          continue
        }

        console.log(`使用Claude账号 ${accountId} 的token`)
        return token
      }

      console.log('未找到有效的Claude token')
      return null
    } catch (error) {
      console.error('获取Claude token失败:', error)
      return null
    }
  }

  /**
   * 获取当前选中的模型
   */
  private async getSelectedModel(): Promise<SelectedModel> {
    const data = await this.kv.get(ADMIN_STORAGE_KEYS.SELECTED_MODEL)
    return data 
      ? JSON.parse(data)
      : { id: 'official', name: '官方 Claude', type: 'official' }
  }

  /**
   * 获取模型供应商信息
   */
  private async getProvider(providerId: string): Promise<ModelProvider | null> {
    const data = await this.kv.get(ADMIN_STORAGE_KEYS.MODEL_PROVIDERS)
    if (!data) return null
    
    const providers: ModelProvider[] = JSON.parse(data)
    return providers.find(p => p.id === providerId) || null
  }

}