/**
 * 模型相关常量
 */

/**
 * Claude 官方模型
 */
export const CLAUDE_MODELS = {
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_3_5_SONNET: 'claude-3-5-sonnet-20241022',
  CLAUDE_3_5_HAIKU: 'claude-3-5-haiku-20241022'
} as const

/**
 * 默认模型配置
 */
export const DEFAULT_MODEL_CONFIG = {
  MODEL: CLAUDE_MODELS.CLAUDE_3_5_SONNET,
  MAX_TOKENS: 4096,
  TEMPERATURE: 0.7
} as const

/**
 * 模型能力映射
 */
export const MODEL_CAPABILITIES = {
  [CLAUDE_MODELS.CLAUDE_3_OPUS]: {
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: true
  },
  [CLAUDE_MODELS.CLAUDE_3_5_SONNET]: {
    maxTokens: 8192,
    supportsFunctions: true,
    supportsVision: true
  }
} as const