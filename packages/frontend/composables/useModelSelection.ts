import { ref } from 'vue'
import type { RouteConfig } from '../../../shared/types/admin/routes'
import type { SelectedModel, SelectModelRequest } from '../../../shared/types/admin/models'
import { API_ENDPOINTS } from '../../../shared/constants/endpoints'

export const useModelSelection = () => {
  const config = useRuntimeConfig()
  
  // 响应式数据
  const currentModelMode = ref<'claude' | 'route'>('claude')
  const selectedRouteConfigId = ref<string>('')
  const availableRouteConfigs = ref<RouteConfig[]>([])

  // 通知函数
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const notification = document.createElement('div')
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-xl text-white font-medium shadow-lg transform translate-x-full transition-transform duration-300 ${
      type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-orange-500'
    }`
    notification.textContent = message
    document.body.appendChild(notification)
    
    setTimeout(() => {
      notification.classList.remove('translate-x-full')
    }, 100)
    
    setTimeout(() => {
      notification.classList.add('translate-x-full')
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 300)
    }, 3000)
  }

  // 模型选择管理方法
  const loadCurrentModelSelection = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: SelectedModel }>(
        API_ENDPOINTS.ADMIN_CURRENT_MODEL,
        { baseURL: config.public.apiBaseUrl }
      )
      if (response.success) {
        currentModelMode.value = response.data.type
        if (response.data.type === 'route' && response.data.routeId) {
          selectedRouteConfigId.value = response.data.routeId
        }
      }
    } catch (error) {
      console.error('Failed to load current model selection:', error)
    }
  }

  const loadAvailableRouteConfigs = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: RouteConfig[] }>(
        API_ENDPOINTS.ADMIN_ROUTE_CONFIGS,
        { baseURL: config.public.apiBaseUrl }
      )
      if (response.success) {
        availableRouteConfigs.value = response.data.filter(config => config.enabled)
      }
    } catch (error) {
      console.error('Failed to load route configs:', error)
    }
  }

  const selectModelMode = async (mode: 'claude' | 'route') => {
    try {
      const request: SelectModelRequest = { type: mode }
      if (mode === 'route' && selectedRouteConfigId.value) {
        request.routeId = selectedRouteConfigId.value
      }
      
      const response = await $fetch<{ success: boolean; data: SelectedModel }>(
        API_ENDPOINTS.ADMIN_SELECT_MODEL,
        {
          method: 'POST',
          baseURL: config.public.apiBaseUrl,
          body: request
        }
      )
      
      if (response.success) {
        currentModelMode.value = mode
        showNotification(`已切换到: ${mode === 'claude' ? 'Claude 官方模型' : '智能路由模式'}`, 'success')
      }
    } catch (error) {
      console.error('Failed to select model mode:', error)
      showNotification('切换模型模式失败', 'error')
    }
  }

  const updateRouteSelection = async () => {
    if (currentModelMode.value === 'route' && selectedRouteConfigId.value) {
      try {
        const response = await $fetch<{ success: boolean; data: SelectedModel }>(
          API_ENDPOINTS.ADMIN_SELECT_MODEL,
          {
            method: 'POST',
            baseURL: config.public.apiBaseUrl,
            body: {
              type: 'route',
              routeId: selectedRouteConfigId.value
            }
          }
        )
        
        if (response.success) {
          const selectedConfig = availableRouteConfigs.value.find(c => c.id === selectedRouteConfigId.value)
          showNotification(`已切换到路由配置: ${selectedConfig?.name}`, 'success')
        }
      } catch (error) {
        console.error('Failed to update route selection:', error)
        showNotification('更新路由选择失败', 'error')
      }
    }
  }

  // 初始化时加载数据
  loadCurrentModelSelection()
  loadAvailableRouteConfigs()

  return {
    // 响应式数据
    currentModelMode,
    selectedRouteConfigId,
    availableRouteConfigs,
    
    // 方法
    loadCurrentModelSelection,
    loadAvailableRouteConfigs,
    selectModelMode,
    updateRouteSelection
  }
}