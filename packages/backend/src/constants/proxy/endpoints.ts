/**
 * 代理相关端点常量
 */

/**
 * Claude API 端点
 */
export const CLAUDE_API_ENDPOINTS = {
  BASE_URL: 'https://api.anthropic.com',
  MESSAGES: '/v1/messages',
  COMPLETE: '/v1/complete',
  MODELS: '/v1/models'
} as const

/**
 * 第三方 API 端点模板
 */
export const THIRD_PARTY_ENDPOINTS = {
  OPENAI_COMPATIBLE: {
    CHAT: '/v1/chat/completions',
    MODELS: '/v1/models'
  },
  GEMINI: {
    GENERATE: '/v1beta/models/{model}:generateContent',
    STREAM_GENERATE: '/v1beta/models/{model}:streamGenerateContent'
  }
} as const