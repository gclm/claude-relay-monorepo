/**
 * LLM代理服务 - 使用自定义转换器进行格式转换
 * 支持多种LLM供应商的统一API转换
 */

import { ClaudeToOpenAITransformer } from '../transformers/claude-to-openai'
import { ClaudeToGeminiTransformer } from '../transformers/claude-to-gemini'
import { KeyPoolManager } from '../key-pool'
import { ApiKey } from '../../../../../shared/types/key-pool'
import { ModelProvider } from '../../../../../shared/types/admin/providers'

import { LLMProvider, ClaudeRequest } from '../../types/proxy'

export class LLMProxyService {
  private providers: Map<string, LLMProvider> = new Map()
  private transformers: Map<string, any> = new Map()
  private keyPoolManager: KeyPoolManager

  constructor(kv: KVNamespace) {
    // 初始化转换器 - 使用自定义的Claude到OpenAI转换器
    this.transformers.set('claude-to-openai', new ClaudeToOpenAITransformer())
    // 初始化Claude到Gemini转换器
    this.transformers.set('claude-to-gemini', new ClaudeToGeminiTransformer())
    // 初始化 Key Pool 管理器
    this.keyPoolManager = new KeyPoolManager(kv)
  }

  /**
   * 注册LLM提供商
   */
  registerProvider(provider: LLMProvider) {
    this.providers.set(provider.name, provider)
  }

  /**
   * 从ModelProvider配置动态注册供应商
   */
  async registerProviderFromConfig(provider: ModelProvider) {
    const transformer = this.getTransformerForProvider(provider)
    
    // 初始化 Key Pool（不传递 initialApiKey，所有密钥从 Key Pool 管理）
    await this.keyPoolManager.initializeFromProvider(provider)
    
    this.registerProvider({
      name: provider.id,
      apiUrl: provider.endpoint,
      model: provider.model,
      transformer: transformer,
      type: provider.type
    })
  }

  /**
   * 根据供应商配置选择合适的转换器
   */
  private getTransformerForProvider(provider: any): any {
    // 使用供应商指定的转换器类型，默认为 'claude-to-openai'
    const transformerType = provider.transformer || 'claude-to-openai'
    return this.transformers.get(transformerType)
  }

  /**
   * 处理Claude请求并转发给指定提供商
   */
  async handleRequest(claudeRequest: ClaudeRequest, providerName: string): Promise<Response> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }

    // 从 Key Pool 获取可用的 API Key
    const pool = await this.keyPoolManager.getOrCreatePool(providerName, provider.type)
    const apiKeyInfo = await pool.getNextKey()
    
    if (!apiKeyInfo) {
      throw new Error(`No available API keys for provider ${providerName}`)
    }

    try {
      // 1. 转换请求格式
      const transformedRequest = this.transformRequest(claudeRequest, provider)
      
      // 2. 准备请求配置
      const { url, headers } = this.prepareRequestConfig(provider, apiKeyInfo.key, claudeRequest.stream)

      console.log(`🚀 转发到${providerName}: ${claudeRequest.stream ? '🌊' : '📄'} [Key: ${apiKeyInfo.id}]`)
      console.log('🔍 转换后的请求:', JSON.stringify(transformedRequest, null, 2))

      // 3. 发送请求
      const response = await this.sendRequest(url, headers, transformedRequest, providerName)

      // 4. 更新成功统计
      await pool.updateKeyStats(apiKeyInfo.id, true)

      // 5. 处理响应
      return await this.processResponse(response, claudeRequest.stream, provider)

    } catch (error) {
      console.error(`${providerName}代理失败:`, error)
      
      // 处理错误并更新 Key 状态
      await this.keyPoolManager.handleRequestError(providerName, apiKeyInfo.id, error)
      
      throw error
    }
  }

  /**
   * 转换请求格式
   */
  private transformRequest(claudeRequest: ClaudeRequest, provider: LLMProvider): any {
    const transformedRequest = provider.transformer.transformRequestOut(claudeRequest)
    const isGemini = provider.transformer.constructor.name === 'ClaudeToGeminiTransformer'
    
    if (!isGemini) {
      transformedRequest.model = provider.model
    }
    
    return transformedRequest
  }

  /**
   * 准备请求配置
   */
  private prepareRequestConfig(provider: LLMProvider, apiKey: string, isStream?: boolean) {
    const isGemini = provider.transformer.constructor.name === 'ClaudeToGeminiTransformer'
    
    // 构建URL
    let url = provider.apiUrl
    if (isGemini) {
      // 替换模型占位符
      url = url.replace('{{model}}', provider.model)
      const urlObj = new URL(url)
      urlObj.searchParams.append('key', apiKey)
      if (isStream) {
        url = urlObj.toString().replace(':generateContent', ':streamGenerateContent')
      } else {
        url = urlObj.toString()
      }
    }

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Claude-Relay-LLM-Proxy/1.0'
    }
    
    if (!isGemini) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    return { url, headers }
  }

  /**
   * 发送请求
   */
  private async sendRequest(url: string, headers: Record<string, string>, body: any, providerName: string): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ ${providerName}请求失败: ${response.status}`, errorText)
      throw new Error(`${providerName} API error: ${response.status} - ${errorText}`)
    }

    return response
  }

  /**
   * 处理响应
   */
  private async processResponse(response: Response, isStreamRequest: boolean | undefined, provider: LLMProvider): Promise<Response> {
    const contentType = response.headers.get('Content-Type') || ''
    const isGemini = provider.transformer.constructor.name === 'ClaudeToGeminiTransformer'
    
    const isStreamResponse = isStreamRequest && (
      contentType.includes('text/event-stream') || 
      (isGemini && contentType.includes('application/json'))
    )

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }

    if (isStreamResponse) {
      const transformedStream = await provider.transformer.convertStreamToClaudeFormat(response.body!)
      return new Response(transformedStream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          ...corsHeaders
        }
      })
    } else {
      try {
        const responseText = await response.text()
        console.log('📄 原始响应文本:', responseText)
        const providerResponse = JSON.parse(responseText)
        const claudeResponse = await provider.transformer.transformResponseIn(providerResponse)
        return new Response(JSON.stringify(claudeResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      } catch (parseError) {
        console.error('❌ JSON 解析失败:', parseError)
        console.error('❌ 响应内容:', 'Unable to read response text again')
        throw new Error(`Failed to parse JSON: ${parseError}`)
      }
    }
  }


  /**
   * 添加新的转换器到系统中
   */
  addTransformer(name: string, transformer: any) {
    this.transformers.set(name, transformer)
  }

  /**
   * 获取所有支持的供应商
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  /**
   * 获取所有可用的转换器
   */
  getTransformers(): string[] {
    return Array.from(this.transformers.keys())
  }

  /**
   * 获取 Key Pool 管理器
   */
  getKeyPoolManager(): KeyPoolManager {
    return this.keyPoolManager
  }
}
