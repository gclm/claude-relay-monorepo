/**
 * ProviderService 测试
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { ProviderService } from '../../../../src/services/admin/providers'
import type { ModelProvider } from '../../../../../../../shared/types/admin/providers'
import type { RouteConfig } from '../../../../../../../shared/types/admin/routes'

// Mock KV namespace
const createMockKV = () => ({
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
})

describe('ProviderService', () => {
  let service: ProviderService
  let mockKV: any

  beforeEach(() => {
    mockKV = createMockKV()
    service = new ProviderService(mockKV)
  })

  describe('deleteProvider', () => {
    const mockProvider: ModelProvider = {
      id: 'provider-1',
      name: '测试供应商',
      type: 'openai-compatible',
      endpoint: 'https://api.test.com',
      models: ['test-model'],
      transformer: 'claude-to-openai',
      status: 'active',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    const mockRouteConfig: RouteConfig = {
      id: 'route-1',
      name: '测试路由配置',
      rules: {
        default: {
          providerId: 'provider-1',
          model: 'test-model'
        },
        longContext: {
          providerId: 'provider-2',
          model: 'other-model'
        }
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    test('应该成功删除未被路由配置使用的供应商', async () => {
      // 模拟供应商存在
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.getById
        .mockResolvedValueOnce(JSON.stringify([])) // RouteConfigRepository.getAllConfigs
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.delete

      mockKV.put.mockResolvedValue(undefined)

      await expect(service.deleteProvider('provider-1')).resolves.not.toThrow()
    })

    test('应该在供应商不存在时抛出错误', async () => {
      // 模拟供应商不存在
      mockKV.get.mockResolvedValueOnce(JSON.stringify([]))

      await expect(service.deleteProvider('non-existent'))
        .rejects
        .toThrow('供应商不存在')
    })

    test('应该在供应商被路由配置使用时抛出错误', async () => {
      // 模拟供应商存在但被路由配置使用
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.getById
        .mockResolvedValueOnce(JSON.stringify([mockRouteConfig])) // RouteConfigRepository.getAllConfigs

      await expect(service.deleteProvider('provider-1'))
        .rejects
        .toThrow('无法删除供应商"测试供应商"，以下路由配置正在使用该供应商：测试路由配置')
    })

    test('应该正确检测多个路由配置中的供应商使用情况', async () => {
      const mockRouteConfig2: RouteConfig = {
        id: 'route-2',
        name: '另一个路由配置',
        rules: {
          default: {
            providerId: 'provider-2',
            model: 'other-model'
          },
          background: {
            providerId: 'provider-1',
            model: 'test-model'
          }
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      // 模拟供应商存在但被多个路由配置使用
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.getById
        .mockResolvedValueOnce(JSON.stringify([mockRouteConfig, mockRouteConfig2])) // RouteConfigRepository.getAllConfigs

      await expect(service.deleteProvider('provider-1'))
        .rejects
        .toThrow('无法删除供应商"测试供应商"，以下路由配置正在使用该供应商：测试路由配置、另一个路由配置')
    })

    test('应该正确处理路由配置中的可选字段', async () => {
      const routeConfigWithOptionalFields: RouteConfig = {
        id: 'route-3',
        name: '包含可选字段的路由配置',
        rules: {
          default: {
            providerId: 'provider-2',
            model: 'other-model'
          },
          longContext: undefined,
          background: undefined,
          think: {
            providerId: 'provider-1',
            model: 'think-model'
          },
          webSearch: undefined
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      // 模拟供应商存在且被 think 字段使用
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.getById
        .mockResolvedValueOnce(JSON.stringify([routeConfigWithOptionalFields])) // RouteConfigRepository.getAllConfigs

      await expect(service.deleteProvider('provider-1'))
        .rejects
        .toThrow('无法删除供应商"测试供应商"，以下路由配置正在使用该供应商：包含可选字段的路由配置')
    })

    test('应该在路由配置中没有使用该供应商时成功删除', async () => {
      const routeConfigNotUsingProvider: RouteConfig = {
        id: 'route-4',
        name: '不使用该供应商的路由配置',
        rules: {
          default: {
            providerId: 'provider-2',
            model: 'other-model'
          }
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }

      // 模拟供应商存在但未被路由配置使用
      mockKV.get
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.getById
        .mockResolvedValueOnce(JSON.stringify([routeConfigNotUsingProvider])) // RouteConfigRepository.getAllConfigs
        .mockResolvedValueOnce(JSON.stringify([mockProvider])) // ProviderRepository.delete

      mockKV.put.mockResolvedValue(undefined)

      await expect(service.deleteProvider('provider-1')).resolves.not.toThrow()
    })
  })
})