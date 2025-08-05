import type { MessageCreateParamsBase, Message } from '@anthropic-ai/sdk/resources/messages'

/**
 * 简化后的转换器接口 - 端到端处理
 * 直接完成 请求转换 -> API 调用 -> 响应转换 的完整流程
 */
export interface Transformer {
  /**
   * 初始化客户端（如果需要）
   */
  initializeClient?(apiKey: string, options?: any): void

  /**
   * 端到端处理请求
   * @param claudeRequest Claude API 格式的请求
   * @param model 目标模型名称
   * @returns Claude API 格式的响应或流
   */
  processRequest(claudeRequest: MessageCreateParamsBase, model: string): Promise<Message | ReadableStream>

  /**
   * 清理资源（如果需要）
   */
  cleanup?(): void
}

