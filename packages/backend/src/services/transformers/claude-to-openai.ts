/**
 * Claude to OpenAI 转换器
 * 基于 @musistudio/llms 的 AnthropicTransformer 源码实现
 */

import type {
  ContentBlock,
  OpenAIMessage,
  OpenAIToolCall,
  OpenAITool,
  OpenAIChatRequest,
  ClaudeRequest,
  ClaudeMessage,
  ClaudeTool,
  OpenAIResponse,
  StreamChunk,
  ContentType,
  StreamState
} from '../../types/transformer'

import {
  FINISH_REASON_MAPPING,
  MESSAGE_ID_PREFIX,
  DEFAULT_STOP_REASON
} from '../../constants/transformer'

export class ClaudeToOpenAITransformer {
  name = "ClaudeToOpenAI"

  /**
   * 转换 Claude 请求为 OpenAI 格式
   */
  transformRequestOut(request: ClaudeRequest): OpenAIChatRequest {
    const messages: OpenAIMessage[] = []

    // 处理系统消息
    this.addSystemMessage(messages, request.system)

    // 处理对话消息
    if (request.messages) {
      this.addChatMessages(messages, request.messages)
    }

    return {
      messages,
      model: request.model,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: request.stream,
      tools: request.tools
          ? this.convertAnthropicToolsToUnified(request.tools)
          : undefined,
      tool_choice: request.tool_choice,
    }
  }

  /**
   * 添加系统消息
   */
  private addSystemMessage(messages: OpenAIMessage[], system?: string | ContentBlock[]): void {
    if (!system) return

    if (typeof system === 'string') {
      messages.push({
        role: 'system',
        content: system,
      })
    } else if (Array.isArray(system) && system.length) {
      const textParts = system
        .filter((item): item is ContentBlock => item.type === 'text' && Boolean(item.text))
        .map((item) => ({
          type: 'text' as const,
          text: item.text!,
          cache_control: item.cache_control,
        }))
      
      if (textParts.length) {
        messages.push({
          role: 'system',
          content: textParts,
        })
      }
    }
  }

  /**
   * 添加对话消息
   */
  private addChatMessages(messages: OpenAIMessage[], chatMessages: ClaudeMessage[]): void {
    // 深拷贝防止修改原始数据
    const requestMessages = JSON.parse(JSON.stringify(chatMessages))

    requestMessages.forEach((msg: ClaudeMessage) => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          messages.push({
            role: msg.role,
            content: msg.content,
          })
          return
        }

        if (Array.isArray(msg.content)) {
          if (msg.role === 'user') {
            this.processUserMessage(messages, msg.content)
          } else if (msg.role === 'assistant') {
            this.processAssistantMessage(messages, msg.content)
          }
        }
      }
    })
  }

  /**
   * 处理用户消息
   */
  private processUserMessage(messages: OpenAIMessage[], content: ContentBlock[]): void {
    // 处理工具结果
    const toolParts = content.filter(
      (c): c is ContentBlock => c.type === 'tool_result' && Boolean(c.tool_use_id)
    )
    
    toolParts.forEach((tool) => {
      const toolMessage: OpenAIMessage = {
        role: 'tool',
        content:
          typeof tool.content === 'string'
            ? tool.content
            : JSON.stringify(tool.content),
        tool_call_id: tool.tool_use_id,
        cache_control: tool.cache_control,
      }
      messages.push(toolMessage)
    })

    // 处理文本和媒体内容
    const textAndMediaParts = content.filter(
      (c): c is ContentBlock =>
        (c.type === 'text' && Boolean(c.text)) ||
        (c.type === 'image' && Boolean(c.source))
    )
    
    if (textAndMediaParts.length) {
      messages.push({
        role: 'user',
        content: textAndMediaParts.map((part) => {
          if (part.type === 'image' && part.source) {
            return {
              type: 'image_url' as ContentType,
              image_url: {
                url:
                  part.source.type === 'base64'
                    ? part.source.data
                    : 'url' in part.source ? part.source.url : '',
              },
              media_type: 'media_type' in part.source ? part.source.media_type : undefined,
            }
          }
          return part
        }),
      })
    }
  }

  /**
   * 处理助手消息
   */
  private processAssistantMessage(messages: OpenAIMessage[], content: ContentBlock[]): void {
    const assistantMessage: OpenAIMessage = {
      role: 'assistant',
      content: '',
    }

    // 处理文本内容
    const textParts = content.filter(
      (c): c is ContentBlock => c.type === 'text' && Boolean(c.text)
    )
    
    if (textParts.length) {
      assistantMessage.content = textParts
        .map((text) => text.text!)
        .join('\n')
    }

    // 处理工具调用
    const toolCallParts = content.filter(
      (c): c is ContentBlock => c.type === 'tool_use' && Boolean(c.id)
    )
    
    if (toolCallParts.length) {
      assistantMessage.tool_calls = toolCallParts.map((tool): OpenAIToolCall => ({
        id: tool.id!,
        type: 'function',
        function: {
          name: tool.name!,
          arguments: JSON.stringify(tool.input || {}),
        },
      }))
    }
    
    messages.push(assistantMessage)
  }

  /**
   * 转换 OpenAI 非流式响应为 Claude 格式
   */
  async transformResponseIn(openaiResponse: OpenAIResponse): Promise<Record<string, unknown>> {
    if (!openaiResponse.choices || openaiResponse.choices.length === 0) {
      throw new Error('Invalid OpenAI response: no choices found')
    }
    
    const choice = openaiResponse.choices[0]
    if (!choice.message) {
      throw new Error('Invalid OpenAI response: no message in choice')
    }

    const content: any[] = []

    // 处理文本内容
    if (choice.message.content) {
      content.push({
        type: 'text',
        text: choice.message.content,
      })
    }

    // 处理工具调用
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      choice.message.tool_calls.forEach((toolCall: any) => {
        let parsedInput: Record<string, unknown>
        try {
          const argumentsStr = toolCall.function.arguments || '{}'
          if (typeof argumentsStr === 'object') {
            parsedInput = argumentsStr as Record<string, unknown>
          } else {
            parsedInput = JSON.parse(argumentsStr) as Record<string, unknown>
          }
        } catch (parseError) {
          console.warn('Failed to parse tool arguments:', parseError)
          parsedInput = { text: toolCall.function.arguments || '' }
        }

        content.push({
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.function.name,
          input: parsedInput,
        })
      })
    }

    return {
      id: openaiResponse.id,
      type: 'message',
      role: 'assistant',
      model: openaiResponse.model,
      content: content,
      stop_reason: choice.finish_reason 
        ? FINISH_REASON_MAPPING[choice.finish_reason] || DEFAULT_STOP_REASON
        : DEFAULT_STOP_REASON,
      stop_sequence: null,
      usage: {
        input_tokens: openaiResponse.usage?.prompt_tokens || 0,
        output_tokens: openaiResponse.usage?.completion_tokens || 0,
      },
    }
  }

  /**
   * 转换 OpenAI 流式响应为 Claude 格式
   */
  async convertStreamToClaudeFormat(openaiStream: ReadableStream): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    return new ReadableStream({
      async start(controller) {
        const reader = openaiStream.getReader()
        const messageId = `${MESSAGE_ID_PREFIX}${Date.now()}`
        let streamState = {
          hasStarted: false,
          hasTextContentStarted: false,
          buffer: '',
          isCompleted: false
        }

        const safeEnqueue = (data: string): boolean => {
          if (streamState.isCompleted) {
            console.warn('Attempted to enqueue data after stream completion')
            return false
          }
          try {
            controller.enqueue(encoder.encode(data))
            return true
          } catch (error) {
            console.warn('Stream enqueue failed:', error)
            return false
          }
        }

        const closeStream = () => {
          if (!streamState.isCompleted) {
            streamState.isCompleted = true
            try {
              safeEnqueue('event: message_stop\ndata: {"type":"message_stop"}\n\n')
              controller.close()
            } catch (error) {
              console.warn('Failed to close stream gracefully:', error)
            }
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            streamState.buffer += decoder.decode(value, { stream: true })
            const lines = streamState.buffer.split('\n')
            streamState.buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue

              const data = line.slice(6)
              if (data === '[DONE]') {
                closeStream()
                return
              }

              try {
                const chunk: StreamChunk = JSON.parse(data)
                const choice = chunk.choices?.[0]
                if (!choice) continue

                // 发送开始事件
                if (!streamState.hasStarted) {
                  streamState.hasStarted = true
                  const messageStart = {
                    type: 'message_start',
                    message: {
                      id: messageId,
                      type: 'message',
                      role: 'assistant',
                      content: [],
                      model: chunk.model || 'unknown',
                      stop_reason: null,
                      stop_sequence: null,
                      usage: { input_tokens: 1, output_tokens: 1 },
                    },
                  }
                  if (!safeEnqueue(`event: message_start\\ndata: ${JSON.stringify(messageStart)}\\n\\n`)) {
                    return
                  }
                }

                // 处理文本内容
                if (choice.delta?.content) {
                  if (!streamState.hasTextContentStarted) {
                    streamState.hasTextContentStarted = true
                    const contentBlockStart = {
                      type: 'content_block_start',
                      index: 0,
                      content_block: { type: 'text', text: '' },
                    }
                    if (!safeEnqueue(`event: content_block_start\\ndata: ${JSON.stringify(contentBlockStart)}\\n\\n`)) {
                      return
                    }
                  }

                  const contentDelta = {
                    type: 'content_block_delta',
                    index: 0,
                    delta: { type: 'text_delta', text: choice.delta.content },
                  }
                  if (!safeEnqueue(`event: content_block_delta\\ndata: ${JSON.stringify(contentDelta)}\\n\\n`)) {
                    return
                  }
                }

                // 处理结束
                if (choice.finish_reason) {
                  if (streamState.hasTextContentStarted) {
                    const contentBlockStop = {
                      type: 'content_block_stop',
                      index: 0,
                    }
                    if (!safeEnqueue(`event: content_block_stop\\ndata: ${JSON.stringify(contentBlockStop)}\\n\\n`)) {
                      return
                    }
                  }

                  const messageDelta = {
                    type: 'message_delta',
                    delta: {
                      stop_reason: FINISH_REASON_MAPPING[choice.finish_reason] || DEFAULT_STOP_REASON,
                      stop_sequence: null,
                    },
                    usage: {
                      input_tokens: chunk.usage?.prompt_tokens || 0,
                      output_tokens: chunk.usage?.completion_tokens || 0,
                    },
                  }
                  
                  safeEnqueue(`event: message_delta\\ndata: ${JSON.stringify(messageDelta)}\\n\\n`)
                  closeStream()
                  return
                }
              } catch (parseError) {
                console.warn('Stream parse error for line:', line, parseError)
              }
            }
          }

          closeStream()
        } catch (error) {
          console.error('Stream processing error:', error)
          try {
            controller.error(error)
          } catch (controllerError) {
            console.error('Controller error handling failed:', controllerError)
          }
        } finally {
          try {
            reader.releaseLock()
          } catch (releaseError) {
            console.warn('Failed to release reader lock:', releaseError)
          }
        }
      }
    })
  }


  private convertAnthropicToolsToUnified(tools: ClaudeTool[]): OpenAITool[] {
    return tools.map((tool): OpenAITool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.input_schema,
      },
    }))
  }
}
