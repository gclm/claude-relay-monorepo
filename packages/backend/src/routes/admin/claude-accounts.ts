/**
 * Claude 账号管理路由
 */

import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'
import { ClaudeAccountService } from '../../services/admin/index'
import { createSuccessResponse } from '../../utils/response'
import { AddClaudeAccountRequest, ClaudeAccountOAuthRequest } from '../../../../../shared/types/admin/claude-accounts'
import type { Bindings } from '../../types/env'

const claudeAccountRoutes = new Hono<{ Bindings: Bindings }>()

// 获取所有 Claude 账号
claudeAccountRoutes.get('/claude-accounts', async (c) => {
  const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
  const accounts = await claudeAccountService.getClaudeAccounts()
  
  return createSuccessResponse(accounts, '获取 Claude 账号列表成功')
})

// 添加 Claude 账号
claudeAccountRoutes.post('/claude-accounts', 
  validator('json', (value) => {
    if (!value || typeof value !== 'object') {
      throw new HTTPException(400, { message: '无效的请求体' })
    }
    if (!value.name) {
      throw new HTTPException(400, { message: '账号名称不能为空' })
    }
    return value as AddClaudeAccountRequest
  }),
  async (c) => {
    const request = c.req.valid('json')

    const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const account = await claudeAccountService.addClaudeAccount(request)
    
    return createSuccessResponse(account, '添加 Claude 账号成功')
  }
)

// 删除 Claude 账号
claudeAccountRoutes.delete('/claude-accounts/:id',
  validator('param', (value) => {
    if (!value.id) {
      throw new HTTPException(400, { message: '缺少账号 ID' })
    }
    return value
  }),
  async (c) => {
    const { id } = c.req.valid('param')

    const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
    await claudeAccountService.deleteClaudeAccount(id)
    
    return createSuccessResponse(null, '删除 Claude 账号成功')
  }
)

// 生成 OAuth 授权链接
claudeAccountRoutes.post('/claude-accounts/generate-auth',
  validator('json', (value) => {
    if (!value || typeof value !== 'object') {
      throw new HTTPException(400, { message: '无效的请求体' })
    }
    if (!value.accountId) {
      throw new HTTPException(400, { message: '缺少账号 ID' })
    }
    return value as { accountId: string }
  }),
  async (c) => {
    const { accountId } = c.req.valid('json')

    const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const authData = await claudeAccountService.generateClaudeAccountAuth(accountId)
    
    return createSuccessResponse(authData, '生成授权链接成功')
  }
)

// 交换授权码获取 token
claudeAccountRoutes.post('/claude-accounts/exchange-token',
  validator('json', (value) => {
    if (!value || typeof value !== 'object') {
      throw new HTTPException(400, { message: '无效的请求体' })
    }
    if (!value.accountId || !value.code || !value.pkce) {
      throw new HTTPException(400, { message: '缺少必填参数' })
    }
    return value as ClaudeAccountOAuthRequest
  }),
  async (c) => {
    const request = c.req.valid('json')

    const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
    await claudeAccountService.exchangeClaudeAccountToken(request)
    
    return createSuccessResponse(null, '令牌交换成功')
  }
)

// 刷新账号 token
claudeAccountRoutes.post('/claude-accounts/:id/refresh',
  validator('param', (value) => {
    if (!value.id) {
      throw new HTTPException(400, { message: '缺少账号 ID' })
    }
    return value
  }),
  async (c) => {
    const { id } = c.req.valid('param')

    const claudeAccountService = new ClaudeAccountService(c.env.CLAUDE_RELAY_ADMIN_KV)
    await claudeAccountService.refreshClaudeAccountToken(id)
    
    return createSuccessResponse(null, '令牌刷新成功')
  }
)

export { claudeAccountRoutes }