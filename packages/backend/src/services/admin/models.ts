/**
 * 模型管理服务
 */

import { SelectedModel } from '../../../../../shared/types/admin/models'
import { HTTPException } from 'hono/http-exception'
import { ModelRepository, ProviderRepository } from '../../repositories'

export class ModelService {
  private modelRepo: ModelRepository
  private providerRepo: ProviderRepository

  constructor(adminKv: KVNamespace) {
    this.modelRepo = new ModelRepository(adminKv)
    this.providerRepo = new ProviderRepository(adminKv)
  }

  // 获取可用模型列表
  async getAvailableModels(): Promise<Array<{ id: string; name: string; type: 'official' | 'provider'; providerId?: string }>> {
    const models: Array<{ id: string; name: string; type: 'official' | 'provider'; providerId?: string }> = [
      { id: 'official', name: '官方 Claude', type: 'official' }
    ]

    const providers = await this.providerRepo.getAll()
    for (const provider of providers.filter(p => p.status === 'active')) {
      models.push({
        id: provider.id,
        name: provider.name,
        type: 'provider',
        providerId: provider.id
      })
    }

    return models
  }

  // 获取当前选中的模型
  async getSelectedModel(): Promise<SelectedModel> {
    return await this.modelRepo.getSelectedModel()
  }

  // 选择模型
  async selectModel(modelId: string, type: 'official' | 'provider', providerId?: string): Promise<SelectedModel> {
    let modelName = '官方 Claude'
    
    if (type === 'provider' && providerId) {
      const provider = await this.providerRepo.getById(providerId)
      if (!provider) {
        throw new HTTPException(400, { message: '供应商不存在' })
      }
      modelName = provider.name
    }

    const selectedModel: SelectedModel = {
      id: modelId,
      name: modelName,
      type,
      providerId
    }

    await this.modelRepo.setSelectedModel(selectedModel)
    return selectedModel
  }
}