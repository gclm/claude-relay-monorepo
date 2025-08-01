<template>
  <div class="bg-gradient-to-br from-orange-50 via-orange-50 to-amber-50 min-h-screen">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute -top-10 -right-10 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      <div class="absolute -bottom-10 -left-10 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
    </div>

    <div class="relative z-10 min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <!-- Logo 和标题 -->
        <div class="text-center">
          <div class="mx-auto h-16 w-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <h2 class="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-600 bg-clip-text text-transparent">
            Claude Code 管理中心
          </h2>
          <p class="mt-3 text-gray-600 text-sm leading-relaxed">
            统一管理您的 Claude Code 账号和模型供应商<br>
            让 AI 开发更简单、更高效
          </p>
        </div>

        <!-- 登录表单 -->
        <div class="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8">
          <form @submit.prevent="handleLogin" class="space-y-6">
            <div class="space-y-4">
              <div>
                <label for="username" class="sr-only">用户名</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                  <input 
                    id="username" 
                    v-model="form.username"
                    type="text" 
                    required 
                    class="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200" 
                    placeholder="管理员用户名">
                </div>
              </div>
              <div>
                <label for="password" class="sr-only">密码</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                    </svg>
                  </div>
                  <input 
                    id="password" 
                    v-model="form.password"
                    type="password" 
                    required 
                    class="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition duration-200" 
                    placeholder="登录密码">
                </div>
              </div>
            </div>

            <div>
              <button 
                type="submit" 
                :disabled="loading"
                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transform hover:scale-[1.02] transition duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                <span class="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg class="h-5 w-5 text-white opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                  </svg>
                </span>
                {{ loading ? '登录中...' : '进入管理中心' }}
              </button>
            </div>
          </form>

          <!-- 提示信息 -->
          <div class="mt-6 text-center">
            <p class="text-xs text-gray-500">
              默认账号：admin / password123
            </p>
          </div>
          
          <!-- 错误提示 -->
          <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <p class="text-sm text-red-600">{{ error }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AdminAuthRequest } from '../../../shared/types/admin/auth'
import { API_ENDPOINTS } from '../../../shared/constants/endpoints'

useHead({
  title: 'Claude Code 管理中心 - 登录',
  meta: [
    { name: 'description', content: 'Claude Code 管理中心登录页面' }
  ]
})

const config = useRuntimeConfig()
const router = useRouter()

const form = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  if (!form.value.username || !form.value.password) {
    error.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const response = await $fetch<{ success: boolean; data: { authenticated: boolean } }>(
      API_ENDPOINTS.ADMIN_AUTH,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl,
        body: {
          username: form.value.username,
          password: form.value.password
        } as AdminAuthRequest
      }
    )

    if (response.success && response.data.authenticated) {
      // 简单的本地状态管理
      sessionStorage.setItem('admin_authenticated', 'true')
      sessionStorage.setItem('admin_username', form.value.username)
      
      await router.push('/admin/dashboard')
    } else {
      error.value = '登录失败，请检查用户名和密码'
    }
  } catch (err: any) {
    console.error('Login error:', err)
    if (err.data?.error?.message) {
      error.value = err.data.error.message
    } else {
      error.value = '登录失败，请重试'
    }
  } finally {
    loading.value = false
  }
}

// 检查是否已经登录
onMounted(() => {
  if (sessionStorage.getItem('admin_authenticated') === 'true') {
    router.push('/admin/dashboard')
  }
})
</script>