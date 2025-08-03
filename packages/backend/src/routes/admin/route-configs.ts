/**
 * 路由配置管理路由
 */

import { Hono } from 'hono'
import type { Bindings } from '../../types/env'
import { RouteConfigService } from '../../services/admin/route-configs'
import { createSuccessResponse, createErrorResponse } from '../../utils/response'
import { ERROR_TYPES } from '../../../../../shared/constants/errors'
import type { AddRouteConfigRequest, EditRouteConfigRequest } from '../../../../../shared/types/admin/routes'

const routeConfigRoutes = new Hono<{ Bindings: Bindings }>()

// 获取所有路由配置
routeConfigRoutes.get('/route-configs', async (c) => {
  try {
    const service = new RouteConfigService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const configs = await service.getAllConfigs()
    return createSuccessResponse(configs, '获取路由配置成功')
  } catch (err) {
    console.error('Failed to get route configs:', err)
    return createErrorResponse(ERROR_TYPES.INTERNAL_ERROR, '获取路由配置失败')
  }
})

// 创建路由配置
routeConfigRoutes.post('/route-configs', async (c) => {
  try {
    const request = await c.req.json<AddRouteConfigRequest>()
    
    // 基本验证
    if (!request.name || !request.rules?.default) {
      return createErrorResponse(ERROR_TYPES.INVALID_REQUEST, '配置名称和默认规则为必填项')
    }
    
    const service = new RouteConfigService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const config = await service.createConfig(request)
    return createSuccessResponse(config, '创建路由配置成功')
  } catch (err) {
    console.error('Failed to create route config:', err)
    return createErrorResponse(ERROR_TYPES.INTERNAL_ERROR, '创建路由配置失败')
  }
})

// 更新路由配置
routeConfigRoutes.put('/route-configs/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const request = await c.req.json<EditRouteConfigRequest>()
    
    const service = new RouteConfigService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const config = await service.updateConfig(id, request)
    
    if (!config) {
      return createErrorResponse(ERROR_TYPES.RESOURCE_NOT_FOUND, '路由配置不存在')
    }
    
    return createSuccessResponse(config, '更新路由配置成功')
  } catch (err) {
    console.error('Failed to update route config:', err)
    return createErrorResponse(ERROR_TYPES.INTERNAL_ERROR, '更新路由配置失败')
  }
})

// 删除路由配置
routeConfigRoutes.delete('/route-configs/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const service = new RouteConfigService(c.env.CLAUDE_RELAY_ADMIN_KV)
    await service.deleteConfig(id)
    
    return createSuccessResponse(null, '删除路由配置成功')
  } catch (err) {
    console.error('Failed to delete route config:', err)
    return createErrorResponse(ERROR_TYPES.INTERNAL_ERROR, '删除路由配置失败')
  }
})

export { routeConfigRoutes }