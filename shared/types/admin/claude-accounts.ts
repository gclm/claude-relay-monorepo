/**
 * Claude Code 账号相关类型定义
 */

export interface ClaudeAccount {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'expired'
  tokenInfo?: {
    hasToken: boolean
    isExpired: boolean
    expiresAt?: number
    obtainedAt?: number
    scope?: string
  }
  createdAt: number
  lastActiveAt?: number
}

export interface AddClaudeAccountRequest {
  name: string
  description?: string
}

export interface ClaudeAccountOAuthRequest {
  accountId: string
  code: string
  pkce: {
    codeVerifier: string
    codeChallenge: string
    state: string
  }
}