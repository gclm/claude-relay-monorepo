import { ModelProvider, SelectedModel } from '../../../../shared/types/admin'
import { KeyPoolData } from '../../../../shared/types/key-pool'

/**
 * 集成测试数据工厂
 * 用于生成集成测试所需的复杂数据结构
 */
export class IntegrationTestFactory {
  /**
   * 创建带有 Key Pool 的供应商配置
   */
  static createProviderWithKeyPool(
    type: 'openai' | 'gemini', 
    overrides: Partial<ModelProvider> = {},
    keys: string[] = ['test-key']
  ) {
    const provider = this.createProvider(type, overrides)
    const keyPoolData = this.createKeyPoolData(provider.id, keys)
    return { provider, keyPoolData }
  }

  /**
   * 创建供应商配置
   */
  static createProvider(
    type: 'openai' | 'gemini',
    overrides: Partial<ModelProvider> = {}
  ): ModelProvider {
    const baseConfig = {
      id: `test-${type}-provider`,
      name: `Test ${type.toUpperCase()} Provider`,
      type,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    const typeSpecificConfig = type === 'openai' 
      ? {
          endpoint: 'https://api.openai.com/v1/chat/completions',
          model: 'gpt-4',
          transformer: 'claude-to-openai'
        }
      : {
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
          model: 'gemini-pro',
          transformer: 'claude-to-gemini'
        }

    return {
      ...baseConfig,
      ...typeSpecificConfig,
      ...overrides
    }
  }

  /**
   * 创建 Key Pool 数据
   */
  static createKeyPoolData(providerId: string, keys: string[] = ['test-key']): KeyPoolData {
    return {
      keys: keys.map((key, index) => ({
        id: `key-${index + 1}`,
        key,
        status: 'active' as const,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        successCount: 0,
        failureCount: 0
      })),
      lastRoundRobinIndex: 0,
      config: {
        rotationStrategy: 'round-robin' as const,
        recoveryInterval: 60,
        maxFailures: 5
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }

  /**
   * 创建选中的模型配置
   */
  static createSelectedModel(
    providerId: string,
    providerName: string
  ): SelectedModel {
    return {
      id: providerId,
      name: providerName,
      type: 'provider',
      providerId
    }
  }

  /**
   * 创建 Claude 请求
   */
  static createClaudeRequest(overrides = {}) {
    return {
      model: 'claude-3-opus-20240229',
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ],
      max_tokens: 100,
      ...overrides
    }
  }

  /**
   * 创建 Claude 响应
   */
  static createClaudeResponse(overrides = {}) {
    return {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hello! How can I help you today?' }
      ],
      model: 'claude-3-opus-20240229',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 10,
        output_tokens: 20
      },
      ...overrides
    }
  }

  /**
   * 创建 OpenAI 响应
   */
  static createOpenAIResponse(overrides = {}) {
    return {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'Hello from OpenAI!'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      },
      ...overrides
    }
  }

  /**
   * 创建 Gemini 响应
   */
  static createGeminiResponse(overrides = {}) {
    return {
      candidates: [{
        content: {
          parts: [{ text: 'Hello from Gemini!' }],
          role: 'model'
        }
      }],
      ...overrides
    }
  }

  /**
   * 创建流式响应数据
   */
  static createStreamData(messages: string[]) {
    return messages.map(msg => `data: ${msg}\n\n`).join('')
  }

  /**
   * 创建 Claude 流式响应
   */
  static createClaudeStreamData() {
    return this.createStreamData([
      '{"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-opus-20240229"}}',
      '{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}',
      '{"type":"content_block_stop","index":0}',
      '{"type":"message_stop"}'
    ])
  }

  /**
   * 创建错误响应
   */
  static createErrorResponse(type: string, message: string, status: number) {
    return {
      error: { type, message },
      status
    }
  }
}