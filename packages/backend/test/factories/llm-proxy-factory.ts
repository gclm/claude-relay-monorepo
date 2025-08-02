import type { ModelProvider } from '../../../../shared/types/admin/providers'
import type { ClaudeRequest } from '../../src/types/proxy'
import type { ApiKey } from '../../../../shared/types/key-pool'

/**
 * LLM 代理测试数据工厂
 * 集中管理 LLM 代理相关的测试数据创建
 */
export class LLMProxyTestFactory {
  /**
   * 创建 Claude 请求
   */
  static createClaudeRequest(overrides: Partial<ClaudeRequest> = {}): ClaudeRequest {
    return {
      model: 'claude-3-opus-20240229',
      messages: [
        { role: 'user', content: 'Hello!' }
      ],
      stream: false,
      ...overrides
    }
  }

  /**
   * 创建流式请求
   */
  static createStreamRequest(overrides: Partial<ClaudeRequest> = {}): ClaudeRequest {
    return this.createClaudeRequest({
      stream: true,
      ...overrides
    })
  }

  /**
   * 创建 OpenAI 兼容供应商
   */
  static createOpenAIProvider(overrides: Partial<ModelProvider> = {}): ModelProvider {
    return {
      id: 'qwen-provider',
      name: '魔搭 Qwen',
      type: 'qwen',
      endpoint: 'https://api.qwen.ai/v1/chat/completions',
      model: 'qwen-turbo',
      transformer: 'claude-to-openai',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * 创建 Gemini 供应商
   */
  static createGeminiProvider(overrides: Partial<ModelProvider> = {}): ModelProvider {
    return {
      id: 'gemini-provider',
      name: 'Google Gemini',
      type: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
      model: 'gemini-pro',
      transformer: 'claude-to-gemini',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * 创建自定义供应商
   */
  static createCustomProvider(id: string, name: string, overrides: Partial<ModelProvider> = {}): ModelProvider {
    return {
      id,
      name,
      type: 'openai',
      endpoint: `https://api.${id}.com/v1/chat/completions`,
      model: 'custom-model',
      transformer: 'claude-to-openai',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * 创建 API 密钥
   */
  static createApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
    return {
      id: 'key-123',
      key: 'sk-test-key',
      status: 'active',
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      usageCount: 10,
      successCount: 9,
      errorCount: 1,
      ...overrides
    }
  }

  /**
   * 创建禁用的 API 密钥
   */
  static createDisabledApiKey(): ApiKey {
    return this.createApiKey({
      status: 'disabled',
      errorCount: 10,
      lastError: '429: Rate limit exceeded'
    })
  }

  /**
   * 创建 OpenAI 响应
   */
  static createOpenAIResponse(content: string = 'Hello! How can I help?') {
    return {
      id: 'chatcmpl-123',
      choices: [{
        message: { role: 'assistant', content },
        finish_reason: 'stop'
      }]
    }
  }

  /**
   * 创建 OpenAI 流式响应数据
   */
  static createOpenAIStreamData(content: string = 'Hello') {
    return `data: {"choices":[{"delta":{"content":"${content}"}}]}\n\n`
  }

  /**
   * 创建 Gemini 响应
   */
  static createGeminiResponse(text: string = 'Hello from Gemini!') {
    return {
      candidates: [{
        content: {
          parts: [{ text }]
        }
      }]
    }
  }

  /**
   * 创建 Gemini 流式响应数据
   */
  static createGeminiStreamResponse(texts: string[] = ['Hello', ' from Gemini!']) {
    return texts.map(text => ({
      candidates: [{
        content: {
          parts: [{ text }]
        }
      }]
    }))
  }

  /**
   * 创建 Claude 响应
   */
  static createClaudeResponse(text: string = 'Hello! How can I help?', overrides: any = {}) {
    return {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text }],
      ...overrides
    }
  }

  /**
   * 创建 API 错误响应
   */
  static createErrorResponse(status: number, message: string, details?: any) {
    const errorBodies = {
      401: { error: { type: 'authentication_error', message } },
      403: { error: { type: 'permission_error', message } },
      429: { error: { type: 'rate_limit_error', message } },
      500: { error: { type: 'server_error', message } }
    }

    return {
      status,
      body: details || errorBodies[status] || { error: message }
    }
  }

  /**
   * 创建转换后的 OpenAI 请求
   */
  static createTransformedOpenAIRequest(model: string = 'qwen-turbo', messages: any[] = []) {
    return {
      model,
      messages: messages.length > 0 ? messages : [{ role: 'user', content: 'Hello!' }],
      stream: false
    }
  }

  /**
   * 创建转换后的 Gemini 请求
   */
  static createTransformedGeminiRequest(text: string = 'Hello!') {
    return {
      contents: [{ parts: [{ text }] }]
    }
  }

  /**
   * 创建可读流
   */
  static createReadableStream(data: string): ReadableStream {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(data))
        controller.close()
      }
    })
  }
}