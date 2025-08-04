import type { MessageCreateParamsBase, Message } from '@anthropic-ai/sdk/resources/messages'

/**
 * 基础转换器接口
 * 专注于纯格式转换，不包含配置管理、性能监控等功能
 */

export interface BaseTransformer {
  /**
   * 转换请求格式
   * @param claudeRequest Claude API 格式的请求
   * @returns 目标 API 格式的请求
   */
  transformRequest(claudeRequest: MessageCreateParamsBase): Record<string, any>

  /**
   * 转换响应格式
   * @param providerResponse 目标 API 的原始响应
   * @param isStream 是否为流式响应
   * @returns Claude API 格式的响应或流
   */
  transformResponse(providerResponse: Record<string, any>, isStream: boolean): Promise<Message | ReadableStream>
}

/**
 * 抽象基类，提供通用工具方法
 */
export abstract class AbstractTransformer implements BaseTransformer {
  abstract transformRequest(claudeRequest: MessageCreateParamsBase): Record<string, any>
  abstract transformResponse(providerResponse: Record<string, any>, isStream: boolean): Promise<Message | ReadableStream>

  /**
   * 工具函数：安全解析 JSON
   */
  protected safeJsonParse<T = Record<string, any>>(text: string): T | null {
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }

  /**
   * 工具函数：格式化 SSE 数据
   */
  protected formatSSE(data: Record<string, any>): string {
    return `data: ${JSON.stringify(data)}\n\n`
  }

  /**
   * 工具函数：创建 SSE 事件
   */
  protected createSSEEvent(event: string, data: Record<string, any>): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  }
}