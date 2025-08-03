import { ref } from 'vue'
import type { RouteConfig, AddRouteConfigRequest, EditRouteConfigRequest } from '../../../shared/types/admin/routes'
import { API_ENDPOINTS } from '../../../shared/constants/endpoints'

export const useRouteConfigs = () => {
  const config = useRuntimeConfig()
  
  // 响应式数据
  const routeConfigs = ref<RouteConfig[]>([])
  const showAddRouteModal = ref(false)
  const showEditRouteModal = ref(false)
  const editingRoute = ref<RouteConfig | null>(null)

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

  // 路由配置管理方法
  const loadRouteConfigs = async () => {
    try {
      const response = await $fetch<{ success: boolean; data: RouteConfig[] }>(
        API_ENDPOINTS.ADMIN_ROUTE_CONFIGS,
        { baseURL: config.public.apiBaseUrl }
      )
      if (response.success) {
        routeConfigs.value = response.data
      }
    } catch (error) {
      console.error('Failed to load route configs:', error)
    }
  }

  const addRouteConfig = async (request: AddRouteConfigRequest) => {
    try {
      const response = await $fetch<{ success: boolean; data: RouteConfig }>(
        API_ENDPOINTS.ADMIN_ROUTE_CONFIGS,
        {
          method: 'POST',
          baseURL: config.public.apiBaseUrl,
          body: request
        }
      )
      
      if (response.success) {
        await loadRouteConfigs()
        showAddRouteModal.value = false
        showNotification('路由配置添加成功', 'success')
        return response.data
      }
    } catch (error) {
      console.error('Failed to add route config:', error)
      showNotification('添加路由配置失败', 'error')
      throw error
    }
  }

  const editRouteConfig = (routeConfig: RouteConfig) => {
    editingRoute.value = { ...routeConfig }
    showEditRouteModal.value = true
  }

  const updateRouteConfig = async (request: EditRouteConfigRequest) => {
    if (!editingRoute.value) return
    
    try {
      const response = await $fetch<{ success: boolean; data: RouteConfig }>(
        `${API_ENDPOINTS.ADMIN_ROUTE_CONFIGS}/${editingRoute.value.id}`,
        {
          method: 'PUT',
          baseURL: config.public.apiBaseUrl,
          body: request
        }
      )
      
      if (response.success) {
        await loadRouteConfigs()
        showEditRouteModal.value = false
        editingRoute.value = null
        showNotification('路由配置更新成功', 'success')
      }
    } catch (error) {
      console.error('Failed to update route config:', error)
      showNotification('更新路由配置失败', 'error')
    }
  }

  const deleteRouteConfig = async (id: string) => {
    if (!confirm('确定要删除这个路由配置吗？')) return
    
    try {
      const response = await $fetch<{ success: boolean }>(
        `${API_ENDPOINTS.ADMIN_ROUTE_CONFIGS}/${id}`,
        {
          method: 'DELETE',
          baseURL: config.public.apiBaseUrl
        }
      )
      
      if (response.success) {
        await loadRouteConfigs()
        showNotification('路由配置删除成功', 'success')
      }
    } catch (error) {
      console.error('Failed to delete route config:', error)
      showNotification('删除路由配置失败', 'error')
    }
  }

  const toggleRouteConfig = async (id: string, status: 'active' | 'inactive') => {
    try {
      const response = await $fetch<{ success: boolean }>(
        `${API_ENDPOINTS.ADMIN_ROUTE_CONFIGS}/${id}`,
        {
          method: 'PUT',
          baseURL: config.public.apiBaseUrl,
          body: { status }
        }
      )
      
      if (response.success) {
        await loadRouteConfigs()
        showNotification(`路由配置${status === 'active' ? '激活' : '停用'}成功`, 'success')
      }
    } catch (error) {
      console.error('Failed to toggle route config:', error)
      showNotification(`${status === 'active' ? '激活' : '停用'}路由配置失败`, 'error')
    }
  }

  // 路由配置显示工具方法
  const getRuleTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      'default': '默认模型',
      'longContext': '长上下文模型',
      'background': '后台任务',
      'think': '深度思考',
      'webSearch': '网络搜索'
    }
    return typeMap[type] || type
  }

  const formatRuleConditions = (rules: any) => {
    if (!rules) return '未配置'
    
    const parts = []
    if (rules.default) {
      parts.push(`默认: ${rules.default.model}`)
    }
    if (rules.longContext) {
      parts.push(`长上下文: ${rules.longContext.model}`)
    }
    if (rules.background) {
      parts.push(`后台: ${rules.background.model}`)
    }
    if (rules.think) {
      parts.push(`思考: ${rules.think.model}`)
    }
    if (rules.webSearch) {
      parts.push(`搜索: ${rules.webSearch.model}`)
    }
    
    return parts.join(' | ')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 初始化时加载数据
  loadRouteConfigs()

  return {
    // 响应式数据
    routeConfigs,
    showAddRouteModal,
    showEditRouteModal,
    editingRoute,
    
    // 方法
    loadRouteConfigs,
    addRouteConfig,
    editRouteConfig,
    updateRouteConfig,
    deleteRouteConfig,
    toggleRouteConfig,
    getRuleTypeDisplay,
    formatRuleConditions,
    formatDate
  }
}