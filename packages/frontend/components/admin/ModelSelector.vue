<template>
  <div class="bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden rounded-2xl border border-orange-100">
    <div class="px-6 py-6">
      <div class="mb-6">
        <h3 class="text-xl font-bold text-gray-900">模型选择器</h3>
        <p class="text-sm text-gray-600 mt-1">选择 Claude Code 的智能路由模式</p>
      </div>
      
      <div class="space-y-6">
        <!-- Claude 官方模型选项 -->
        <div @click="selectModelMode('claude')"
             :class="currentModelMode === 'claude' ? 'border-orange-400 bg-orange-50/50' : 'border-orange-200'"
             class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-2 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition duration-300 group">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-bold text-gray-900">Claude 官方模型</h4>
                <p class="text-sm text-gray-600">直接使用 Anthropic 官方 Claude API</p>
                <p class="text-xs text-gray-500 mt-1">推荐用于常规使用，稳定可靠</p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <span class="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                • 可用
              </span>
              <div v-if="currentModelMode === 'claude'" 
                   class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div v-else class="w-6 h-6 border-2 border-gray-300 rounded-full group-hover:border-orange-400 transition duration-200"></div>
            </div>
          </div>
        </div>

        <!-- 智能路由模式选项 -->
        <div @click="selectModelMode('route')"
             :class="currentModelMode === 'route' ? 'border-blue-400 bg-blue-50/50' : 'border-blue-200'"
             class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-2 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition duration-300 group">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
              </div>
              <div>
                <h4 class="text-lg font-bold text-gray-900">智能路由模式</h4>
                <p class="text-sm text-gray-600">根据请求类型智能选择最合适的模型</p>
                <p class="text-xs text-gray-500 mt-1">支持长上下文、思考模式、网络搜索等场景优化</p>
              </div>
            </div>
            <div class="flex items-center space-x-3">
              <span v-if="availableRouteConfigs.length > 0" 
                    class="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                • 可用
              </span>
              <span v-else 
                    class="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                • 需要配置
              </span>
              <div v-if="currentModelMode === 'route'" 
                   class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <div v-else class="w-6 h-6 border-2 border-gray-300 rounded-full group-hover:border-blue-400 transition duration-200"></div>
            </div>
          </div>
          
          <!-- 路由配置选择器 -->
          <div v-if="currentModelMode === 'route' && availableRouteConfigs.length > 0" 
               class="mt-4 pt-4 border-t border-blue-100">
            <label class="block text-sm font-medium text-gray-700 mb-2">选择路由配置:</label>
            <select v-model="selectedRouteConfigId" 
                    @change="updateRouteSelection"
                    class="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
              <option value="">请选择路由配置</option>
              <option v-for="config in availableRouteConfigs" 
                      :key="config.id" 
                      :value="config.id">
                {{ config.name }} - {{ config.description }}
              </option>
            </select>
          </div>
          
          <!-- 暂无路由配置提示 -->
          <div v-if="currentModelMode === 'route' && availableRouteConfigs.length === 0" 
               class="mt-4 pt-4 border-t border-blue-100">
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div class="flex items-center space-x-2">
                <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span class="text-sm text-yellow-700">暂无可用的路由配置，请先创建路由配置</span>
              </div>
              <button @click="$emit('navigate-to-routes')" 
                      class="mt-2 text-sm text-yellow-600 hover:text-yellow-700 underline">
                前往创建路由配置 →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useModelSelection } from '../../composables/useModelSelection'

interface Emits {
  (e: 'navigate-to-routes'): void
}

const emit = defineEmits<Emits>()

// 使用 composable 来管理模型选择相关逻辑
const {
  currentModelMode,
  selectedRouteConfigId,
  availableRouteConfigs,
  selectModelMode,
  updateRouteSelection
} = useModelSelection()
</script>