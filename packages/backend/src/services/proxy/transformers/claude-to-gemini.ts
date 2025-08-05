/**
 * Claude to Gemini 转换器
 * 支持完整的消息转换、函数调用和流式响应
 */

import { AbstractTransformer } from './base-transformer'
import type { 
  MessageCreateParamsBase,
  Message,
  MessageParam,
  TextBlockParam,
  ImageBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
  Tool as ClaudeTool,
  ToolChoiceTool,
  Usage,
  StopReason
} from '@anthropic-ai/sdk/resources/messages'
import type {
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  FunctionDeclaration,
  Tool,
  ToolConfig,
  GenerateContentRequest
} from '@google/generative-ai'

export class ClaudeToGeminiTransformer extends AbstractTransformer {
  // 维护 tool_use_id 到函数名的映射关系
  private toolUseIdToFunctionName: Map<string, string> = new Map()
  /**
   * 转换 Claude 请求为 Gemini 格式
   */
  transformRequest(claudeRequest: MessageCreateParamsBase): GenerateContentRequest {
    const geminiRequest: GenerateContentRequest = {
      contents: [],
      generationConfig: {}
    }

    // 处理系统消息
    if (claudeRequest.system) {
      const systemText = typeof claudeRequest.system === 'string' 
        ? claudeRequest.system 
        : this.extractTextFromContent(claudeRequest.system)
      geminiRequest.systemInstruction = systemText
    }

    // 转换消息，合并连续的同角色消息
    if (claudeRequest.messages) {
      const mergedContents = this.mergeConsecutiveMessages(claudeRequest.messages)
      geminiRequest.contents = mergedContents
    }

    // 处理工具定义
    if (claudeRequest.tools && claudeRequest.tools.length > 0) {
      geminiRequest.tools = this.transformTools(claudeRequest.tools as ClaudeTool[])
    }

    // 处理工具选择策略
    if (claudeRequest.tool_choice) {
      // Gemini 使用 toolConfig 来控制工具使用
      geminiRequest.toolConfig = this.transformToolChoice(claudeRequest.tool_choice)
    }

    // 转换生成配置
    if (!geminiRequest.generationConfig) {
      geminiRequest.generationConfig = {}
    }
    
    // 设置 maxOutputTokens（可选参数）
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
  async transformResponse(geminiResponse: Record<string, any>, isStream: boolean): Promise<Message | ReadableStream> {
    if (isStream) {
      // 对于流式响应，geminiResponse 应该是 ReadableStream
      return this.transformStreamResponse(geminiResponse as unknown as ReadableStream)
    }
    return this.transformNormalResponse(geminiResponse)
  }

  /**
   * 合并连续的同角色消息
   * Gemini 要求严格的 user/model 交替，需要合并连续的同角色消息
   */
  private mergeConsecutiveMessages(messages: MessageParam[]): Content[] {
    const contents: Content[] = []
    let currentContent: Content | null = null

    for (const message of messages) {
      const geminiContent = this.transformMessage(message)
      
      // 如果当前内容为空或角色不同，创建新的内容
      if (!currentContent || currentContent.role !== geminiContent.role) {
        if (currentContent) {
          contents.push(currentContent)
        }
        currentContent = geminiContent
      } else {
        // 合并同角色的消息部分
        currentContent.parts.push(...geminiContent.parts)
      }
    }

    // 添加最后一个内容
    if (currentContent) {
      contents.push(currentContent)
    }

    return contents
  }

  /**
   * 转换单个消息
   */
  private transformMessage(message: MessageParam): Content {
    const role = message.role === 'assistant' ? 'model' : 'user'
    const parts: Part[] = []

    if (typeof message.content === 'string') {
      parts.push({ text: message.content })
    } else if (Array.isArray(message.content)) {
      for (const content of message.content) {
        if (content.type === 'text') {
          const textBlock = content as TextBlockParam
          parts.push({ text: textBlock.text })
        } else if (content.type === 'image') {
          const imageBlock = content as ImageBlockParam
          // 处理 base64 图片
          if (imageBlock.source.type === 'base64') {
            parts.push({
              inlineData: {
                mimeType: imageBlock.source.media_type,
                data: imageBlock.source.data
              }
            })
          }
          // 处理 URL 图片（Gemini 不直接支持 URL，需要转换）
          else if (imageBlock.source.type === 'url') {
            // 注意：Gemini API 不直接支持 URL 图片，这里需要额外处理
            // 可以选择下载图片并转换为 base64，或者使用 Gemini 的 fileData 格式
            // 这里暂时简单处理，实际使用时可能需要完善
            parts.push({
              text: `[Image: ${imageBlock.source.url}]`
            })
          }
        } else if (content.type === 'tool_use') {
          const toolUseBlock = content as ToolUseBlockParam
          // 记录 tool_use_id 到函数名的映射关系
          this.toolUseIdToFunctionName.set(toolUseBlock.id, toolUseBlock.name)
          // 转换 Claude 的 tool_use 为 Gemini 的 functionCall
          const functionCall: FunctionCall = {
            name: toolUseBlock.name,
            args: (toolUseBlock.input as object) || {}
          }
          parts.push({ functionCall })
        } else if (content.type === 'tool_result') {
          const toolResultBlock = content as ToolResultBlockParam
          // 转换 Claude 的 tool_result 为 Gemini 的 functionResponse
          // 注意：Gemini 的 functionResponse 需要匹配之前的 functionCall 名称
          // 这里我们从 tool_use_id 中提取函数名（如果可能）
          const functionName = this.extractFunctionNameFromToolUseId(toolResultBlock.tool_use_id)
          const functionResponse: FunctionResponse = {
            name: functionName,
            response: {
              result: typeof toolResultBlock.content === 'string' 
                ? toolResultBlock.content 
                : JSON.stringify(toolResultBlock.content)
            }
          }
          parts.push({ functionResponse })
        }
      }
    }

    return { role, parts }
  }

  /**
   * 从 tool_use_id 提取函数名
   * 使用维护的映射表获取真实的函数名
   */
  private extractFunctionNameFromToolUseId(toolUseId: string): string {
    const functionName = this.toolUseIdToFunctionName.get(toolUseId)
    if (functionName) {
      return functionName
    }
    
    // 如果找不到映射关系，记录警告并返回占位符
    console.warn(`Warning: No function name found for tool_use_id: ${toolUseId}. This may cause issues with Gemini API.`)
    return 'unknown_function_' + toolUseId
  }

  /**
   * 清理映射表
   * 在 Serverless 环境中，通常在请求完成后清理以释放内存
   */
  public clearFunctionNameMapping(): void {
    this.toolUseIdToFunctionName.clear()
  }

  /**
   * 转换工具定义
   */
  private transformTools(tools: ClaudeTool[]): Tool[] {
    const functionDeclarations: FunctionDeclaration[] = []

    for (const tool of tools) {
      // Claude SDK 的 Tool 类型定义了 name、description 和 input_schema
      // 清理参数中的特定字段，Gemini 不支持某些 JSON Schema 属性
      const cleanedParameters = this.cleanupParameters(tool.input_schema)
      
      functionDeclarations.push({
        name: tool.name,
        description: tool.description,
        parameters: cleanedParameters
      })
    }

    // Gemini 的工具格式
    return [{
      functionDeclarations
    } as Tool]
  }

  /**
   * 清理参数定义，移除 Gemini 不支持的属性
   */
  private cleanupParameters(params: any): any {
    if (!params || typeof params !== 'object') {
      return params
    }

    const cleaned = JSON.parse(JSON.stringify(params)) // 深拷贝
    this.cleanupParametersRecursive(cleaned)
    return cleaned
  }

  /**
   * 递归清理参数
   */
  private cleanupParametersRecursive(obj: any): void {
    if (!obj || typeof obj !== 'object') {
      return
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => this.cleanupParametersRecursive(item))
      return
    }

    // 移除 Gemini 不支持的 JSON Schema 属性
    delete obj.$schema
    delete obj.additionalProperties
    delete obj.const

    // 处理特定的 format 属性
    if (obj.type === 'string' && obj.format && !['enum', 'date-time'].includes(obj.format)) {
      delete obj.format
    }

    // 递归处理所有子属性
    Object.keys(obj).forEach(key => {
      this.cleanupParametersRecursive(obj[key])
    })
  }

  /**
   * 转换工具选择策略
   */
  private transformToolChoice(toolChoice: MessageCreateParamsBase['tool_choice']): ToolConfig {
    // Gemini 的 ToolConfig 使用 functionCallingConfig
    if (typeof toolChoice === 'string') {
      switch (toolChoice) {
        case 'auto':
          return {
            functionCallingConfig: {
              mode: 'AUTO'
            }
          } as ToolConfig
        case 'none':
          return {
            functionCallingConfig: {
              mode: 'NONE'
            }
          } as ToolConfig
        case 'required':
        case 'any':
          return {
            functionCallingConfig: {
              mode: 'ANY'
            }
          } as ToolConfig
        default:
          // 如果是特定工具名称
          return {
            functionCallingConfig: {
              mode: 'ANY',
              allowedFunctionNames: [toolChoice]
            }
          } as ToolConfig
      }
    } else if (toolChoice && typeof toolChoice === 'object') {
      // Claude 的特定工具选择格式
      if (toolChoice.type === 'tool' && 'name' in toolChoice) {
        const toolChoiceTool = toolChoice as ToolChoiceTool
        return {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [toolChoiceTool.name]
          }
        } as ToolConfig
      } else if (toolChoice.type === 'any') {
        return {
          functionCallingConfig: {
            mode: 'ANY'
          }
        } as ToolConfig
      } else if (toolChoice.type === 'auto') {
        return {
          functionCallingConfig: {
            mode: 'AUTO'
          }
        } as ToolConfig
      }
    }
    
    // 默认为 AUTO
    return {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    } as ToolConfig
  }

  /**
   * 转换非流式响应
   */
  private transformNormalResponse(geminiResponse: Record<string, any>): Message {
    if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
      throw new Error('Invalid Gemini response: no candidates found')
    }

    const candidate = geminiResponse.candidates[0]
    const content: any[] = []

    // 处理响应内容
    if (candidate.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          // 文本内容
          content.push({
            type: 'text',
            text: part.text
          })
        } else if (part.functionCall) {
          // 函数调用
          const toolUseId = this.generateToolUseId()
          // 记录反向映射关系（Gemini → Claude 转换）
          this.toolUseIdToFunctionName.set(toolUseId, part.functionCall.name)
          content.push({
            type: 'tool_use',
            id: toolUseId,
            name: part.functionCall.name,
            input: part.functionCall.args || {}
          })
        }
        // 注意：functionResponse 通常不会出现在模型的响应中
        // 它是用户提供的函数执行结果
      }
    }

    // 构建 Usage 对象
    const usage: Usage = {
      input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      server_tool_use: null,
      service_tier: null
    }
    
    // 如果有缓存的 token 计数，更新 usage
    if (geminiResponse.usageMetadata?.cachedContentTokenCount) {
      usage.cache_creation_input_tokens = 0;
      usage.cache_read_input_tokens = geminiResponse.usageMetadata.cachedContentTokenCount
    }

    // 构建 Claude 格式的响应
    const response: Message = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: geminiResponse.modelVersion || 'gemini',
      content: content,
      stop_reason: this.mapFinishReason(candidate.finishReason),
      stop_sequence: null,
      usage: usage
    }

    return response
  }

  /**
   * 生成唯一的 tool_use_id
   */
  private generateToolUseId(): string {
    return `toolu_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * 转换流式响应
   */
  private async transformStreamResponse(geminiStream: ReadableStream): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const self = this

    return new ReadableStream({
      async start(controller) {
        const reader = geminiStream.getReader()
        let buffer = ''
        let messageStarted = false
        let contentIndex = 0
        let currentContentType: 'text' | 'tool_use' | null = null
        let accumulatedText = ''
        let currentToolUseId: string | null = null

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
                  if (part.text !== undefined) {
                    // 处理文本内容
                    if (currentContentType !== 'text') {
                      // 如果之前是工具调用，先结束它
                      if (currentContentType === 'tool_use' && currentToolUseId) {
                        controller.enqueue(encoder.encode(self.createSSEEvent('content_block_stop', {
                          type: 'content_block_stop',
                          index: contentIndex
                        })))
                        contentIndex++
                      }
                      
                      // 开始新的文本块
                      controller.enqueue(encoder.encode(self.createSSEEvent('content_block_start', {
                        type: 'content_block_start',
                        index: contentIndex,
                        content_block: { type: 'text', text: '' }
                      })))
                      currentContentType = 'text'
                      accumulatedText = ''
                    }

                    // 发送文本增量
                    controller.enqueue(encoder.encode(self.createSSEEvent('content_block_delta', {
                      type: 'content_block_delta',
                      index: contentIndex,
                      delta: { type: 'text_delta', text: part.text }
                    })))

                    accumulatedText += part.text
                  } else if ('functionCall' in part && part.functionCall) {
                    // 处理函数调用
                    if (currentContentType === 'text' && accumulatedText) {
                      // 如果之前是文本，先结束它
                      controller.enqueue(encoder.encode(self.createSSEEvent('content_block_stop', {
                        type: 'content_block_stop',
                        index: contentIndex
                      })))
                      contentIndex++
                    }

                    // 生成 tool_use_id
                    currentToolUseId = self.generateToolUseId()
                    // 记录反向映射关系（Gemini → Claude 转换）
                    self.toolUseIdToFunctionName.set(currentToolUseId, part.functionCall.name)
                    
                    // 开始工具使用块
                    controller.enqueue(encoder.encode(self.createSSEEvent('content_block_start', {
                      type: 'content_block_start',
                      index: contentIndex,
                      content_block: {
                        type: 'tool_use',
                        id: currentToolUseId,
                        name: part.functionCall.name,
                        input: {}
                      }
                    })))

                    // 发送工具输入
                    if (part.functionCall.args) {
                      controller.enqueue(encoder.encode(self.createSSEEvent('content_block_delta', {
                        type: 'content_block_delta',
                        index: contentIndex,
                        delta: {
                          type: 'input_json_delta',
                          partial_json: JSON.stringify(part.functionCall.args)
                        }
                      })))
                    }

                    currentContentType = 'tool_use'
                  }
                }
              }

              // 处理结束原因和使用统计
              if (chunk.candidates?.[0]?.finishReason) {
                // 结束当前内容块
                if (currentContentType === 'text' || currentContentType === 'tool_use') {
                  controller.enqueue(encoder.encode(self.createSSEEvent('content_block_stop', {
                    type: 'content_block_stop',
                    index: contentIndex
                  })))
                }

                // 发送消息增量（包含结束原因和使用统计）
                const messageDelta: any = {
                  type: 'message_delta',
                  delta: {
                    stop_reason: self.mapFinishReason(chunk.candidates[0].finishReason),
                    stop_sequence: null
                  }
                }

                // 添加使用统计
                if (chunk.usageMetadata) {
                  messageDelta.usage = {
                    output_tokens: chunk.usageMetadata.candidatesTokenCount || 0
                  }
                  
                  // 如果有缓存的 token
                  if (chunk.usageMetadata.cachedContentTokenCount) {
                    messageDelta.usage.cache_creation_input_tokens = 0
                    messageDelta.usage.cache_read_input_tokens = chunk.usageMetadata.cachedContentTokenCount
                  }
                }

                controller.enqueue(encoder.encode(self.createSSEEvent('message_delta', messageDelta)))
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
  private mapFinishReason(reason: string | null): StopReason {
    if (!reason) return 'end_turn'
    
    const mapping: Record<string, StopReason> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'end_turn', // Gemini 的 SAFETY 映射到 end_turn，因为 Claude 没有 content_filter 
      'RECITATION': 'end_turn', // 同上
      'OTHER': 'end_turn'
    }
    
    return mapping[reason] || 'end_turn'
  }

  /**
   * 从复杂内容中提取文本
   */
  private extractTextFromContent(content: Array<TextBlockParam | ImageBlockParam>): string {
    return content
      .filter((item): item is TextBlockParam => item.type === 'text')
      .map(item => item.text)
      .join('\n')
  }
}