/**
 * Key Pool 管理路由
 * 提供 API Key 池的管理功能，包括添加、删除、更新和查询密钥
 */

import { Hono } from 'hono'
import { KeyPoolService } from '../../services/admin/key-pool'
import type { Bindings } from '../../types/env'
import type { 
  AddKeyRequest, 
  UpdateKeyRequest, 
  BatchAddKeysRequest, 
  BatchKeyOperation 
} from '../../../../../shared/types/key-pool'

const keyPoolRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * 获取指定供应商的 Key Pool 状态
 */
keyPoolRoutes.get('/key-pool/:providerId', async (c) => {
  try {
    const providerId = c.req.param('providerId')
    console.log(`[KeyPool Route] GET /key-pool/${providerId}`)
    
    const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
    
    const status = await service.getKeyPoolStatus(providerId)
    console.log(`[KeyPool Route] Successfully got status for ${providerId}`)
    return c.json(status)
  } catch (error) {
    console.error('[KeyPool Route] Failed to get key pool status:', error)
    console.error('[KeyPool Route] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    if (error instanceof Error && error.message === '供应商不存在') {
      return c.json({ error: '供应商不存在' }, 404)
    }
    
    return c.json({ error: '获取密钥池状态失败', details: error instanceof Error ? error.message : String(error) }, 500)
  }
})

/**
 * 添加新的 API Key 到池中
 */
keyPoolRoutes.post('/key-pool/:providerId/keys', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<AddKeyRequest>()
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  const keyId = await service.addKey(providerId, body.key, body.status)
  
  return c.json({
    success: true,
    keyId,
    message: 'API Key 添加成功'
  })
})

/**
 * 更新指定 Key 的状态
 */
keyPoolRoutes.put('/key-pool/:providerId/keys/:keyId', async (c) => {
  const providerId = c.req.param('providerId')
  const keyId = c.req.param('keyId')
  const body = await c.req.json<UpdateKeyRequest>()
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  await service.updateKeyStatus(providerId, keyId, body.status, body.errorMessage)
  
  return c.json({
    success: true,
    message: 'API Key 状态更新成功'
  })
})

/**
 * 删除指定的 API Key
 */
keyPoolRoutes.delete('/key-pool/:providerId/keys/:keyId', async (c) => {
  const providerId = c.req.param('providerId')
  const keyId = c.req.param('keyId')
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  await service.removeKey(providerId, keyId)
  
  return c.json({
    success: true,
    message: 'API Key 删除成功'
  })
})

/**
 * 批量添加 API Keys
 */
keyPoolRoutes.post('/key-pool/:providerId/keys/batch', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<BatchAddKeysRequest>()
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  const keyIds = await service.batchAddKeys(providerId, body.keys)
  
  return c.json({
    success: true,
    keyIds,
    message: `成功添加 ${keyIds.length} 个 API Keys`
  })
})

/**
 * 批量操作 API Keys（启用/禁用/删除）
 */
keyPoolRoutes.post('/key-pool/:providerId/keys/batch-operation', async (c) => {
  const providerId = c.req.param('providerId')
  const body = await c.req.json<BatchKeyOperation>()
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  await service.batchOperation(providerId, body.keyIds, body.operation)
  
  return c.json({
    success: true,
    message: `批量${body.operation}操作成功`
  })
})

/**
 * 获取 Key Pool 统计信息
 */
keyPoolRoutes.get('/key-pool/:providerId/stats', async (c) => {
  const providerId = c.req.param('providerId')
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  const stats = await service.getKeyPoolStats(providerId)
  
  return c.json({
    success: true,
    stats
  })
})

/**
 * 执行 Key Pool 维护任务（重置过期密钥、清理错误密钥等）
 */
keyPoolRoutes.post('/key-pool/:providerId/maintenance', async (c) => {
  const providerId = c.req.param('providerId')
  const service = new KeyPoolService(c.env.CLAUDE_RELAY_ADMIN_KV)
  
  await service.performMaintenance(providerId)
  
  return c.json({
    success: true,
    message: 'Key Pool 维护任务执行成功'
  })
})

export { keyPoolRoutes }