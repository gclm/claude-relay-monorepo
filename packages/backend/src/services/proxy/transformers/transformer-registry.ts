/**
 * 转换器注册表
 * 统一管理所有的格式转换器
 */

import type { BaseTransformer } from './base-transformer'
import { ClaudeToOpenAITransformer } from './claude-to-openai'
import { ClaudeToGeminiTransformer } from './claude-to-gemini'

export class TransformerRegistry {
  private static instance: TransformerRegistry
  private transformers: Map<string, BaseTransformer>

  private constructor() {
    this.transformers = new Map()
    this.registerDefaultTransformers()
  }

  /**
   * 获取单例实例
   */
  static getInstance(): TransformerRegistry {
    if (!TransformerRegistry.instance) {
      TransformerRegistry.instance = new TransformerRegistry()
    }
    return TransformerRegistry.instance
  }

  /**
   * 注册默认转换器
   */
  private registerDefaultTransformers(): void {
    this.register('claude-to-openai', new ClaudeToOpenAITransformer())
    this.register('claude-to-gemini', new ClaudeToGeminiTransformer())
  }

  /**
   * 注册转换器
   */
  register(type: string, transformer: BaseTransformer): void {
    this.transformers.set(type, transformer)
  }

  /**
   * 获取转换器
   */
  get(type: string): BaseTransformer {
    const transformer = this.transformers.get(type)
    if (!transformer) {
      // 默认返回 OpenAI 转换器
      return this.transformers.get('claude-to-openai')!
    }
    return transformer
  }

  /**
   * 检查转换器是否存在
   */
  has(type: string): boolean {
    return this.transformers.has(type)
  }

  /**
   * 获取所有已注册的转换器类型
   */
  getTypes(): string[] {
    return Array.from(this.transformers.keys())
  }
}

// 导出单例实例
export const transformerRegistry = TransformerRegistry.getInstance()