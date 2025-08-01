/**
 * 仪表板路由
 */

import { Hono } from 'hono'
import { DashboardService } from '../../services/admin/index'
import { createSuccessResponse } from '../../utils/response'
import type { Bindings } from '../../types/env'

const dashboardRoutes = new Hono<{ Bindings: Bindings }>()

// 获取仪表板数据
dashboardRoutes.get('/dashboard', async (c) => {
  const dashboardService = new DashboardService(c.env.CLAUDE_RELAY_ADMIN_KV)
  const data = await dashboardService.getDashboardData()
  
  return createSuccessResponse(data, '获取仪表板数据成功')
})

export { dashboardRoutes }