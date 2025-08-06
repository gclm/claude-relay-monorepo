/**
 * 模型路由服务 - 新架构版本
 * 根据请求特征和路由配置选择最合适的模型
 */

import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'
import type { RouteConfig, ModelTarget } from './types'
import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages'
import { getEncoding } from 'js-tiktoken'

// 全局单例缓存 - 跨请求复用
let globalEncoder: any = null
let encoderInitPromise: Promise<any> | null = null

/**
 * 获取全局 token 编码器实例
 * 使用单例模式确保在 Worker 实例生命周期内只初始化一次
 */
async function getGlobalEncoder() {
  // 如果已经初始化，直接返回
  if (globalEncoder) {
    return globalEncoder
  }
  
  // 如果正在初始化，等待完成
  if (encoderInitPromise) {
    return await encoderInitPromise
  }
  
  // 开始初始化
  encoderInitPromise = initializeEncoder()
  globalEncoder = await encoderInitPromise
  return globalEncoder
}

/**
 * 初始化 token 编码器，包含错误处理和回退机制
 */
async function initializeEncoder() {
  try {
    const encoder = getEncoding('cl100k_base')
    return encoder
  } catch (error) {
    // token 编码器初始化失败，使用简化估算
    // 提供轻量级的回退方案
    return {
      encode: (text: string) => {
        // 简单估算：平均 1 token ≈ 4 字符（适用于英文和中文混合）
        return new Array(Math.ceil(text.length / 4))
      }
    }
  }
}

export class ModelRouterService {
  
  /**
   * 根据请求特征和路由配置选择模型
   */
  async selectModel(request: MessageCreateParamsBase, routeConfig: RouteConfig): Promise<ModelTarget> {
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
      const tokenCount = await this.calculateTokenCount(
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
   * 使用 js-tiktoken cl100k_base 编码器进行精确计算
   */
  private async calculateTokenCount(
    messages: MessageParam[],
    system: any,
    tools: Tool[]
  ): Promise<number> {
    // 获取全局编码器实例
    const encoder = await getGlobalEncoder()
    let tokenCount = 0
    
    // 处理消息
    if (Array.isArray(messages)) {
      messages.forEach((message) => {
        if (typeof message.content === 'string') {
          tokenCount += encoder.encode(message.content).length
        } else if (Array.isArray(message.content)) {
          message.content.forEach((contentPart: any) => {
            if (contentPart.type === 'text') {
              tokenCount += encoder.encode(contentPart.text).length
            } else if (contentPart.type === 'tool_use') {
              tokenCount += encoder.encode(
                JSON.stringify(contentPart.input)
              ).length
            } else if (contentPart.type === 'tool_result') {
              tokenCount += encoder.encode(
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
      tokenCount += encoder.encode(system).length
    } else if (Array.isArray(system)) {
      system.forEach((item: any) => {
        if (item.type !== 'text') return
        if (typeof item.text === 'string') {
          tokenCount += encoder.encode(item.text).length
        } else if (Array.isArray(item.text)) {
          item.text.forEach((textPart: any) => {
            tokenCount += encoder.encode(textPart || '').length
          })
        }
      })
    }
    
    // 处理工具定义
    if (tools) {
      tools.forEach((tool: Tool) => {
        if (tool.description) {
          tokenCount += encoder.encode(tool.name + tool.description).length
        }
        if (tool.input_schema) {
          tokenCount += encoder.encode(JSON.stringify(tool.input_schema)).length
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