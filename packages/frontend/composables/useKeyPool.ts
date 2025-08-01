/**
 * Key Pool 管理相关的 composable
 */

import type { KeyPoolStats } from '../../../shared/types/key-pool'

export const useKeyPool = () => {
  const config = useRuntimeConfig()
  
  /**
   * 获取指定供应商的 Key Pool 统计信息
   */
  const getKeyPoolStats = async (providerId: string): Promise<KeyPoolStats | null> => {
    try {
      const response = await $fetch<{ success: boolean; stats: KeyPoolStats }>(
        `/api/admin/key-pool/${providerId}/stats`,
        { baseURL: config.public.apiBaseUrl }
      )
      
      if (response.success) {
        return response.stats
      }
      return null
    } catch (error) {
      console.error(`Failed to load key pool stats for ${providerId}:`, error)
      return null
    }
  }
  
  /**
   * 批量获取多个供应商的 Key Pool 统计信息
   */
  const getMultipleKeyPoolStats = async (providerIds: string[]): Promise<Map<string, KeyPoolStats>> => {
    const statsMap = new Map<string, KeyPoolStats>()
    
    // 并行获取所有供应商的统计信息
    const promises = providerIds.map(async (providerId) => {
      const stats = await getKeyPoolStats(providerId)
      if (stats) {
        statsMap.set(providerId, stats)
      }
    })
    
    await Promise.all(promises)
    return statsMap
  }
  
  /**
   * 格式化密钥池状态显示
   */
  const formatKeyPoolStatus = (stats: KeyPoolStats | null): string => {
    if (!stats || stats.totalKeys === 0) {
      return '未配置'
    }
    
    return `${stats.totalKeys}个 | 活跃: ${stats.activeKeys} | 限流: ${stats.exhaustedKeys} | 错误: ${stats.errorKeys}`
  }
  
  return {
    getKeyPoolStats,
    getMultipleKeyPoolStats,
    formatKeyPoolStatus
  }
}