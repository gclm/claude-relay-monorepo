/**
 * 模型选择管理路由
 */

import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'
import { ModelService } from '../../services/admin/index'
import { createSuccessResponse } from '../../utils/response'
import { SelectModelRequest } from '../../../../../shared/types/admin/models'
import type { Bindings } from '../../types/env'

const modelRoutes = new Hono<{ Bindings: Bindings }>()

// 获取可用模型列表
modelRoutes.get('/models', async (c) => {
  const modelService = new ModelService(c.env.CLAUDE_RELAY_ADMIN_KV)
  const models = await modelService.getAvailableModels()
  
  return createSuccessResponse(models, '获取模型列表成功')
})

// 获取当前选中的模型
modelRoutes.get('/current-model', async (c) => {
  const modelService = new ModelService(c.env.CLAUDE_RELAY_ADMIN_KV)
  const selectedModel = await modelService.getSelectedModel()
  
  return createSuccessResponse(selectedModel, '获取当前模型成功')
})

// 选择模型
modelRoutes.post('/select-model',
  validator('json', (value: any): SelectModelRequest => {
    const { type, routeId } = value
    
    if (!type) {
      throw new HTTPException(400, {
        message: '缺少模型类型'
      })
    }
    
    if (type === 'route' && !routeId) {
      throw new HTTPException(400, {
        message: '选择路由配置模式时需要提供 routeId'
      })
    }
    
    return { type, routeId }
  }),
  async (c) => {
    const { type, routeId } = c.req.valid('json')
    
    const modelService = new ModelService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const selectedModel = await modelService.selectModel(type, routeId)
    
    return createSuccessResponse(selectedModel, '选择模型成功')
  }
)

export { modelRoutes }