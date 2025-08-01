/**
 * Claude 账号管理服务
 */

import { ClaudeAccount, AddClaudeAccountRequest, ClaudeAccountOAuthRequest } from '../../../../../shared/types/admin/claude-accounts'
import { StoredTokenInfo, PKCEParams, OAuthTokenData } from '../../../../../shared/types/auth'
import { HTTPException } from 'hono/http-exception'
import { OAUTH_CONFIG } from '../../../../../shared/constants/oauth'

export class ClaudeAccountService {
  constructor(private adminKv: KVNamespace) {}

  // 获取所有 Claude 账号
  async getClaudeAccounts(): Promise<ClaudeAccount[]> {
    // 获取账号 ID 列表
    const accountIdsData = await this.adminKv.get('claude_account_ids')
    const accountIds: string[] = accountIdsData ? JSON.parse(accountIdsData) : []
    
    const accounts: ClaudeAccount[] = []
    
    // 并行获取所有账号数据
    await Promise.all(accountIds.map(async (id) => {
      try {
        const accountData = await this.adminKv.get(`claude_account:${id}`)
        if (accountData) {
          const account: ClaudeAccount = JSON.parse(accountData)
          
          // 检查 token 状态
          const tokenData = await this.adminKv.get(`claude_account_token:${id}`)
          if (tokenData) {
            try {
              const token: StoredTokenInfo = JSON.parse(tokenData)
              const isExpired = Date.now() > token.expires_at
              account.tokenInfo = {
                hasToken: true,
                isExpired,
                expiresAt: token.expires_at,
                obtainedAt: token.obtained_at,
                scope: token.scope
              }
              // 更新账号状态
              account.status = isExpired ? 'expired' : 'active'
            } catch (error) {
              account.tokenInfo = { hasToken: false, isExpired: true }
              account.status = 'inactive'
            }
          } else {
            account.tokenInfo = { hasToken: false, isExpired: true }
            account.status = 'inactive'
          }
          
          accounts.push(account)
        }
      } catch (error) {
        console.error(`Failed to load account ${id}:`, error)
      }
    }))
    
    // 按创建时间排序
    return accounts.sort((a, b) => b.createdAt - a.createdAt)
  }

  // 添加 Claude 账号
  async addClaudeAccount(request: AddClaudeAccountRequest): Promise<ClaudeAccount> {
    // 生成安全的 UUID
    const accountId = crypto.randomUUID()
    
    // 检查是否已存在同名账号
    const accounts = await this.getClaudeAccounts()
    const exists = accounts.some(account => account.name === request.name)
    if (exists) {
      throw new HTTPException(400, { message: '账号名称已存在' })
    }

    const newAccount: ClaudeAccount = {
      id: accountId,
      name: request.name,
      description: request.description,
      status: 'inactive',
      createdAt: Date.now()
    }

    // 单独存储账号数据
    await this.adminKv.put(`claude_account:${accountId}`, JSON.stringify(newAccount))
    
    // 更新账号 ID 列表
    const accountIdsData = await this.adminKv.get('claude_account_ids')
    const accountIds: string[] = accountIdsData ? JSON.parse(accountIdsData) : []
    accountIds.push(accountId)
    await this.adminKv.put('claude_account_ids', JSON.stringify(accountIds))
    
    return newAccount
  }

  // 删除 Claude 账号
  async deleteClaudeAccount(id: string): Promise<void> {
    // 检查账号是否存在
    const accountData = await this.adminKv.get(`claude_account:${id}`)
    if (!accountData) {
      throw new HTTPException(400, { message: '账号不存在' })
    }

    // 删除账号数据
    await this.adminKv.delete(`claude_account:${id}`)
    
    // 从账号 ID 列表中移除
    const accountIdsData = await this.adminKv.get('claude_account_ids')
    if (accountIdsData) {
      const accountIds: string[] = JSON.parse(accountIdsData)
      const updatedIds = accountIds.filter(accountId => accountId !== id)
      await this.adminKv.put('claude_account_ids', JSON.stringify(updatedIds))
    }
    
    // 删除对应的 token 数据和 PKCE 数据
    await this.adminKv.delete(`claude_account_token:${id}`)
    
    // 清理可能存在的 PKCE 数据（虽然有过期时间，但主动清理更好）
    const pkceKeys = await this.adminKv.list({ prefix: 'claude_oauth_pkce:' })
    for (const key of pkceKeys.keys) {
      const pkceData = await this.adminKv.get(key.name)
      if (pkceData) {
        const pkceInfo = JSON.parse(pkceData)
        if (pkceInfo.accountId === id) {
          await this.adminKv.delete(key.name)
        }
      }
    }
  }

  // 为账号生成 OAuth 授权链接
  async generateClaudeAccountAuth(accountId: string) {
    // 检查账号是否存在
    const accountData = await this.adminKv.get(`claude_account:${accountId}`)
    if (!accountData) {
      throw new HTTPException(400, { message: '账号不存在' })
    }

    // 生成 PKCE 参数
    const pkce = await this.generatePKCE()
    
    const params = new URLSearchParams({
      code: 'true',
      client_id: OAUTH_CONFIG.CLIENT_ID,
      response_type: 'code',
      redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
      scope: OAUTH_CONFIG.SCOPES,
      code_challenge: pkce.codeChallenge,
      code_challenge_method: 'S256',
      state: pkce.state
    })

    const authURL = `${OAUTH_CONFIG.AUTHORIZE_URL}?${params.toString()}`
    
    // 临时存储 PKCE 参数，用于后续 token 交换
    await this.adminKv.put(`claude_oauth_pkce:${pkce.state}`, JSON.stringify({
      accountId,
      pkce,
      createdAt: Date.now()
    }), { expirationTtl: 600 }) // 10分钟过期
    
    return {
      authUrl: authURL,
      pkce,
      instructions: '请在新窗口中完成授权，然后从地址栏复制 code 参数的值'
    }
  }

  // 交换授权码获取 token
  async exchangeClaudeAccountToken(request: ClaudeAccountOAuthRequest): Promise<void> {
    // 验证 PKCE 参数
    const pkceData = await this.adminKv.get(`claude_oauth_pkce:${request.pkce.state}`)
    if (!pkceData) {
      throw new HTTPException(401, { message: 'PKCE 参数已过期或无效' })
    }

    const storedPkce = JSON.parse(pkceData)
    if (storedPkce.accountId !== request.accountId) {
      throw new HTTPException(401, { message: '账号ID与PKCE参数不匹配' })
    }

    // 清理授权码
    const cleanCode = this.cleanAuthCode(request.code)
    
    // 与 OAuth 提供商交换 token
    const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Claude-CF-Worker/1.0)',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: OAUTH_CONFIG.CLIENT_ID,
        code: cleanCode,
        redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
        code_verifier: storedPkce.pkce.codeVerifier,
        state: storedPkce.pkce.state
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new HTTPException(401, { message: `令牌交换失败: ${response.status} ${errorText}` })
    }

    const tokenData: OAuthTokenData = await response.json()
    
    // 创建并保存 token 信息
    const tokenInfo = this.createTokenInfo(tokenData)
    await this.adminKv.put(`claude_account_token:${request.accountId}`, JSON.stringify(tokenInfo))
    
    // 更新账号状态
    const accountData = await this.adminKv.get(`claude_account:${request.accountId}`)
    if (accountData) {
      const account: ClaudeAccount = JSON.parse(accountData)
      account.status = 'active'
      account.lastActiveAt = Date.now()
      await this.adminKv.put(`claude_account:${request.accountId}`, JSON.stringify(account))
    }
    
    // 清理 PKCE 数据
    await this.adminKv.delete(`claude_oauth_pkce:${request.pkce.state}`)
  }

  // 刷新账号 token
  async refreshClaudeAccountToken(accountId: string): Promise<void> {
    const tokenData = await this.adminKv.get(`claude_account_token:${accountId}`)
    if (!tokenData) {
      throw new HTTPException(401, { message: '未找到账号的令牌信息' })
    }

    const currentToken: StoredTokenInfo = JSON.parse(tokenData)
    if (!currentToken.refresh_token) {
      throw new HTTPException(401, { message: '未找到 refresh_token' })
    }

    const response = await fetch(OAUTH_CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'claude-cli/1.0.56 (external, cli)',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: currentToken.refresh_token,
        client_id: OAUTH_CONFIG.CLIENT_ID
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new HTTPException(401, { message: `刷新令牌失败: ${response.status} ${errorText}` })
    }

    const newTokenData: OAuthTokenData = await response.json()
    
    const newTokenInfo = this.createTokenInfo(newTokenData)
    await this.adminKv.put(`claude_account_token:${accountId}`, JSON.stringify(newTokenInfo))
    
    // 更新账号状态
    const accountData = await this.adminKv.get(`claude_account:${accountId}`)
    if (accountData) {
      const account: ClaudeAccount = JSON.parse(accountData)
      account.status = 'active'
      account.lastActiveAt = Date.now()
      await this.adminKv.put(`claude_account:${accountId}`, JSON.stringify(account))
    }
  }

  // ==================== 私有辅助方法 ====================

  // 生成 PKCE 参数
  private async generatePKCE(): Promise<PKCEParams> {
    const codeVerifier = this.generateRandomBase64UrlString(32)
    
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const codeChallenge = this.arrayBufferToBase64Url(hash)
    
    const state = this.generateRandomBase64UrlString(32)

    return { codeVerifier, codeChallenge, state }
  }

  // 创建 token 信息对象
  private createTokenInfo(tokenData: OAuthTokenData): StoredTokenInfo {
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      expires_at: Date.now() + (tokenData.expires_in * 1000),
      scope: tokenData.scope,
      token_type: tokenData.token_type || 'Bearer',
      obtained_at: Date.now()
    }
  }

  // 生成随机的 base64url 编码字符串
  private generateRandomBase64UrlString(length: number): string {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return this.arrayBufferToBase64Url(array.buffer as ArrayBuffer)
  }

  // 将 ArrayBuffer 转换为 base64url 编码
  private arrayBufferToBase64Url(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // 清理授权码，移除 URL 片段和参数
  private cleanAuthCode(code: string): string {
    return code.split('#')[0].split('&')[0].split('?')[0].trim()
  }
}