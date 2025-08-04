/**
 * 模型管理服务
 */

import { SelectedModel } from '../../../../../shared/types/admin/models'
import { HTTPException } from 'hono/http-exception'
import { ModelRepository, ProviderRepository, RouteConfigRepository } from '../../repositories'

export class ModelService {
  private modelRepo: ModelRepository
  private providerRepo: ProviderRepository
  private routeConfigRepo: RouteConfigRepository

  constructor(adminKv: KVNamespace) {
    this.modelRepo = new ModelRepository(adminKv)
    this.providerRepo = new ProviderRepository(adminKv)
    this.routeConfigRepo = new RouteConfigRepository(adminKv)
  }

  // 获取可用模型列表（现在返回 Claude 官方模型和路由配置）
  async getAvailableModels(): Promise<Array<{ id: string; name: string; type: 'claude' | 'route'; routeId?: string }>> {
    const models: Array<{ id: string; name: string; type: 'claude' | 'route'; routeId?: string }> = [
      { id: 'claude', name: 'Claude 官方模型', type: 'claude' }
    ]

    // 获取所有路由配置
    const routeConfigs = await this.routeConfigRepo.getAllConfigs()
    for (const config of routeConfigs) {
      models.push({
        id: config.id,
        name: `路由配置: ${config.name}`,
        type: 'route',
        routeId: config.id
      })
    }

    return models
  }

  // 获取当前选中的模型
  async getSelectedModel(): Promise<SelectedModel> {
    const selectedConfig = await this.routeConfigRepo.getSelectedConfig()
    
    if (!selectedConfig || selectedConfig.type === 'claude') {
      return {
        id: 'claude',
        name: 'Claude 官方模型',
        type: 'claude'
      }
    }
    
    // 路由配置模式
    if (selectedConfig.type === 'route' && selectedConfig.routeId) {
      const routeConfig = await this.routeConfigRepo.getRouteConfig(selectedConfig.routeId)
      if (routeConfig) {
        return {
          id: routeConfig.id,
          name: `路由配置: ${routeConfig.name}`,
          type: 'route',
          routeId: routeConfig.id
        }
      }
    }
    
    // 默认返回 Claude 官方模型
    return {
      id: 'claude',
      name: 'Claude 官方模型',
      type: 'claude'
    }
  }

  // 选择模型
  async selectModel(type: 'claude' | 'route', routeId?: string): Promise<SelectedModel> {
    if (type === 'claude') {
      // 选择 Claude 官方模型
      const selectedConfig = { type: 'claude' as const }
      await this.routeConfigRepo.setSelectedConfig(selectedConfig)
      
      return {
        id: 'claude',
        name: 'Claude 官方模型',
        type: 'claude'
      }
    }
    
    if (type === 'route') {
      if (!routeId) {
        throw new HTTPException(400, { message: '选择路由配置时需要提供 routeId' })
      }
      
      // 验证路由配置是否存在
      const routeConfig = await this.routeConfigRepo.getRouteConfig(routeId)
      if (!routeConfig) {
        throw new HTTPException(400, { message: '路由配置不存在' })
      }
      
      // 保存选择的配置
      const selectedConfig = { type: 'route' as const, routeId }
      await this.routeConfigRepo.setSelectedConfig(selectedConfig)
      
      return {
        id: routeConfig.id,
        name: `路由配置: ${routeConfig.name}`,
        type: 'route',
        routeId: routeConfig.id
      }
    }
    
    throw new HTTPException(400, { message: '无效的模型类型' })
  }
}