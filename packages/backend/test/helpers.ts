import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Bindings } from '../src/types/env'
import { testKV } from './setup'
import { ERROR_TYPES } from '../../../shared/constants/errors'

/**
 * 创建测试用的 Hono app 实例
 */
export function createTestApp() {
  const app = new Hono<{ Bindings: Bindings }>()
  
  // 添加测试环境的绑定
  app.use('*', async (c, next) => {
    // 确保 env 对象存在
    if (!c.env) {
      c.env = {} as any
    }
    
    // 模拟 KV 绑定
    c.env.CLAUDE_RELAY_ADMIN_KV = testKV as any
    
    // 设置环境变量
    c.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'test-admin'
    c.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'test-password'
    c.env.NODE_ENV = 'test'
    
    await next()
  })
  
  // 添加错误处理器 (模拟主应用的错误处理)
  app.onError((err, c) => {
    console.error(`Test Error in ${c.req.method} ${c.req.path}:`, err)
    
    // 处理 HTTPException
    if (err instanceof HTTPException) {
      const status = err.status
      
      // 根据状态码映射到错误类型
      const errorType = getErrorTypeFromStatus(status)
      
      return c.json({
        success: false,
        error: {
          type: errorType,
          message: err.message
        },
        timestamp: new Date().toISOString()
      }, status)
    }
    
    // 处理其他错误
    return c.json({
      success: false,
      error: {
        type: ERROR_TYPES.INTERNAL_ERROR,
        message: err.message
      },
      timestamp: new Date().toISOString()
    }, 500)
  })
  
  return app
}

/**
 * 根据 HTTP 状态码获取错误类型
 */
function getErrorTypeFromStatus(status: number): string {
  const statusToErrorType: Record<number, string> = {
    400: ERROR_TYPES.INVALID_REQUEST,
    401: ERROR_TYPES.UNAUTHORIZED,
    404: ERROR_TYPES.RESOURCE_NOT_FOUND,
    500: ERROR_TYPES.INTERNAL_ERROR
  }
  
  return statusToErrorType[status] || ERROR_TYPES.INTERNAL_ERROR
}

/**
 * 创建测试请求
 */
export function createTestRequest(path: string, options: RequestInit = {}) {
  const url = `http://localhost${path}`
  return new Request(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}

/**
 * 获取管理员认证 token
 */
export async function getAdminToken() {
  // 在实际测试中，可以根据需要生成或模拟 token
  return 'test-admin-token'
}

/**
 * 创建带认证的请求
 */
export function createAuthenticatedRequest(path: string, options: RequestInit = {}) {
  return createTestRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${getAdminToken()}`
    }
  })
}