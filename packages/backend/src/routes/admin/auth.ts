/**
 * 管理员认证路由
 */

import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'
import { AdminAuthService } from '../../services/admin/index'
import { createSuccessResponse } from '../../utils/response'
import { AdminAuthRequest } from '../../../../../shared/types/admin/auth'
import type { Bindings } from '../../types/env'

const authRoutes = new Hono<{ Bindings: Bindings }>()

// 管理员认证
authRoutes.post('/auth', 
  validator('json', (value: any): AdminAuthRequest => {
    const { username, password } = value
    
    if (!username || !password) {
      throw new HTTPException(400, {
        message: '用户名和密码不能为空'
      })
    }
    
    return { username, password }
  }),
  async (c) => {
    const { username, password } = c.req.valid('json')
    
    const authService = new AdminAuthService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const isValid = await authService.verifyAdmin(username, password, c.env)
    
    if (!isValid) {
      throw new HTTPException(400, {
        message: '用户名或密码错误'
      })
    }

    return createSuccessResponse({ authenticated: true }, '登录成功')
  }
)

export { authRoutes }