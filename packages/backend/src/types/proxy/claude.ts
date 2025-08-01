/**
 * Claude 代理相关类型定义
 */

/**
 * Claude API 请求格式
 */
export interface ClaudeRequest {
  model?: string
  messages: any[]
  max_tokens?: number
  temperature?: number
  stream?: boolean
  system?: string | any[]
}

/**
 * Claude OAuth Token 格式
 */
export interface ClaudeToken {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
  scope: string
  obtained_at: number
}

/**
 * Claude API 响应格式
 */
export interface ClaudeResponse {
  id: string
  type: string
  role: string
  content: Array<{
    type: string
    text?: string
    [key: string]: any
  }>
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
  }
}