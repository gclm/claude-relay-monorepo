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
  try {
    const claudeService = new ClaudeProxyService(c.env.CLAUDE_RELAY_ADMIN_KV)
    
    // 验证Content-Type
    const contentType = c.req.header('Content-Type')
    if (!contentType || !contentType.includes('application/json')) {
      return c.json({
        error: {
          type: 'invalid_request_error',
          message: 'Content-Type must be application/json'
        }
      }, 400)
    }

    // 代理请求
    const response = await claudeService.proxyRequest(c.req.raw)
    
    // 如果是流式响应，直接返回
    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      return response
    }
    
    // 对于常规响应，需要重新包装以保持Hono的响应格式
    const data = await response.json() as any
    return c.json(data, response.status as any)
    
  } catch (error) {
    console.error('Claude API 代理错误:', error)
    
    return c.json({
      error: {
        type: 'internal_server_error',
        message: error instanceof Error ? error.message : 'Claude API 代理失败'
      }
    }, 500)
  }
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