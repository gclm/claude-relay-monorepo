/**
 * 模型供应商管理服务
 */

import { ModelProvider, AddProviderRequest, EditProviderRequest } from '../../../../../shared/types/admin/providers'
import { HTTPException } from 'hono/http-exception'
import { KeyPoolManager } from '../key-pool'
import { ProviderRepository, ModelRepository } from '../../repositories'

export class ProviderService {
  private keyPoolManager: KeyPoolManager
  private providerRepo: ProviderRepository
  private modelRepo: ModelRepository

  constructor(private adminKv: KVNamespace) {
    this.keyPoolManager = new KeyPoolManager(adminKv)
    this.providerRepo = new ProviderRepository(adminKv)
    this.modelRepo = new ModelRepository(adminKv)
  }

  // 获取所有模型供应商
  async getProviders(): Promise<ModelProvider[]> {
    return await this.providerRepo.getAll()
  }

  // 根据 ID 获取供应商
  async getProviderById(id: string): Promise<ModelProvider | null> {
    return await this.providerRepo.getById(id)
  }

  // 添加模型供应商
  async addProvider(request: AddProviderRequest): Promise<ModelProvider> {
    // 检查是否已存在
    const exists = await this.providerRepo.exists(request.name, request.endpoint)
    if (exists) {
      throw new HTTPException(400, { message: '供应商名称或端点已存在' })
    }

    const newProvider: ModelProvider = {
      id: Date.now().toString(),
      name: request.name,
      type: request.type,
      endpoint: request.endpoint,
      model: request.model,
      transformer: request.transformer,
      status: 'active',
      createdAt: Date.now(),
      keyPoolEnabled: true  // 新供应商默认启用 Key Pool
    }

    await this.providerRepo.add(newProvider)
    
    // 初始化 Key Pool（密钥通过 Key Pool API 单独管理）
    await this.keyPoolManager.initializeFromProvider(newProvider)
    
    return newProvider
  }

  // 编辑模型供应商
  async editProvider(id: string, request: EditProviderRequest): Promise<ModelProvider> {
    const existingProvider = await this.providerRepo.getById(id)
    
    if (!existingProvider) {
      throw new HTTPException(400, { message: '供应商不存在' })
    }

    // 更新供应商信息，保持原有的 id、type、status 和 createdAt
    const updatedProvider: ModelProvider = {
      ...existingProvider,
      name: request.name,
      endpoint: request.endpoint,
      model: request.model,
      transformer: request.transformer || 'claude-to-openai'
    }

    const success = await this.providerRepo.update(id, updatedProvider)
    if (!success) {
      throw new HTTPException(400, { message: '更新供应商失败' })
    }
    
    return updatedProvider
  }

  // 删除模型供应商
  async deleteProvider(id: string): Promise<void> {
    const success = await this.providerRepo.delete(id)
    
    if (!success) {
      throw new HTTPException(400, { message: '供应商不存在' })
    }

    // 如果删除的是当前选中的供应商，重置为官方模型
    const selectedModel = await this.modelRepo.getSelectedModel()
    if (selectedModel.type === 'provider' && selectedModel.providerId === id) {
      await this.modelRepo.setSelectedModel({
        id: 'official',
        name: '官方 Claude',
        type: 'official'
      })
    }
    
    // 删除关联的 Key Pool
    await this.keyPoolManager.removePool(id)
  }

  // 获取 Key Pool 管理器实例
  getKeyPoolManager(): KeyPoolManager {
    return this.keyPoolManager
  }
}