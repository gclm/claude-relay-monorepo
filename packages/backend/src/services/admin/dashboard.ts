/**
 * 仪表板服务
 */

import { DashboardData } from '../../../../../shared/types/admin/dashboard'
import { ClaudeAccountService } from './claude-accounts'
import { ProviderService } from './providers'
import { ModelService } from './models'

export class DashboardService {
  private claudeAccountService: ClaudeAccountService
  private providerService: ProviderService
  private modelService: ModelService

  constructor(private adminKv: KVNamespace) {
    this.claudeAccountService = new ClaudeAccountService(adminKv)
    this.providerService = new ProviderService(adminKv)
    this.modelService = new ModelService(adminKv)
  }

  // 获取仪表板数据
  async getDashboardData(): Promise<DashboardData> {
    // 获取供应商数量
    const providers = await this.providerService.getProviders()
    const providerCount = providers.length

    // 获取当前选中的模型
    const currentModel = await this.modelService.getSelectedModel()

    // 获取 Claude 账号统计
    const claudeAccounts = await this.claudeAccountService.getClaudeAccounts()
    const claudeAccountsCount = claudeAccounts.length
    const activeClaudeAccounts = claudeAccounts.filter(account => account.status === 'active').length

    return {
      hasClaudeToken: activeClaudeAccounts > 0, // 有活跃账号即为有 token
      tokenExpired: false, // 简化：假设活跃账号的 token 都有效
      providerCount,
      activeConnections: 0, // 简化版暂时为 0
      currentModel,
      claudeAccountsCount,
      activeClaudeAccounts
    }
  }
}