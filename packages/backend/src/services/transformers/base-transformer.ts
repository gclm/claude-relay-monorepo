/**
 * 基础转换器接口
 * 定义所有 API 格式转换器必须实现的方法
 */

export interface BaseTransformer {
  /**
   * 转换请求格式
   * @param claudeRequest Claude API 格式的请求
   * @returns 目标 API 格式的请求
   */
  transformRequest(claudeRequest: any): any

  /**
   * 转换响应格式
   * @param providerResponse 目标 API 的原始响应
   * @param isStream 是否为流式响应
   * @returns Claude API 格式的响应
   */
  transformResponse(providerResponse: any, isStream: boolean): any

  /**
   * 转换流式响应的单个数据块
   * @param chunk 原始数据块
   * @returns Claude API 格式的数据块，如果返回 null 则跳过该块
   */
  transformStreamChunk?(chunk: string): string | null

  /**
   * 获取转换器名称
   */
  getName(): string

  /**
   * 获取支持的提供商类型
   */
  getSupportedProviders(): string[]
}

/**
 * 抽象基类，提供通用功能
 */
export abstract class AbstractTransformer implements BaseTransformer {
  abstract transformRequest(claudeRequest: any): any
  abstract transformResponse(providerResponse: any, isStream: boolean): any
  abstract getName(): string
  abstract getSupportedProviders(): string[]

  /**
   * 默认的流式响应转换实现
   * 子类可以重写以提供自定义逻辑
   */
  transformStreamChunk(chunk: string): string | null {
    return chunk
  }

  /**
   * 工具函数：安全解析 JSON
   */
  protected safeJsonParse(text: string): any {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }

  /**
   * 工具函数：格式化 SSE 数据
   */
  protected formatSSE(data: any): string {
    return `data: ${JSON.stringify(data)}\n\n`
  }
}