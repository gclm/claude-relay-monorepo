/**
 * 转换器模块入口
 * 统一导出所有转换器相关功能
 */

// 基础转换器
export type { BaseTransformer } from './base-transformer'
export { AbstractTransformer } from './base-transformer'
export { ClaudeToOpenAITransformer } from './claude-to-openai'
export { ClaudeToGeminiTransformer } from './claude-to-gemini'

// 注册表 - 这是主要的导出，proxy 服务使用
export { transformerRegistry } from './transformer-registry'