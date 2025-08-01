<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- 供应商选择 (仅新增时显示) -->
    <div v-if="!isEdit && !selectedProviderType">
      <h3 class="text-lg font-medium text-gray-900 mb-4">选择供应商类型</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="(config, key) in PROVIDER_CONFIGS" :key="key" 
             @click="selectProviderType(key)"
             class="bg-white border-2 border-gray-200 rounded-xl p-4 cursor-pointer hover:border-orange-300 transition duration-200">
          <div class="flex items-center space-x-3">
            <div :class="config.icon" class="w-10 h-10 bg-gradient-to-br rounded-xl flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ config.name }}</h4>
              <p class="text-sm text-gray-500">{{ config.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 表单字段 -->
    <div v-if="selectedProviderType || isEdit" class="space-y-4">
      <!-- 自定义名称 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          供应商名称 <span class="text-red-500">*</span>
        </label>
        <input type="text" 
               v-model="form.name"
               required
               class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200"
               :placeholder="isEdit ? '供应商名称' : `例如：我的${currentProviderConfig?.name}账号`">
      </div>

      <!-- API 端点 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          API 端点 <span class="text-red-500">*</span>
        </label>
        <input type="url" 
               v-model="form.endpoint"
               required
               :readonly="isEndpointReadonly"
               class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200"
               :class="{ 'bg-gray-50': isEndpointReadonly }"
               placeholder="https://api.example.com/v1/chat/completions">
      </div>

      <!-- 模型选择 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          模型 <span class="text-red-500">*</span>
        </label>
        <div v-if="availableModels.length > 0">
          <select v-model="form.model"
                  required
                  class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200">
            <option value="">请选择模型</option>
            <option v-for="model in availableModels" :key="model" :value="model">
              {{ model }}
            </option>
            <option value="custom">自定义模型...</option>
          </select>
        </div>
        <!-- 当没有预设模型时，直接编辑 form.model -->
        <div v-if="availableModels.length === 0">
          <input type="text" 
                 v-model="form.model"
                 required
                 autocomplete="off"
                 class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200"
                 placeholder="请输入模型名称，例如：gpt-3.5-turbo">
        </div>
        <!-- 当选择自定义模型时，编辑 customModel -->
        <div v-else-if="form.model === 'custom'">
          <input type="text" 
                 v-model="customModel"
                 required
                 autocomplete="off"
                 class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200 mt-2"
                 placeholder="请输入模型名称，例如：gpt-3.5-turbo">
        </div>
      </div>

      <!-- 描述 -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          描述
        </label>
        <textarea v-model="form.description"
                  rows="3"
                  class="block w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200 resize-none"
                  placeholder="供应商描述信息">
        </textarea>
      </div>

      <!-- API Key 管理提示 -->
      <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h4 class="text-sm font-medium text-blue-900">API 密钥管理</h4>
            <p class="mt-1 text-sm text-blue-700">
              创建供应商后，请前往 <strong>密钥池管理</strong> 页面添加和管理 API 密钥。密钥池支持批量导入、智能轮换和故障恢复功能。
            </p>
          </div>
        </div>
      </div>

      <!-- 按钮 -->
      <div class="flex justify-end space-x-4 pt-6 border-t border-gray-200">
        <button type="button" @click="handleCancel"
                class="px-6 py-3 border border-orange-300 text-orange-600 rounded-xl hover:bg-orange-50 transition duration-200 font-medium">
          {{ isEdit ? '取消' : '重新选择' }}
        </button>
        <button type="submit" 
                :disabled="loading"
                class="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transform hover:scale-105 transition duration-200 shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          {{ loading ? (isEdit ? '保存中...' : '添加中...') : (isEdit ? '保存' : '添加供应商') }}
        </button>
      </div>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ModelProvider, AddProviderRequest, EditProviderRequest } from '../../../shared/types/admin/providers'
import { PROVIDER_CONFIGS } from '../../../shared/constants/admin/providers'

interface Props {
  provider?: ModelProvider // 编辑时传入
  loading?: boolean
}

interface Emits {
  (e: 'submit', data: AddProviderRequest | EditProviderRequest): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

const isEdit = computed(() => !!props.provider)
const selectedProviderType = ref<string | null>(props.provider?.type || null)
const customModel = ref('')

const form = ref({
  name: props.provider?.name || '',
  endpoint: props.provider?.endpoint || '',
  model: props.provider?.model || '',
  description: props.provider?.description || ''
})

const currentProviderConfig = computed(() => {
  if (!selectedProviderType.value) return null
  return PROVIDER_CONFIGS[selectedProviderType.value as keyof typeof PROVIDER_CONFIGS]
})

const availableModels = computed(() => {
  return currentProviderConfig.value?.models || []
})

// 判断 endpoint 是否应该是只读的
const isEndpointReadonly = computed(() => {
  // 编辑模式下可以编辑
  if (isEdit.value) return false
  // 对于预定义供应商，端点是只读的
  return currentProviderConfig.value?.isPreset || false
})

// 监听选择的供应商类型，自动填充配置
watch(selectedProviderType, (newType) => {
  if (newType && !isEdit.value) {
    const config = PROVIDER_CONFIGS[newType as keyof typeof PROVIDER_CONFIGS]
    if (config) {
      form.value.name = config.name
      // 只有当配置中有 endpoint 时才自动填充
      form.value.endpoint = config.endpoint || ''
      form.value.model = ''
    }
  }
})

// 监听模型选择
watch(() => form.value.model, (newModel) => {
  if (newModel === 'custom') {
    form.value.model = customModel.value
  } else if (newModel && newModel !== 'custom') {
    customModel.value = ''
  }
})

// 监听自定义模型输入
watch(customModel, (newValue) => {
  if (form.value.model === 'custom' && availableModels.value.length > 0) {
    form.value.model = newValue
  }
})

const selectProviderType = (configKey: string) => {
  selectedProviderType.value = configKey
  const config = PROVIDER_CONFIGS[configKey as keyof typeof PROVIDER_CONFIGS]
  console.log('Selected provider config:', configKey, config)
}

const handleSubmit = () => {
  const finalModel = form.value.model === 'custom' ? customModel.value : form.value.model
  
  if (isEdit.value) {
    const editData: EditProviderRequest = {
      name: form.value.name,
      endpoint: form.value.endpoint,
      model: finalModel,
      description: form.value.description
    }
    emit('submit', editData)
  } else {
    const config = currentProviderConfig.value
    if (!config) return
    
    const addData: AddProviderRequest = {
      name: form.value.name,
      type: config.type,
      endpoint: form.value.endpoint,
      model: finalModel,
      transformer: config.transformer,
      description: form.value.description
    }
    emit('submit', addData)
  }
}

const handleCancel = () => {
  if (isEdit.value) {
    emit('cancel')
  } else {
    selectedProviderType.value = null
    form.value = {
      name: '',
      endpoint: '',
      model: '',
      description: ''
    }
    customModel.value = ''
  }
}

// 重置表单（供父组件调用）
const resetForm = () => {
  selectedProviderType.value = null
  form.value = {
    name: '',
    endpoint: '',
    model: '',
    description: ''
  }
  customModel.value = ''
}

defineExpose({
  resetForm
})
</script>