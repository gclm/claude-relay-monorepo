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
  // 在 Cloudflare Workers 中，每个 console.log 会创建单独的日志条目
  console.log('=== Claude Request (原始) ===')
  // 尝试分段输出，避免大对象被截断
  try {
    const requestStr = JSON.stringify(request, null, 2)
    // 如果请求太大，分段输出
    if (requestStr.length > 1000) {
      console.log('Request size:', requestStr.length, 'characters')
      console.log('Model:', request.model)
      console.log('Stream:', request.stream)
      console.log('Max tokens:', request.max_tokens)
      console.log('Messages count:', request.messages?.length || 0)
      // 输出前1000个字符
      console.log('Request preview:', requestStr.substring(0, 1000) + '...')
    } else {
      console.log(requestStr)
    }
  } catch (error) {
    console.error('Error logging Claude request:', error)
  }
}

export function logProviderRequest(provider: string, url: string, request: any): void {
  console.log(`=== ${provider} Request (转换后) ===`)
  console.log(`URL: ${url}`)
  try {
    const requestStr = JSON.stringify(request, null, 2)
    if (requestStr.length > 1000) {
      console.log('Request size:', requestStr.length, 'characters')
      console.log('Model:', request.model)
      console.log('Contents length:', request.contents?.length || 0)
      console.log('Config:', JSON.stringify(request.config || {}, null, 2))
      console.log('Request preview:', requestStr.substring(0, 1000) + '...')
    } else {
      console.log(requestStr)
    }
  } catch (error) {
    console.error(`Error logging ${provider} request:`, error)
  }
}

export function logProviderResponse(provider: string, response: any): void {
  console.log(`=== ${provider} Response (原始) ===`)
  try {
    if (response instanceof ReadableStream || response?.body instanceof ReadableStream) {
      console.log('Type: Streaming Response')
    } else if (response?.[Symbol.asyncIterator]) {
      // 处理 AsyncGenerator (如 Gemini SDK 的流式响应)
      console.log('Type: Async Generator Stream')
      console.log('Note: Stream chunks will be logged during processing')
    } else {
      const responseStr = JSON.stringify(response, null, 2)
      if (responseStr.length > 1000) {
        console.log('Response size:', responseStr.length, 'characters')
        // 尝试提取关键信息
        if (response.candidates) {
          console.log('Candidates count:', response.candidates.length)
          if (response.candidates[0]?.content?.parts) {
            console.log('Parts count:', response.candidates[0].content.parts.length)
            // 记录每个 part 的类型
            const partTypes = response.candidates[0].content.parts.map((p: any) => 
              Object.keys(p).filter(k => k !== 'text').join(', ') || 'text'
            )
            console.log('Part types:', partTypes.join(', '))
          }
        }
        console.log('Usage:', JSON.stringify(response.usageMetadata || {}, null, 2))
        console.log('Response preview:', responseStr.substring(0, 1000) + '...')
      } else {
        console.log(responseStr)
      }
    }
  } catch (error) {
    console.error(`Error logging ${provider} response:`, error)
  }
}

export function logClaudeResponse(response: Message | ReadableStream): void {
  console.log('=== Claude Response (转换后) ===')
  try {
    if (response instanceof ReadableStream) {
      console.log('Type: Streaming Response')
      console.log('Note: SSE events will be logged during streaming')
    } else {
      const responseStr = JSON.stringify(response, null, 2)
      if (responseStr.length > 1000) {
        console.log('Response size:', responseStr.length, 'characters')
        console.log('Model:', response.model)
        console.log('Content blocks:', response.content?.length || 0)
        console.log('Stop reason:', response.stop_reason)
        console.log('Usage:', JSON.stringify(response.usage || {}, null, 2))
        console.log('Response preview:', responseStr.substring(0, 1000) + '...')
      } else {
        console.log(responseStr)
      }
    }
  } catch (error) {
    console.error('Error logging Claude response:', error)
  }
}

