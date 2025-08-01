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

// 选择模型
modelRoutes.post('/select-model',
  validator('json', (value: any): SelectModelRequest => {
    const { modelId, type, providerId } = value
    
    if (!modelId || !type) {
      throw new HTTPException(400, {
        message: '缺少模型 ID 或类型'
      })
    }
    
    if (type === 'provider' && !providerId) {
      throw new HTTPException(400, {
        message: '选择供应商模型时需要提供 providerId'
      })
    }
    
    return { modelId, type, providerId }
  }),
  async (c) => {
    const { modelId, type, providerId } = c.req.valid('json')
    
    const modelService = new ModelService(c.env.CLAUDE_RELAY_ADMIN_KV)
    const selectedModel = await modelService.selectModel(modelId, type, providerId)
    
    return createSuccessResponse(selectedModel, '选择模型成功')
  }
)

export { modelRoutes }