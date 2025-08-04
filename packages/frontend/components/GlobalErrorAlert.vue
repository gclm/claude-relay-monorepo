<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 transform translate-y-2"
      enter-to-class="opacity-100 transform translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 transform translate-y-0"
      leave-to-class="opacity-0 transform translate-y-2"
    >
      <div
        v-if="globalError"
        class="fixed top-4 right-4 z-50 max-w-sm w-full bg-white border border-red-200 rounded-lg shadow-lg"
      >
        <div class="p-4">
          <div class="flex items-start">
            <!-- 错误图标 -->
            <div class="flex-shrink-0">
              <svg 
                class="h-5 w-5 text-red-500" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fill-rule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clip-rule="evenodd" 
                />
              </svg>
            </div>
            
            <!-- 错误消息 -->
            <div class="ml-3 flex-1">
              <p class="text-sm font-medium text-gray-900">
                {{ globalError.message }}
              </p>
            </div>
            
            <!-- 关闭按钮 -->
            <div class="ml-4 flex-shrink-0">
              <button
                @click="clearError"
                class="inline-flex text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path 
                    fill-rule="evenodd" 
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" 
                    clip-rule="evenodd" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onUnmounted } from 'vue'

interface Props {
  autoHide?: boolean
  autoHideDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoHide: true,
  autoHideDelay: 5000 // 5秒后自动隐藏
})

const { globalError, clearError } = useErrorHandler()

// 自动隐藏
let autoHideTimer: NodeJS.Timeout | null = null

watch(globalError, (error) => {
  if (error && props.autoHide) {
    // 清除之前的定时器
    if (autoHideTimer) {
      clearTimeout(autoHideTimer)
    }
    
    // 设置新的定时器
    autoHideTimer = setTimeout(() => {
      clearError()
    }, props.autoHideDelay)
  }
})

// 组件卸载时清理定时器
onUnmounted(() => {
  if (autoHideTimer) {
    clearTimeout(autoHideTimer)
  }
})
</script>