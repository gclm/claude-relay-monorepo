import type { ModelProvider, SelectedModel } from '../../../../shared/types/admin/models'
import type { OAuthToken } from '../../../../shared/types/auth'

/**
 * Claude 代理测试数据工厂
 * 集中管理测试数据的创建，提高测试的可维护性
 */
export class ClaudeProxyTestFactory {
  /**
   * 创建有效的 Claude Token
   */
  static createValidToken(overrides: Partial<OAuthToken> = {}): OAuthToken {
    return {
      access_token: 'test-claude-token',
      expires_at: Date.now() + 3600000, // 1小时后过期
      refresh_token: 'test-refresh-token',
      ...overrides
    }
  }

  /**
   * 创建过期的 Token
   */
  static createExpiredToken(hoursAgo: number = 1): OAuthToken {
    return this.createValidToken({
      expires_at: Date.now() - (hoursAgo * 3600000)
    })
  }

  /**
   * 创建供应商配置
   */
  static createProvider(type: 'openai' | 'gemini', overrides: Partial<ModelProvider> = {}): ModelProvider {
    const baseConfigs = {
      openai: {
        id: 'qwen-provider',
        name: '魔搭 Qwen',
        endpoint: 'https://api.qwen.ai/v1/chat/completions',
        model: 'qwen-turbo',
        transformer: 'claude-to-openai' as const
      },
      gemini: {
        id: 'gemini-provider',
        name: 'Google Gemini',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{{model}}:generateContent',
        model: 'gemini-pro',
        transformer: 'claude-to-gemini' as const
      }
    }

    return {
      ...baseConfigs[type],
      type,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    }
  }

  /**
   * 创建多个供应商
   */
  static createProviders(): ModelProvider[] {
    return [
      this.createProvider('openai'),
      this.createProvider('gemini')
    ]
  }

  /**
   * 创建 Claude 请求
   */
  static createClaudeRequest(overrides: any = {}) {
    return {
      model: 'claude-3-opus-20240229',
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ],
      stream: false,
      ...overrides
    }
  }

  /**
   * 创建流式请求
   */
  static createStreamRequest(overrides: any = {}) {
    return this.createClaudeRequest({
      stream: true,
      ...overrides
    })
  }

  /**
   * 创建 Claude 响应
   */
  static createClaudeResponse(overrides: any = {}) {
    return {
      id: 'msg_123',
      type: 'message',
      role: 'assistant',
      content: [
        { type: 'text', text: 'Hello! How can I help you today?' }
      ],
      ...overrides
    }
  }

  /**
   * 创建错误响应
   */
  static createErrorResponse(type: string, message: string) {
    return {
      error: {
        type,
        message
      }
    }
  }

  /**
   * 创建选中的模型配置
   */
  static createSelectedModel(providerId: string, name: string): SelectedModel {
    return {
      id: providerId,
      name,
      type: 'provider',
      providerId
    }
  }

  /**
   * 创建流式响应数据
   */
  static createStreamResponseData() {
    return `data: {"type":"message_start","message":{"id":"msg_123"}}\n\ndata: {"type":"content_block_start"}\n\n`
  }
}