/**
 * Claude 代理相关类型定义
 */

/**
 * Claude OAuth Token 格式
 * 这是我们项目特定的类型，用于管理 Claude OAuth 认证
 */
export interface ClaudeToken {
  access_token: string
  refresh_token: string
  expires_at: number
  token_type: string
  scope: string
  obtained_at: number
}