/**
 * 模型路由服务 - 新架构版本
 * 根据请求特征和路由配置选择最合适的模型
 */

import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'
import type { RouteConfig, ModelTarget } from './types'
import { estimateTokens } from './optimized-token-estimator'

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
      // 直接估算整个请求的 token 数
      const requestText = JSON.stringify(request)
      const tokenCount = estimateTokens(requestText)
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