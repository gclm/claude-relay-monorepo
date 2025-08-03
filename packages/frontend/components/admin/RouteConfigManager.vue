<template>
  <div class="bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden rounded-2xl border border-orange-100">
    <div class="px-6 py-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="text-xl font-bold text-gray-900">路由配置管理</h3>
          <p class="text-sm text-gray-600 mt-1">配置智能路由规则，实现请求的动态分发到最合适的模型</p>
        </div>
        <button @click="navigateTo('/admin/add-route-config')" 
                class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition duration-200 shadow-lg flex items-center space-x-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
          </svg>
          <span>添加路由配置</span>
        </button>
      </div>
      
      <div class="space-y-6">
        <div v-for="routeConfig in routeConfigs" :key="routeConfig.id" 
             class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border border-blue-200 rounded-2xl p-6 hover:shadow-lg transition duration-300 group">
          <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-bold text-gray-900">{{ routeConfig.name }}</h4>
                <p class="text-sm text-gray-500">{{ routeConfig.description }}</p>
              </div>
            </div>
            <span :class="routeConfig.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'"
                  class="px-3 py-1 text-xs font-medium rounded-full">
              {{ routeConfig.enabled ? '• 启用' : '• 禁用' }}
            </span>
          </div>
          
          <div class="space-y-4 mb-6">
            <div class="space-y-3">
              <h5 class="text-sm font-medium text-gray-700">
                路由规则 ({{ getConfiguredModelsCount(routeConfig.rules) }}/5):
              </h5>
              <div class="grid grid-cols-1 gap-2">
                <!-- 默认模型 -->
                <ModelDisplayCard
                  title="默认模型"
                  :provider-id="routeConfig.rules?.default?.providerId"
                  :model="routeConfig.rules?.default?.model"
                  badgeColor="bg-green-100 text-green-600"
                  badgeText="必选"
                />
                
                <!-- 后台任务模型 -->
                <ModelDisplayCard
                  v-if="routeConfig.rules.background"
                  title="后台任务"
                  :provider-id="routeConfig.rules.background.providerId"
                  :model="routeConfig.rules.background.model"
                  badgeColor="bg-blue-100 text-blue-600"
                  badgeText="后台"
                />
                
                <!-- 深度思考模型 -->
                <ModelDisplayCard
                  v-if="routeConfig.rules.think"
                  title="深度思考"
                  :provider-id="routeConfig.rules.think.providerId"
                  :model="routeConfig.rules.think.model"
                  badgeColor="bg-purple-100 text-purple-600"
                  badgeText="思考"
                />
                
                <!-- 长上下文模型 -->
                <ModelDisplayCard
                  v-if="routeConfig.rules.longContext"
                  title="长上下文模型"
                  :provider-id="routeConfig.rules.longContext.providerId"
                  :model="routeConfig.rules.longContext.model"
                  badgeColor="bg-yellow-100 text-yellow-600"
                  :badgeText="`${routeConfig.longContextThreshold || 60000}字符+`"
                />
                
                <!-- 网络搜索模型 -->
                <ModelDisplayCard
                  v-if="routeConfig.rules.webSearch"
                  title="网络搜索模型"
                  :provider-id="routeConfig.rules.webSearch.providerId"
                  :model="routeConfig.rules.webSearch.model"
                  badgeColor="bg-orange-100 text-orange-600"
                  badgeText="搜索"
                />
              </div>
              
              <!-- 未配置的模型提示 -->
              <div v-if="getConfiguredModelsCount(routeConfig.rules) < 5" class="text-xs text-gray-500">
                {{ getUnconfiguredModelsText(routeConfig.rules) }}
              </div>
            </div>
            
            <div class="flex items-center space-x-2 text-sm">
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span class="text-gray-600">创建时间: {{ formatDate(routeConfig.createdAt) }}</span>
            </div>
          </div>
          
          <div class="flex space-x-2">
            <button @click="toggleRouteConfig(routeConfig.id, !routeConfig.enabled)" 
                    :class="routeConfig.enabled ? 'text-gray-600 border-gray-200 hover:border-gray-300' : 'text-emerald-600 border-emerald-200 hover:border-emerald-300'"
                    class="px-4 py-2 rounded-xl border transition duration-200 text-sm">
              {{ routeConfig.enabled ? '禁用' : '启用' }}
            </button>
            <button @click="editRouteConfig(routeConfig)" 
                    class="px-4 py-2 text-blue-600 hover:text-blue-700 rounded-xl border border-blue-200 hover:border-blue-300 transition duration-200 text-sm">
              编辑
            </button>
            <button @click="deleteRouteConfig(routeConfig.id)" 
                    class="px-4 py-2 text-red-600 hover:text-red-700 rounded-xl border border-red-200 hover:border-red-300 transition duration-200 text-sm">
              删除
            </button>
          </div>
        </div>
      </div>
      
      <div v-if="routeConfigs.length === 0" class="text-center py-8">
        <div class="flex flex-col items-center space-y-4">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
            </svg>
          </div>
          <div>
            <p class="text-gray-500 text-lg font-medium">暂无路由配置</p>
            <p class="text-gray-400 text-sm mt-1">创建路由配置以启用智能模型选择功能</p>
          </div>
          <button @click="showAddRouteModal = true" 
                  class="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition duration-200 shadow-lg">
            创建第一个路由配置
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 添加路由配置模态框 -->
  <div v-if="showAddRouteModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-gray-900">添加路由配置</h3>
          <button @click="showAddRouteModal = false" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <RouteConfigForm 
          :available-providers="availableProviders"
          @submit="addRouteConfig" 
          @cancel="showAddRouteModal = false" />
      </div>
    </div>
  </div>

  <!-- 编辑路由配置模态框 -->
  <div v-if="showEditRouteModal && editingRoute" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
      <div class="px-6 py-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-gray-900">编辑路由配置</h3>
          <button @click="showEditRouteModal = false; editingRoute = null" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <RouteConfigForm 
          :route-config="editingRoute"
          :available-providers="availableProviders"
          @submit="updateRouteConfig" 
          @cancel="showEditRouteModal = false; editingRoute = null" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ModelProvider } from '../../../../shared/types/admin/providers'
import type { RouteMapping } from '../../../../shared/types/admin/routes'
import { useRouteConfigs } from '../../composables/useRouteConfigs'

// 模型显示卡片子组件
const ModelDisplayCard = defineComponent({
  name: 'ModelDisplayCard',
  props: {
    title: String,
    providerId: String,
    model: String,
    badgeColor: String,
    badgeText: String
  },
  template: `
    <div class="bg-gray-50 border border-gray-200 rounded-lg p-2">
      <div class="flex items-center space-x-2 text-sm mb-1">
        <span class="font-medium text-gray-700">{{ title }}</span>
        <span :class="badgeColor" class="px-2 py-1 text-xs rounded-full">{{ badgeText }}</span>
      </div>
      <div class="text-xs text-gray-600">
        <span class="font-mono bg-gray-100 px-1 rounded">{{ providerId }}</span> → 
        <span class="font-mono bg-gray-100 px-1 rounded">{{ model }}</span>
      </div>
    </div>
  `
})

interface Props {
  availableProviders?: ModelProvider[]
}

const props = withDefaults(defineProps<Props>(), {
  availableProviders: () => []
})

// 使用 composable 来管理路由配置相关逻辑
const {
  routeConfigs,
  showAddRouteModal,
  showEditRouteModal,
  editingRoute,
  addRouteConfig,
  editRouteConfig,
  updateRouteConfig,
  deleteRouteConfig,
  toggleRouteConfig,
  getRuleTypeDisplay,
  formatRuleConditions,
  formatDate
} = useRouteConfigs()

// 工具方法
const getConfiguredModelsCount = (rules: any) => {
  if (!rules) return 0
  let count = 1 // 默认模型总是存在
  if (rules.background) count++
  if (rules.think) count++
  if (rules.longContext) count++
  if (rules.webSearch) count++
  return count
}

const getUnconfiguredModelsText = (rules: any) => {
  if (!rules) return '所有可选模型'
  const unconfigured = []
  if (!rules.background) unconfigured.push('后台任务')
  if (!rules.think) unconfigured.push('深度思考')
  if (!rules.longContext) unconfigured.push('长上下文')
  if (!rules.webSearch) unconfigured.push('网络搜索')
  
  if (unconfigured.length === 0) return ''
  return `未配置: ${unconfigured.join('、')}`
}
</script>