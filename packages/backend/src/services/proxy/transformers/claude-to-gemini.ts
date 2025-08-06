/**
 * Claude to Gemini 转换器 - 重构版本
 * 完全重构为 processRequest 模式，直接完成请求转换 -> 调用 -> 响应转换
 * 充分利用 @google/genai SDK 的特性，大幅简化逻辑
 */

import type { Transformer } from './base-transformer'
import { logClaudeRequest, logProviderRequest, logProviderResponse, logClaudeResponse } from './base-transformer'
import type { 
  MessageCreateParamsBase,
  Message,
  MessageParam,
  TextBlockParam,
  ImageBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
  Tool as ClaudeTool,
  Usage,
  StopReason
} from '@anthropic-ai/sdk/resources/messages'
import { GoogleGenAI } from '@google/genai'
import type {
  GenerateContentResponse,
  GenerateContentConfig,
  Content,
  Part,
  FunctionDeclaration,
  Tool,
  ToolConfig
} from '@google/genai'

export class ClaudeToGeminiTransformer implements Transformer {
  private client: GoogleGenAI | null = null
  // 维护 tool_use_id 到函数名的映射关系
  private toolUseIdToFunctionName: Map<string, string> = new Map()

  /**
   * 初始化 Gemini 客户端
   */
  public initializeClient(apiKey: string): void {
    this.client = new GoogleGenAI({ apiKey })
  }

  /**
   * 获取客户端实例
   */
  private getClient(): GoogleGenAI {
    if (!this.client) {
      throw new Error('Gemini client not initialized. Call initializeClient() first.')
    }
    return this.client
  }

  /**
   * 主要转换方法 - 直接调用 SDK 并转换响应
   */
  async processRequest(claudeRequest: MessageCreateParamsBase, model: string): Promise<Message | ReadableStream> {
    const client = this.getClient()
    
    // 记录原始 Claude 请求
    logClaudeRequest(claudeRequest)
    
    const geminiParams = this.buildGeminiParams(claudeRequest, model)
    
    // 记录转换后的 Gemini 请求
    logProviderRequest('Gemini', `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, geminiParams)

    if (claudeRequest.stream) {
      // 流式响应
      const streamResponse = await client.models.generateContentStream(geminiParams)
      
      // 记录 Gemini 流式响应
      logProviderResponse('Gemini', streamResponse)
      
      const transformedStream = await this.transformStreamResponse(streamResponse)
      
      // 记录转换后的 Claude 流式响应
      logClaudeResponse(transformedStream)
      
      return transformedStream
    } else {
      // 非流式响应
      const response = await client.models.generateContent(geminiParams)
      
      // 记录 Gemini 响应
      logProviderResponse('Gemini', response)
      
      const claudeResponse = this.transformNormalResponse(response)
      
      // 记录转换后的 Claude 响应
      logClaudeResponse(claudeResponse)
      
      return claudeResponse
    }
  }

  /**
   * 构建 Gemini API 参数 - 简化版本
   */
  private buildGeminiParams(claudeRequest: MessageCreateParamsBase, model: string) {
    const config: GenerateContentConfig = {}
    
    // 基础配置
    if (claudeRequest.max_tokens) config.maxOutputTokens = claudeRequest.max_tokens
    if (claudeRequest.temperature !== undefined) config.temperature = claudeRequest.temperature
    if (claudeRequest.top_p !== undefined) config.topP = claudeRequest.top_p
    if (claudeRequest.top_k !== undefined) config.topK = claudeRequest.top_k
    if (claudeRequest.stop_sequences) config.stopSequences = claudeRequest.stop_sequences

    // 系统指令
    if (claudeRequest.system) {
      config.systemInstruction = typeof claudeRequest.system === 'string' 
        ? claudeRequest.system 
        : this.extractTextFromContent(claudeRequest.system)
    }

    // 工具配置
    if (claudeRequest.tools?.length) {
      config.tools = this.transformTools(claudeRequest.tools as ClaudeTool[])
      if (claudeRequest.tool_choice) {
        config.toolConfig = this.transformToolChoice(claudeRequest.tool_choice)
      }
    }

    return {
      model,
      contents: claudeRequest.messages ? this.transformMessages(claudeRequest.messages) : [],
      config
    }
  }

  /**
   * 转换消息 - 简化版本
   */
  private transformMessages(messages: MessageParam[]): Content[] {
    const contents: Content[] = []
    let currentContent: Content | null = null

    for (const message of messages) {
      const role = message.role === 'assistant' ? 'model' : 'user'
      const parts = this.transformMessageContent(message.content)

      // 合并连续的同角色消息
      if (!currentContent || currentContent.role !== role) {
        if (currentContent) contents.push(currentContent)
        currentContent = { role, parts }
      } else {
        if (currentContent.parts) {
          currentContent.parts.push(...parts)
        }
      }
    }

    if (currentContent) contents.push(currentContent)
    return contents
  }

  /**
   * 转换消息内容 - 简化版本
   */
  private transformMessageContent(content: string | Array<any>): Part[] {
    const parts: Part[] = []

    if (typeof content === 'string') {
      parts.push({ text: content })
    } else if (Array.isArray(content)) {
      for (const item of content) {
        switch (item.type) {
          case 'text':
            parts.push({ text: (item as TextBlockParam).text })
            break
          case 'image':
            const imageBlock = item as ImageBlockParam
            if (imageBlock.source.type === 'base64') {
              parts.push({
                inlineData: {
                  mimeType: imageBlock.source.media_type,
                  data: imageBlock.source.data
                }
              })
            }
            break
          case 'tool_use':
            const toolUseBlock = item as ToolUseBlockParam
            this.toolUseIdToFunctionName.set(toolUseBlock.id, toolUseBlock.name)
            parts.push({
              functionCall: {
                name: toolUseBlock.name,
                args: (toolUseBlock.input as Record<string, unknown>) || {}
              }
            })
            break
          case 'tool_result':
            const toolResultBlock = item as ToolResultBlockParam
            const functionName = this.toolUseIdToFunctionName.get(toolResultBlock.tool_use_id) || 'unknown_function'
            parts.push({
              functionResponse: {
                name: functionName,
                response: {
                  result: typeof toolResultBlock.content === 'string' 
                    ? toolResultBlock.content 
                    : JSON.stringify(toolResultBlock.content)
                }
              }
            })
            break
        }
      }
    }

    return parts
  }

  /**
   * 转换工具定义 - 简化版本
   */
  private transformTools(tools: ClaudeTool[]): Tool[] {
    const functionDeclarations: FunctionDeclaration[] = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: this.cleanupParameters(tool.input_schema)
    }))

    return [{ functionDeclarations }]
  }

  /**
   * 转换工具选择策略 - 简化版本
   */
  private transformToolChoice(toolChoice: MessageCreateParamsBase['tool_choice']): ToolConfig {
    if (typeof toolChoice === 'string') {
      const mode = toolChoice === 'auto' ? 'AUTO' 
                 : toolChoice === 'none' ? 'NONE' 
                 : 'ANY'
      return { functionCallingConfig: { mode: mode as any } }
    }
    
    if (toolChoice && typeof toolChoice === 'object') {
      if (toolChoice.type === 'tool' && 'name' in toolChoice) {
        return {
          functionCallingConfig: {
            mode: 'ANY' as any,
            allowedFunctionNames: [toolChoice.name]
          }
        }
      }
      const mode = toolChoice.type === 'auto' ? 'AUTO' : 'ANY'
      return { functionCallingConfig: { mode: mode as any } }
    }
    
    return { functionCallingConfig: { mode: 'AUTO' as any } }
  }

  /**
   * 转换非流式响应 - 利用 SDK 的访问器简化
   */
  private transformNormalResponse(response: GenerateContentResponse): Message {
    return {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      model: response.modelVersion || 'gemini',
      content: this.extractContentFromResponse(response),
      stop_reason: this.mapFinishReason(response.candidates?.[0]?.finishReason || null),
      stop_sequence: null,
      usage: this.buildUsageStats(response.usageMetadata)
    }
  }

  /**
   * 从响应中提取内容 - 利用 SDK 简化
   */
  private extractContentFromResponse(response: GenerateContentResponse): any[] {
    const content: any[] = []
    
    // 利用 SDK 的 text 访问器
    if (response.text) {
      content.push({ type: 'text', text: response.text })
    }

    // 处理函数调用
    const candidate = response.candidates?.[0]
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          const toolUseId = this.generateToolUseId()
          if (part.functionCall.name) {
            this.toolUseIdToFunctionName.set(toolUseId, part.functionCall.name)
            content.push({
              type: 'tool_use',
              id: toolUseId,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            })
          }
        }
      }
    }

    return content
  }

  /**
   * 转换流式响应 - 大幅简化
   */
  private async transformStreamResponse(streamResponse: AsyncGenerator<GenerateContentResponse>): Promise<ReadableStream> {
    const encoder = new TextEncoder()
    const self = this
    
    return new ReadableStream({
      async start(controller) {
        let messageStarted = false
        let contentIndex = 0

        try {
          for await (const chunk of streamResponse) {
            // 发送 message_start
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

            // 利用 SDK 的 text 访问器简化文本处理
            if (chunk.text) {
              // 开始内容块
              controller.enqueue(encoder.encode(self.createSSEEvent('content_block_start', {
                type: 'content_block_start',
                index: contentIndex,
                content_block: { type: 'text', text: '' }
              })))

              // 发送文本增量
              controller.enqueue(encoder.encode(self.createSSEEvent('content_block_delta', {
                type: 'content_block_delta',
                index: contentIndex,
                delta: { type: 'text_delta', text: chunk.text }
              })))

              // 结束内容块
              controller.enqueue(encoder.encode(self.createSSEEvent('content_block_stop', {
                type: 'content_block_stop',
                index: contentIndex
              })))
              contentIndex++
            }

            // 处理结束
            if (chunk.candidates?.[0]?.finishReason) {
              controller.enqueue(encoder.encode(self.createSSEEvent('message_delta', {
                type: 'message_delta',
                delta: {
                  stop_reason: self.mapFinishReason(chunk.candidates[0].finishReason),
                  stop_sequence: null
                },
                usage: chunk.usageMetadata ? {
                  output_tokens: chunk.usageMetadata.candidatesTokenCount || 0
                } : undefined
              })))
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
        }
      }
    })
  }

  /**
   * 构建使用统计 - 简化版本
   */
  private buildUsageStats(usageMetadata?: any): Usage {
    return {
      input_tokens: usageMetadata?.promptTokenCount || 0,
      output_tokens: usageMetadata?.candidatesTokenCount || 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: usageMetadata?.cachedContentTokenCount || null,
      server_tool_use: null,
      service_tier: null
    }
  }

  /**
   * 映射完成原因
   */
  private mapFinishReason(reason: string | null): StopReason {
    if (!reason) return 'end_turn'
    
    const mapping: Record<string, StopReason> = {
      'STOP': 'end_turn',
      'MAX_TOKENS': 'max_tokens',
      'SAFETY': 'end_turn',
      'RECITATION': 'end_turn',
      'OTHER': 'end_turn'
    }
    
    return mapping[reason] || 'end_turn'
  }

  /**
   * 生成唯一的 tool_use_id
   */
  private generateToolUseId(): string {
    return `toolu_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * 清理参数定义
   */
  private cleanupParameters(params: any): any {
    if (!params || typeof params !== 'object') return params
    
    const cleaned = JSON.parse(JSON.stringify(params))
    this.removeUnsupportedProperties(cleaned)
    return cleaned
  }

  /**
   * 递归移除不支持的属性
   */
  private removeUnsupportedProperties(obj: any): void {
    if (!obj || typeof obj !== 'object') return
    
    if (Array.isArray(obj)) {
      obj.forEach(item => this.removeUnsupportedProperties(item))
      return
    }

    // 移除 Gemini 不支持的属性
    delete obj.$schema
    delete obj.additionalProperties
    delete obj.const

    // 处理 format 属性 - Gemini 对 STRING 类型只支持 'enum' 和 'date-time'
    if (obj.type === 'string' && obj.format) {
      const supportedFormats = ['enum', 'date-time']
      if (!supportedFormats.includes(obj.format)) {
        delete obj.format
      }
    }

    // 递归处理子属性
    Object.values(obj).forEach(value => this.removeUnsupportedProperties(value))
  }

  /**
   * 从复合内容中提取文本
   */
  private extractTextFromContent(content: Array<TextBlockParam | ImageBlockParam>): string {
    return content
      .filter((item): item is TextBlockParam => item.type === 'text')
      .map(item => item.text)
      .join('\n')
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.toolUseIdToFunctionName.clear()
  }

  /**
   * 创建 SSE 事件格式
   */
  private createSSEEvent(event: string, data: Record<string, any>): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  }

}