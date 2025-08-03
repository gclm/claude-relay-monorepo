/**
 * Claude 代理相关类型定义
 */

import type {
  MessageCreateParamsBase,
  MessageParam,
  Tool
} from '@anthropic-ai/sdk/resources/messages'

/**
 * Claude API 请求格式
 * 直接使用官方 SDK 的 MessageCreateParamsBase
 * 已包含 thinking 配置
 */
export type ClaudeRequest = MessageCreateParamsBase

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