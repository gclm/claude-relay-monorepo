/**
 * 响应处理器
 * 负责处理和转换供应商的响应
 */

import type { RequestContext } from './types'

export class ResponseHandler {
  /**
   * 处理响应
   * 将供应商响应转换回 Claude API 格式
   */
  async handle(context: RequestContext): Promise<Response> {
    const { rawResponse, transformer, originalRequest } = context
    
    if (!rawResponse || !transformer) {
      throw new Error('Response or transformer not available')
    }
    
    return await this.processProviderResponse(
      rawResponse,
      transformer,
      originalRequest.stream
    )
  }
  
  /**
   * 处理供应商响应
   */
  private async processProviderResponse(
    response: Response,
    transformer: any,
    isStreamRequest?: boolean
  ): Promise<Response> {
    const contentType = response.headers.get('Content-Type') || ''
    const isGemini = transformer.constructor.name === 'ClaudeToGeminiTransformer'
    
    // 判断是否为流式响应
    const isStreamResponse = isStreamRequest && (
      contentType.includes('text/event-stream') || 
      (isGemini && contentType.includes('application/json'))
    )

    // CORS 头
    const corsHeaders = this.getCorsHeaders()

    if (isStreamResponse) {
      return await this.processStreamResponse(response, transformer, corsHeaders)
    } else {
      return await this.processJsonResponse(response, transformer, corsHeaders)
    }
  }
  
  /**
   * 处理流式响应
   */
  private async processStreamResponse(
    response: Response,
    transformer: any,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    if (!response.body) {
      throw new Error('Response body is null')
    }

    const transformedStream = await transformer.transformResponse(response.body, true)
    
    return new Response(transformedStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...corsHeaders
      }
    })
  }
  
  /**
   * 处理 JSON 响应
   */
  private async processJsonResponse(
    response: Response,
    transformer: any,
    corsHeaders: Record<string, string>
  ): Promise<Response> {
    const responseData = await response.json()
    const transformedResponse = await transformer.transformResponse(responseData, false)
    
    return new Response(JSON.stringify(transformedResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
  
  /**
   * 获取 CORS 头
   */
  private getCorsHeaders(): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  }
}