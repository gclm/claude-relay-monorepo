/**
 * Engine 相关的类型定义
 */

import type { MessageCreateParamsBase, Message } from '@anthropic-ai/sdk/resources/messages'
import type { ModelProvider } from '../../../../../../shared/types/admin/providers'
import type { ModelTarget, RouteConfig } from '../../../../../../shared/types/admin/routes'
import type { ClaudeToken } from '../../../types/proxy'
import type { ApiKey } from '../../../../../../shared/types/key-pool'
import type { BaseTransformer } from '../transformers/base-transformer'

// 重新导出类型以便其他文件使用
export type { ModelTarget, RouteConfig }

/**
 * 请求上下文
 */
export interface RequestContext {
  readonly originalRequest: MessageCreateParamsBase
  readonly requestId: string
  
  // 路由信息
  routeConfig?: RouteConfig
  modelTarget?: ModelTarget
  
  // 供应商信息
  provider?: ModelProvider
  selectedModel?: string
  
  // API Key 信息
  apiKey?: ApiKey
  
  // 转换器
  transformer?: BaseTransformer
  
  // 转换后的数据
  transformedRequest?: Record<string, any>  // 转换后的请求体，可能是 OpenAI/Gemini 等格式
  
  // HTTP 请求信息
  requestUrl?: string
  requestHeaders?: Record<string, string>
  
  // 原始响应
  rawResponse?: Response
  
  // 处理后的响应
  processedResponse?: Response
  
  // 错误收集
  errors: Error[]
}

/**
 * Engine 接口
 */
export interface Engine {
  processRequest(request: MessageCreateParamsBase): Promise<Response>
}

/**
 * 系统选择的配置
 */
export interface SelectedConfig {
  type: 'claude' | 'route'
  routeId?: string  // 当 type 为 'route' 时使用
}

/**
 * Provider 解析结果
 */
export interface ProviderResolution {
  provider: ModelProvider
  selectedModel: string
  apiKey: ApiKey
  routeConfig: RouteConfig
  transformer: BaseTransformer
}