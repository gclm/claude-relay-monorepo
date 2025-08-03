/**
 * Claude to Gemini 转换器
 * 简化版本，专注于格式转换
 */

import { AbstractTransformer } from './base-transformer'
import type { ClaudeRequest, ClaudeResponse } from '../../../types/proxy/claude'

export class ClaudeToGeminiTransformer extends AbstractTransformer {
  /**
   * 转换 Claude 请求为 Gemini 格式
   */
  transformRequest(claudeRequest: ClaudeRequest): Record<string, any> {
    const geminiRequest: any = {
      contents: [],
      generationConfig: {}
    }

    // 处理系统消息
    if (claudeRequest.system) {
      geminiRequest.systemInstruction = {
        parts: [{
          text: typeof claudeRequest.system === 'string' 
            ? claudeRequest.system 
            : this.extractTextFromContent(claudeRequest.system)
        }]
      }
    }

    // 转换消息
    if (claudeRequest.messages) {
      for (const message of claudeRequest.messages) {
        geminiRequest.contents.push(this.transformMessage(message))
      }
    }

    // 转换生成配置
    if (claudeRequest.max_tokens) {
      geminiRequest.generationConfig.maxOutputTokens = claudeRequest.max_tokens
    }
    if (claudeRequest.temperature !== undefined) {
      geminiRequest.generationConfig.temperature = claudeRequest.temperature
    }
    if (claudeRequest.top_p !== undefined) {
      geminiRequest.generationConfig.topP = claudeRequest.top_p
    }
    if (claudeRequest.top_k !== undefined) {
      geminiRequest.generationConfig.topK = claudeRequest.top_k
    }
    if (claudeRequest.stop_sequences) {
      geminiRequest.generationConfig.stopSequences = claudeRequest.stop_sequences
    }

    return geminiRequest
  }

  /**
   * 转换响应格式
   */
  async transformResponse(geminiResponse: Record<string, any>, isStream: boolean): Promise<ClaudeResponse | ReadableStream> {
    if (isStream) {
      // 对于流式响应，geminiResponse 应该是 ReadableStream
      return this.transformStreamResponse(geminiResponse as unknown as ReadableStream)
    }
    return this.transformNormalResponse(geminiResponse)
  }

  /**
   * 转换单个消息
   */
  private transformMessage(message: any): any {
    const role = message.role === 'assistant' ? 'model' : 'user'
    const parts: any[] = []

    if (typeof message.content === 'string') {
      parts.push({ text: message.content })
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          parts.push({ text: content.text })
        } else if (content.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: content.source.media_type,
              data: content.source.data
            }
          })
        }
        // Gemini 不直接支持 tool_use 和 tool_result，需要转换为文本
        else if (content.type === 'tool_use') {
          parts.push({
            text: `[Tool Call: ${content.name}]\n${JSON.stringify(content.input, null, 2)}`
          })
        } else if (content.type === 'tool_result') {
          parts.push({
            text: `[Tool Result: ${content.tool_use_id}]\n${JSON.stringify(content.content)}`
          })
        }
      }
    }

    return { role, parts }
  }

  /**
   * 转换非流式响应
   */
  private transformNormalResponse(geminiResponse: Record<string, any>): ClaudeResponse {
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('Invalid Gemini response: no candidates found')
    }

    const candidate = geminiResponse.candidates[0]
    const content: any[] = []

    // 处理响应内容
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content.push({
            type: 'text',
            text: part.text
          })
        }
      }
    }

    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: geminiResponse.modelVersion || 'gemini',
      content: content,
      stop_reason: this.mapFinishReason(candidate.finishReason),
      stop_sequence: null,
      usage: {
        input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
        output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      }
    }
  }

  /**
   * 转换流式响应
   */
  private async transformStreamResponse(geminiStream: ReadableStream): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const self = this  // 保存 this 引用

    return new ReadableStream({
      async start(controller) {
        const reader = geminiStream.getReader()
        let buffer = ''
        let messageStarted = false
        let contentIndex = 0
        let accumulatedText = ''

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

              const data = line.slice(6).trim()
              if (!data || data === '[DONE]') continue

              const chunk = self.safeJsonParse(data)
              if (!chunk) continue

              // 第一个块，发送 message_start
              if (!messageStarted) {
                controller.enqueue(encoder.encode(self.createSSEEvent('message_start', {
                  type: 'message_start',
                  message: {
                    id: `msg_${Date.now()}`,
                    type: 'message',
                    role: 'assistant',
                    model: chunk.modelVersion || 'gemini',
                    content: [],
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 }
                  }
                })))
                messageStarted = true
              }

              // 处理内容块
              if (chunk.candidates?.[0]?.content?.parts) {
                for (const part of chunk.candidates[0].content.parts) {
                  if (part.text) {
                    if (!accumulatedText) {
                      controller.enqueue(encoder.encode(self.createSSEEvent('content_block_start', {
                        type: 'content_block_start',
                        index: contentIndex,
                        content_block: { type: 'text', text: '' }
                      })))
                    }

                    controller.enqueue(encoder.encode(self.createSSEEvent('content_block_delta', {
                      type: 'content_block_delta',
                      index: contentIndex,
                      delta: { type: 'text_delta', text: part.text }
                    })))

                    accumulatedText += part.text
                  }
                }
              }

              // 处理结束
              if (chunk.candidates?.[0]?.finishReason) {
                if (accumulatedText) {
                  controller.enqueue(encoder.encode(self.createSSEEvent('content_block_stop', {
                    type: 'content_block_stop',
                    index: contentIndex
                  })))
                }

                controller.enqueue(encoder.encode(self.createSSEEvent('message_delta', {
                  type: 'message_delta',
                  delta: {
                    stop_reason: self.mapFinishReason(chunk.candidates[0].finishReason),
                    stop_sequence: null
                  },
                  usage: {
                    output_tokens: chunk.usageMetadata?.candidatesTokenCount || 0
                  }
                })))
              }
            }
          }

          // 发送结束事件
          controller.enqueue(encoder.encode(self.createSSEEvent('message_stop', {
            type: 'message_stop'
          })))
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
   * 映射完成原因
   */
  private mapFinishReason(reason: string | null): string {
    if (!reason) return 'end_turn'
    
    const mapping: Record<string, string> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'content_filter',
      'RECITATION': 'content_filter',
      'OTHER': 'end_turn'
    }
    
    return mapping[reason] || 'end_turn'
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