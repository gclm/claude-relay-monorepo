/**
 * Claude to OpenAI 转换器
 * 简化版本，专注于格式转换
 */

import { AbstractTransformer } from './base-transformer'
import type { ClaudeRequest, ClaudeResponse } from '../../../types/proxy/claude'

// 完成原因映射
const FINISH_REASON_MAPPING: Record<string, string> = {
  'stop': 'end_turn',
  'length': 'max_tokens',
  'tool_calls': 'tool_use',
  'function_call': 'tool_use',
  'content_filter': 'content_filter'
}

export class ClaudeToOpenAITransformer extends AbstractTransformer {
  /**
   * 转换 Claude 请求为 OpenAI 格式
   */
  transformRequest(claudeRequest: ClaudeRequest): Record<string, any> {
    const messages: any[] = []

    // 处理系统消息
    if (claudeRequest.system) {
      messages.push({
        role: 'system',
        content: typeof claudeRequest.system === 'string' 
          ? claudeRequest.system 
          : this.extractTextFromContent(claudeRequest.system)
      })
    }

    // 处理对话消息
    if (claudeRequest.messages) {
      for (const msg of claudeRequest.messages) {
        messages.push(this.transformMessage(msg))
      }
    }

    return {
      messages,
      model: claudeRequest.model,
      max_tokens: claudeRequest.max_tokens,
      temperature: claudeRequest.temperature,
      stream: claudeRequest.stream,
      tools: claudeRequest.tools ? this.transformTools(claudeRequest.tools) : undefined,
      tool_choice: claudeRequest.tool_choice,
    }
  }

  /**
   * 转换响应格式
   */
  async transformResponse(openaiResponse: Record<string, any>, isStream: boolean): Promise<ClaudeResponse | ReadableStream> {
    if (isStream) {
      // 对于流式响应，openaiResponse 应该是 ReadableStream
      return this.transformStreamResponse(openaiResponse as unknown as ReadableStream)
    }
    return this.transformNormalResponse(openaiResponse)
  }

  /**
   * 转换单个消息
   */
  private transformMessage(msg: any): any {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content
      }
    }

    // 处理复杂内容
    const transformedMsg: any = { role: msg.role }
    const contentParts: any[] = []
    let toolCalls: any[] = []

    for (const content of msg.content) {
      if (content.type === 'text') {
        contentParts.push({
          type: 'text',
          text: content.text
        })
      } else if (content.type === 'image') {
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${content.source.media_type};base64,${content.source.data}`
          }
        })
      } else if (content.type === 'tool_use') {
        toolCalls.push({
          id: content.id,
          type: 'function',
          function: {
            name: content.name,
            arguments: JSON.stringify(content.input)
          }
        })
      } else if (content.type === 'tool_result') {
        // Tool results 在 OpenAI 中作为单独的消息
        return {
          role: 'tool',
          content: JSON.stringify(content.content),
          tool_call_id: content.tool_use_id
        }
      }
    }

    // 设置内容
    if (contentParts.length === 1 && contentParts[0].type === 'text') {
      transformedMsg.content = contentParts[0].text
    } else if (contentParts.length > 0) {
      transformedMsg.content = contentParts
    }

    // 添加工具调用
    if (toolCalls.length > 0) {
      transformedMsg.tool_calls = toolCalls
    }

    return transformedMsg
  }

  /**
   * 转换工具定义
   */
  private transformTools(claudeTools: any[]): any[] {
    return claudeTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }))
  }

  /**
   * 转换非流式响应
   */
  private transformNormalResponse(openaiResponse: Record<string, any>): ClaudeResponse {
    if (!openaiResponse.choices || openaiResponse.choices.length === 0) {
      throw new Error('Invalid OpenAI response: no choices found')
    }
    
    const choice = openaiResponse.choices[0]
    const content: any[] = []

    // 处理文本内容
    if (choice.message?.content) {
      content.push({
        type: 'text',
        text: choice.message.content
      })
    }

    // 处理工具调用
    if (choice.message?.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: this.safeJsonParse(toolCall.function.arguments) || {}
        })
      }
    }

    return {
      id: openaiResponse.id || `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: openaiResponse.model,
      content: content,
      stop_reason: this.mapFinishReason(choice.finish_reason),
      stop_sequence: null,
      usage: {
        input_tokens: openaiResponse.usage?.prompt_tokens || 0,
        output_tokens: openaiResponse.usage?.completion_tokens || 0,
      }
    }
  }

  /**
   * 转换流式响应
   */
  private async transformStreamResponse(openaiStream: ReadableStream): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const self = this  // 保存 this 引用

    return new ReadableStream({
      async start(controller) {
        const reader = openaiStream.getReader()
        let buffer = ''
        let messageStarted = false
        let contentIndex = 0

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.trim() === '') continue
              if (!line.startsWith('data: ')) continue

              const data = line.slice(6)
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode(self.createSSEEvent('message_stop', { type: 'message_stop' })))
                continue
              }

              const chunk = self.safeJsonParse(data)
              if (!chunk) continue

              // 转换 OpenAI 流块为 Claude 格式
              const claudeEvents = self.transformStreamChunk(chunk, messageStarted, contentIndex)
              for (const event of claudeEvents) {
                controller.enqueue(encoder.encode(self.createSSEEvent(event.type, event.data)))
                if (event.type === 'message_start') messageStarted = true
                if (event.type === 'content_block_start') contentIndex++
              }
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
          reader.releaseLock()
        }
      }
    })
  }

  /**
   * 转换单个流数据块
   */
  private transformStreamChunk(chunk: any, messageStarted: boolean, contentIndex: number): any[] {
    const events: any[] = []

    // 第一个块，发送 message_start
    if (!messageStarted && chunk.choices?.[0]) {
      events.push({
        type: 'message_start',
        data: {
          type: 'message_start',
          message: {
            id: chunk.id || `msg_${Date.now()}`,
            type: 'message',
            role: 'assistant',
            model: chunk.model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        }
      })
    }

    const delta = chunk.choices?.[0]?.delta
    if (!delta) return events

    // 处理文本内容
    if (delta.content) {
      if (contentIndex === 0) {
        events.push({
          type: 'content_block_start',
          data: {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' }
          }
        })
      }

      events.push({
        type: 'content_block_delta',
        data: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: delta.content }
        }
      })
    }

    // 处理工具调用
    if (delta.tool_calls) {
      for (const toolCall of delta.tool_calls) {
        if (toolCall.function?.name) {
          events.push({
            type: 'content_block_start',
            data: {
              type: 'content_block_start',
              index: contentIndex,
              content_block: {
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.function.name,
                input: {}
              }
            }
          })
        }

        if (toolCall.function?.arguments) {
          events.push({
            type: 'content_block_delta',
            data: {
              type: 'content_block_delta',
              index: contentIndex,
              delta: {
                type: 'input_json_delta',
                partial_json: toolCall.function.arguments
              }
            }
          })
        }
      }
    }

    // 处理结束
    if (chunk.choices?.[0]?.finish_reason) {
      events.push({
        type: 'message_delta',
        data: {
          type: 'message_delta',
          delta: {
            stop_reason: this.mapFinishReason(chunk.choices[0].finish_reason),
            stop_sequence: null
          },
          usage: {
            output_tokens: chunk.usage?.completion_tokens || 0
          }
        }
      })
    }

    return events
  }

  /**
   * 映射完成原因
   */
  private mapFinishReason(reason: string | null): string {
    if (!reason) return 'end_turn'
    return FINISH_REASON_MAPPING[reason] || 'end_turn'
  }

  /**
   * 从复杂内容中提取文本
   */
  private extractTextFromContent(content: any[]): string {
    return content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
  }
}