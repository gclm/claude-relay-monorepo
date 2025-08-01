/**
 * Transformers 模块统一导出
 */

export { BaseTransformer, AbstractTransformer } from './base-transformer'
export { ClaudeToOpenAITransformer } from './claude-to-openai'
export { ClaudeToGeminiTransformer } from './claude-to-gemini'

// 转换器注册表
export const TRANSFORMER_REGISTRY = {
  'claude-to-openai': 'ClaudeToOpenAITransformer',
  'claude-to-gemini': 'ClaudeToGeminiTransformer',
} as const

export type TransformerType = keyof typeof TRANSFORMER_REGISTRY