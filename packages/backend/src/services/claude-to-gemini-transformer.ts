/**
 * Claude to Gemini API 转换器
 * 负责在 Claude API 格式和 Google Gemini API 格式之间进行转换
 */

export class ClaudeToGeminiTransformer {
  name = 'ClaudeToGemini'

  /**
   * 将 Claude 请求转换为 Gemini 格式
   */
  transformRequestOut(claudeRequest: any): any {
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
            : claudeRequest.system.map((s: any) => s.text || s).join('\n')
        }]
      }
    }

    // 转换消息
    const messages = claudeRequest.messages || []
    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : 'user'
      
      // 处理消息内容
      const parts: any[] = []
      
      if (typeof message.content === 'string') {
        parts.push({ text: message.content })
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text') {
            parts.push({ text: content.text })
          } else if (content.type === 'image') {
            // Gemini 需要 base64 图像数据
            parts.push({
              inlineData: {
                mimeType: content.source.media_type,
                data: content.source.data
              }
            })
          }
        }
      }

      geminiRequest.contents.push({ role, parts })
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

    return geminiRequest
  }

  /**
   * 将 Gemini 响应转换为 Claude 格式
   */
  async transformResponseIn(geminiResponse: any): Promise<any> {
    const claudeResponse: any = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-3-opus-20240229', // 模拟的模型名
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }

    // 处理候选响应
    if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
      const candidate = geminiResponse.candidates[0]
      
      // 转换内容
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            claudeResponse.content.push({
              type: 'text',
              text: part.text
            })
          }
        }
      }

      // 处理停止原因
      if (candidate.finishReason) {
        switch (candidate.finishReason) {
          case 'STOP':
            claudeResponse.stop_reason = 'end_turn'
            break
          case 'MAX_TOKENS':
            claudeResponse.stop_reason = 'max_tokens'
            break
          case 'SAFETY':
            claudeResponse.stop_reason = 'stop_sequence'
            break
          default:
            claudeResponse.stop_reason = 'end_turn'
        }
      }
    }

    // 处理使用统计
    if (geminiResponse.usageMetadata) {
      claudeResponse.usage = {
        input_tokens: geminiResponse.usageMetadata.promptTokenCount || 0,
        output_tokens: geminiResponse.usageMetadata.candidatesTokenCount || 0
      }
    }

    return claudeResponse
  }

  /**
   * 将 Gemini 流式响应转换为 Claude SSE 格式
   */
  async convertStreamToClaudeFormat(responseBody: ReadableStream): Promise<ReadableStream> {
    const reader = responseBody.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    return new ReadableStream({
      async start(controller) {
        let buffer = ''
        let messageStarted = false
        let contentBlockStarted = false

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            
            // Gemini 返回 JSON 数组格式 [{...}, {...}, ...]
            // 处理完整的数组或数组元素
            if (buffer.trim().startsWith('[')) {
              // 移除数组开始符号
              buffer = buffer.trim().substring(1)
            }
            
            // 寻找完整的 JSON 对象
            let depth = 0
            let start = -1
            let end = -1
            
            for (let i = 0; i < buffer.length; i++) {
              const char = buffer[i]
              if (char === '{') {
                if (start === -1) start = i
                depth++
              } else if (char === '}') {
                depth--
                if (depth === 0 && start !== -1) {
                  end = i
                  break
                }
              }
            }
            
            if (start !== -1 && end !== -1) {
              const jsonStr = buffer.substring(start, end + 1)
              
              try {
                const data = JSON.parse(jsonStr)
                
                // 发送消息开始事件
                if (!messageStarted) {
                  const messageStart = {
                    type: 'message_start',
                    message: {
                      id: `msg_${Date.now()}`,
                      type: 'message',
                      role: 'assistant',
                      content: [],
                      model: 'claude-3-opus-20240229',
                      stop_reason: null,
                      stop_sequence: null,
                      usage: { input_tokens: 0, output_tokens: 0 }
                    }
                  }
                  controller.enqueue(encoder.encode(`event: message_start\ndata: ${JSON.stringify(messageStart)}\n\n`))
                  messageStarted = true
                }

                // 处理内容增量
                if (data.candidates && data.candidates[0]?.content?.parts) {
                  for (const part of data.candidates[0].content.parts) {
                    if (part.text) {
                      // 发送内容块开始事件（如果还没发送）
                      if (!contentBlockStarted) {
                        const contentBlockStart = {
                          type: 'content_block_start',
                          index: 0,
                          content_block: { type: 'text', text: '' }
                        }
                        controller.enqueue(encoder.encode(`event: content_block_start\ndata: ${JSON.stringify(contentBlockStart)}\n\n`))
                        contentBlockStarted = true
                      }
                      
                      // 发送内容增量
                      const contentDelta = {
                        type: 'content_block_delta',
                        index: 0,
                        delta: { type: 'text_delta', text: part.text }
                      }
                      controller.enqueue(encoder.encode(`event: content_block_delta\ndata: ${JSON.stringify(contentDelta)}\n\n`))
                    }
                  }
                }

                // 检查是否结束
                if (data.candidates && data.candidates[0]?.finishReason) {
                  // 发送内容块结束事件
                  if (contentBlockStarted) {
                    const contentBlockStop = {
                      type: 'content_block_stop',
                      index: 0
                    }
                    controller.enqueue(encoder.encode(`event: content_block_stop\ndata: ${JSON.stringify(contentBlockStop)}\n\n`))
                  }
                  
                  // 发送消息结束事件
                  const messageDelta = {
                    type: 'message_delta',
                    delta: {
                      stop_reason: data.candidates[0].finishReason === 'STOP' ? 'end_turn' : 'max_tokens',
                      stop_sequence: null
                    },
                    usage: {
                      input_tokens: data.usageMetadata?.promptTokenCount || 0,
                      output_tokens: data.usageMetadata?.candidatesTokenCount || 0
                    }
                  }
                  controller.enqueue(encoder.encode(`event: message_delta\ndata: ${JSON.stringify(messageDelta)}\n\n`))
                  
                  const messageStop = { type: 'message_stop' }
                  controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify(messageStop)}\n\n`))
                  break
                }

                // 移除已处理的部分
                buffer = buffer.substring(end + 1)
                
              } catch (parseError) {
                console.error('Stream JSON parse error:', parseError)
                // 跳过这个无效的 JSON
                buffer = buffer.substring(end + 1)
              }
            } else {
              // 没有找到完整的 JSON 对象，等待更多数据
              break
            }
          }

        } catch (error) {
          console.error('Stream conversion error:', error)
          controller.error(error)
        } finally {
          try {
            controller.close()
          } catch (closeError) {
            console.error('Controller close error:', closeError)
          }
        }
      }
    })
  }
}