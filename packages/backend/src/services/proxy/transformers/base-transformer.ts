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

/**
 * 简单的日志函数
 */
export function logClaudeRequest(request: MessageCreateParamsBase): void {
  console.log('\n=== Claude Request (原始) ===')
  console.log(JSON.stringify(request, null, 2))
}

export function logProviderRequest(provider: string, url: string, request: any): void {
  console.log(`\n=== ${provider} Request (转换后) ===`)
  console.log(`URL: ${url}`)
  console.log(JSON.stringify(request, null, 2))
}

export function logProviderResponse(provider: string, response: any): void {
  console.log(`\n=== ${provider} Response (原始) ===`)
  if (response instanceof ReadableStream || response?.body instanceof ReadableStream) {
    console.log('Type: Streaming Response')
  } else {
    console.log(JSON.stringify(response, null, 2))
  }
}

export function logClaudeResponse(response: Message | ReadableStream): void {
  console.log('\n=== Claude Response (转换后) ===')
  if (response instanceof ReadableStream) {
    console.log('Type: Streaming Response')
  } else {
    console.log(JSON.stringify(response, null, 2))
  }
}

