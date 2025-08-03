/**
 * 模型路由服务 - 新架构版本
 * 根据请求特征和路由配置选择最合适的模型
 */

import type { ClaudeRequest } from '../../../types/proxy/claude'
import type { RouteConfig, ModelTarget } from './types'
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages'
import { get_encoding } from '@dqbd/tiktoken'

export class ModelRouterService {
  private encoder: any
  
  constructor() {
    // 使用 cl100k_base 编码器（GPT-4 和 Claude 3 使用的编码器）
    try {
      this.encoder = get_encoding('cl100k_base')
    } catch (error) {
      console.warn('Failed to initialize tiktoken encoder, falling back to estimation')
      this.encoder = null
    }
  }
  
  /**
   * 清理资源
   */
  destroy() {
    if (this.encoder && typeof this.encoder.free === 'function') {
      this.encoder.free()
    }
  }
  
  /**
   * 根据请求特征和路由配置选择模型
   */
  async selectModel(request: ClaudeRequest, routeConfig: RouteConfig): Promise<ModelTarget> {
    const { rules, config } = routeConfig
    
    // 如果请求中包含逗号分隔的模型列表，使用第一个模型
    if (request.model?.includes(',')) {
      const firstModel = request.model.split(',')[0].trim()
      // 尝试在路由规则中查找匹配的模型
      const matchedTarget = this.findModelInRules(firstModel, rules)
      if (matchedTarget) {
        return matchedTarget
      }
    }
    
    // 1. 长上下文模型选择
    if (rules.longContext) {
      const tokenCount = this.calculateTokenCount(
        request.messages as MessageParam[],
        request.system,
        request.tools as Tool[]
      )
      const threshold = config?.longContextThreshold || 60000
      
      if (tokenCount > threshold) {
        console.log(`🔄 使用长上下文模型，token 数: ${tokenCount.toLocaleString()}，阈值: ${threshold.toLocaleString()}`)
        return rules.longContext
      }
    }
    
    // 2. 后台/轻量级模型选择（如 claude-3-5-haiku）
    if (request.model?.includes('haiku') && rules.background) {
      console.log(`🔄 使用后台模型处理: ${request.model}`)
      return rules.background
    }
    
    // 3. 思考/推理模型选择
    if (request.thinking && rules.think) {
      console.log('🔄 使用思考模型处理包含思考过程的请求')
      return rules.think
    }
    
    // 4. 网络搜索模型选择
    if (request.tools && Array.isArray(request.tools)) {
      const hasWebSearch = request.tools.some((tool: any) => 
        tool.type?.startsWith('web_search')
      )
      if (hasWebSearch && rules.webSearch) {
        console.log('🔄 使用网络搜索优化模型')
        return rules.webSearch
      }
    }
    
    // 5. 默认模型
    console.log('🔄 使用默认模型')
    return rules.default
  }
  
  /**
   * 精确计算消息的总 token 数
   */
  private calculateTokenCount(
    messages: MessageParam[],
    system: any,
    tools: Tool[]
  ): number {
    if (!this.encoder) {
      // 如果编码器不可用，使用简单估算
      const text = JSON.stringify({ messages, system, tools })
      return Math.ceil(text.length / 4)
    }
    
    let tokenCount = 0
    
    // 处理消息
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        if (typeof message.content === 'string') {
          tokenCount += this.encoder.encode(message.content).length
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart: any) => {
            if (contentPart.type === 'text') {
              tokenCount += this.encoder.encode(contentPart.text).length
            } else if (contentPart.type === 'tool_use') {
              tokenCount += this.encoder.encode(
                JSON.stringify(contentPart.input)
              ).length
            } else if (contentPart.type === 'tool_result') {
              tokenCount += this.encoder.encode(
                typeof contentPart.content === 'string'
                  ? contentPart.content
                  : JSON.stringify(contentPart.content)
              ).length
            }
          })
        }
      })
    }
    
    // 处理系统提示
    if (typeof system === 'string') {
      tokenCount += this.encoder.encode(system).length
    } else if (Array.isArray(system)) {
      system.forEach((item: any) => {
        if (item.type !== 'text') return
        if (typeof item.text === 'string') {
          tokenCount += this.encoder.encode(item.text).length
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart: any) => {
            tokenCount += this.encoder.encode(textPart || '').length
          })
        }
      })
    }
    
    // 处理工具定义
    if (tools) {
      tools.forEach((tool: Tool) => {
        if (tool.description) {
          tokenCount += this.encoder.encode(tool.name + tool.description).length
        }
        if (tool.input_schema) {
          tokenCount += this.encoder.encode(JSON.stringify(tool.input_schema)).length
        }
      })
    }
    
    return tokenCount
  }
  
  /**
   * 在路由规则中查找指定的模型
   */
  private findModelInRules(modelName: string, rules: RouteConfig['rules']): ModelTarget | null {
    // 遍历所有规则，查找匹配的模型
    const allTargets = [
      rules.default,
      rules.longContext,
      rules.background,
      rules.think,
      rules.webSearch
    ].filter(Boolean) as ModelTarget[]
    
    for (const target of allTargets) {
      if (target.model === modelName) {
        return target
      }
    }
    
    return null
  }
}