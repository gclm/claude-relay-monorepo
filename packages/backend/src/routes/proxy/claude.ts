/**
 * Claude API 代理路由
 * 实现 Claude API 的代理功能，支持智能路由到第三方模型供应商
 */

import { Hono } from 'hono'
import { ClaudeProxyService } from '../../services/proxy/claude-proxy'
import type { Bindings } from '../../types/env'

const claudeRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * Claude Messages API 代理
 * POST /v1/messages - 代理 Claude API 消息请求
 */
claudeRoutes.post('/messages', async (c) => {
  const claudeService = new ClaudeProxyService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  // 直接返回代理服务的响应，异常由全局错误处理中间件捕获
  return await claudeService.proxyRequest(c.req.raw)
})

/**
 * 健康检查 - Claude API 代理状态
 * GET /v1/health
 */
claudeRoutes.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    service: 'Claude API Proxy',
    timestamp: new Date().toISOString()
  })
})

export { claudeRoutes }