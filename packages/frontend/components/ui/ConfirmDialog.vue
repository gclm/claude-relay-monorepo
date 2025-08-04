<template>
  <div v-if="visible" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 transform transition-all duration-300 scale-100">
      <div class="px-6 py-6">
        <!-- 图标和标题 -->
        <div class="flex items-center space-x-4 mb-4">
          <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900">{{ title || '确认操作' }}</h3>
            <p class="text-sm text-gray-600 mt-1">{{ message || '您确定要执行此操作吗？' }}</p>
          </div>
        </div>
        
        <!-- 详细描述（可选） -->
        <div v-if="description" class="mb-6 p-4 bg-gray-50 rounded-xl">
          <p class="text-sm text-gray-700">{{ description }}</p>
        </div>
        
        <!-- 操作按钮 -->
        <div class="flex space-x-3 justify-end">
          <button 
            @click="handleCancel"
            class="px-6 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300">
            {{ cancelText || '取消' }}
          </button>
          <button 
            @click="handleConfirm"
            :disabled="loading"
            :class="{
              'bg-red-500 hover:bg-red-600 focus:ring-red-300': type === 'danger',
              'bg-orange-500 hover:bg-orange-600 focus:ring-orange-300': type === 'warning',
              'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300': type === 'info'
            }"
            class="px-6 py-2.5 text-white rounded-xl font-medium transition duration-200 focus:outline-none focus:ring-2 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ loading ? '处理中...' : (confirmText || '确认') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'

interface Props {
  visible: boolean
  title?: string
  message?: string
  description?: string
  type?: 'danger' | 'warning' | 'info'
  confirmText?: string
  cancelText?: string
  loading?: boolean
}

interface Emits {
  (e: 'confirm'): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'danger',
  loading: false
})

const emit = defineEmits<Emits>()

const handleConfirm = () => {
  if (props.loading) return
  emit('confirm')
}

const handleCancel = () => {
  if (props.loading) return
  emit('cancel')
}

// 按 ESC 键取消
let cleanup: (() => void) | null = null

watch(() => props.visible, (visible: boolean) => {
  if (visible) {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
      }
    }
    document.addEventListener('keydown', handleEscape)
    
    cleanup = () => {
      document.removeEventListener('keydown', handleEscape)
    }
  } else if (cleanup) {
    cleanup()
    cleanup = null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (cleanup) {
    cleanup()
  }
})
</script>