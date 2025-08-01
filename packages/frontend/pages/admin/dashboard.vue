<template>
  <div class="bg-gradient-to-br from-orange-50 via-orange-50 to-amber-50 min-h-screen">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 overflow-hidden">
      <div class="absolute top-20 right-20 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div class="absolute bottom-20 left-20 w-64 h-64 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
    </div>

    <!-- 顶部导航 -->
    <nav class="relative z-10 bg-white/80 backdrop-blur-sm border-b border-orange-100 sticky top-0">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex items-center space-x-4">
            <div class="h-10 w-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold bg-gradient-to-r from-orange-600 to-orange-600 bg-clip-text text-transparent">
                Claude Code 管理中心
              </h1>
              <p class="text-xs text-gray-500">统一管理您的 AI 模型服务</p>
            </div>
          </div>
          <div class="flex items-center space-x-4">
            <!-- 当前使用模型 -->
            <div class="flex items-center space-x-2 bg-white/50 rounded-xl px-3 py-2">
              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span class="text-sm text-gray-700">当前:</span>
              <span class="text-sm font-medium text-orange-600">{{ dashboard?.currentModel?.name || '官方 Claude' }}</span>
            </div>
            
            <button @click="logout" 
                    class="text-gray-500 hover:text-orange-600 px-3 py-2 rounded-xl hover:bg-white/50 transition duration-200">
              退出登录
            </button>
          </div>
        </div>
      </div>
    </nav>

    <div class="relative z-10 max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
      <div class="px-4 sm:px-0">
        <!-- 统计卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white/80 backdrop-blur-sm overflow-hidden shadow-lg rounded-2xl border border-orange-100 hover:shadow-xl transition duration-300">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-600 truncate">Claude 账号状态</dt>
                    <dd class="text-2xl font-bold text-gray-900">{{ dashboard?.hasClaudeToken ? '已连接' : '未连接' }}</dd>
                    <dd :class="dashboard?.tokenExpired ? 'text-red-600' : 'text-green-600'" class="text-xs">
                      {{ dashboard?.tokenExpired ? 'Token 已过期' : 'Token 有效' }}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm overflow-hidden shadow-lg rounded-2xl border border-orange-100 hover:shadow-xl transition duration-300">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-600 truncate">模型供应商</dt>
                    <dd class="text-2xl font-bold text-gray-900">{{ dashboard?.providerCount || 0 }}</dd>
                    <dd class="text-xs text-emerald-600">已接入供应商数量</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white/80 backdrop-blur-sm overflow-hidden shadow-lg rounded-2xl border border-orange-100 hover:shadow-xl transition duration-300">
            <div class="p-6">
              <div class="flex items-center">
                <div class="flex-shrink-0">
                  <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                  </div>
                </div>
                <div class="ml-5 w-0 flex-1">
                  <dl>
                    <dt class="text-sm font-medium text-gray-600 truncate">Claude 账号</dt>
                    <dd class="text-2xl font-bold text-gray-900">{{ dashboard?.activeClaudeAccounts || 0 }}/{{ dashboard?.claudeAccountsCount || 0 }}</dd>
                    <dd class="text-xs text-blue-600">活跃/总数</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 标签页 -->
        <div class="bg-white/50 backdrop-blur-sm rounded-2xl p-1 mb-8">
          <nav class="flex space-x-1">
            <button @click="activeTab = 'claude-accounts'"
                    :class="activeTab === 'claude-accounts' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-orange-600 hover:bg-white/50'"
                    class="flex-1 py-3 px-6 text-sm font-medium rounded-xl transition duration-200">
              <div class="flex items-center justify-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                </svg>
                <span>Claude 账号</span>
              </div>
            </button>
            <button @click="activeTab = 'providers'" 
                    :class="activeTab === 'providers' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-orange-600 hover:bg-white/50'"
                    class="flex-1 py-3 px-6 text-sm font-medium rounded-xl transition duration-200">
              <div class="flex items-center justify-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                <span>模型供应商</span>
              </div>
            </button>
            <button @click="activeTab = 'models'"
                    :class="activeTab === 'models' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-orange-600 hover:bg-white/50'"
                    class="flex-1 py-3 px-6 text-sm font-medium rounded-xl transition duration-200">
              <div class="flex items-center justify-center space-x-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                </svg>
                <span>模型选择</span>
              </div>
            </button>
          </nav>
        </div>

        <!-- 模型供应商管理 -->
        <div v-if="activeTab === 'providers'">
          <div class="bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden rounded-2xl border border-orange-100">
            <div class="px-6 py-6">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-xl font-bold text-gray-900">模型供应商管理</h3>
                  <p class="text-sm text-gray-600 mt-1">管理接入的第三方模型供应商，如魔搭、智谱 AI 等</p>
                </div>
                <NuxtLink to="/admin/add-provider" 
                         class="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transform hover:scale-105 transition duration-200 shadow-lg flex items-center space-x-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  <span>添加供应商</span>
                </NuxtLink>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div v-for="provider in providers" :key="provider.id" 
                     class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border border-orange-200 rounded-2xl p-6 hover:shadow-lg transition duration-300 group">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <div>
                        <h4 class="text-lg font-bold text-gray-900">{{ provider.name }}</h4>
                        <p class="text-sm text-gray-500">
                          <span v-if="provider.type === 'openai'">OpenAI 兼容模型</span>
                          <span v-else-if="provider.type === 'google'">Google Gemini 模型</span>
                          <span v-else>{{ provider.type }} 模型</span>
                        </p>
                      </div>
                    </div>
                    <span :class="provider.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'"
                          class="px-3 py-1 text-xs font-medium rounded-full">
                      {{ provider.status === 'active' ? '• 活跃' : '• 停用' }}
                    </span>
                  </div>
                  <div class="space-y-3 mb-6">
                    <div class="flex items-center space-x-2 text-sm">
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
                      </svg>
                      <span class="text-gray-600 truncate">{{ provider.endpoint }}</span>
                    </div>
                    <div class="flex items-center space-x-2 text-sm">
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                      </svg>
                      <span class="text-gray-600">{{ maskApiKey(provider.apiKey) }}</span>
                    </div>
                  </div>
                  <div class="flex space-x-2">
                    <button @click="editProvider(provider)" 
                            class="px-4 py-2 text-orange-600 hover:text-orange-700 rounded-xl border border-orange-200 hover:border-orange-300 transition duration-200 text-sm">
                      编辑
                    </button>
                    <button @click="deleteProvider(provider.id)" 
                            class="px-4 py-2 text-red-600 hover:text-red-700 rounded-xl border border-red-200 hover:border-red-300 transition duration-200 text-sm">
                      删除
                    </button>
                  </div>
                </div>
              </div>
              <div v-if="providers.length === 0" class="text-center py-8">
                <p class="text-gray-500">暂无模型供应商</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型选择 -->
        <div v-if="activeTab === 'models'">
          <div class="bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden rounded-2xl border border-orange-100">
            <div class="px-6 py-6">
              <div class="mb-6">
                <h3 class="text-xl font-bold text-gray-900">模型选择器</h3>
                <p class="text-sm text-gray-600 mt-1">选择在 Claude Code 中使用的默认模型</p>
              </div>
              
              <div class="space-y-4">
                <div v-for="model in availableModels" :key="model.id" 
                     @click="selectModel(model)"
                     :class="dashboard?.currentModel?.id === model.id ? 'border-orange-400 bg-orange-50/50' : 'border-orange-200'"
                     class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border-2 rounded-2xl p-6 cursor-pointer hover:shadow-lg transition duration-300 group">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                      <div :class="model.type === 'official' ? 'from-orange-500 to-orange-600' : 'from-emerald-500 to-teal-600'"
                           class="w-12 h-12 bg-gradient-to-br rounded-2xl flex items-center justify-center">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path v-if="model.type === 'official'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <div>
                        <h4 class="text-lg font-bold text-gray-900">{{ model.name }}</h4>
                        <p class="text-sm text-gray-600">{{ model.type === 'official' ? 'Anthropic 官方模型' : '第三方模型供应商' }}</p>
                      </div>
                    </div>
                    <div class="flex items-center space-x-3">
                      <span class="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                        • 可用
                      </span>
                      <div v-if="dashboard?.currentModel?.id === model.id" 
                           class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                        </svg>
                      </div>
                      <div v-else class="w-6 h-6 border-2 border-gray-300 rounded-full group-hover:border-orange-400 transition duration-200"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Claude Code 账号管理 -->
        <div v-if="activeTab === 'claude-accounts'">
          <div class="bg-white/80 backdrop-blur-sm shadow-xl overflow-hidden rounded-2xl border border-orange-100">
            <div class="px-6 py-6">
              <div class="flex justify-between items-center mb-6">
                <div>
                  <h3 class="text-xl font-bold text-gray-900">Claude Code 账号管理</h3>
                  <p class="text-sm text-gray-600 mt-1">管理多个 Claude Code 账号，支持 OAuth 认证和自动 token 刷新</p>
                </div>
                <button @click="showAddAccountModal = true" 
                        class="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:from-orange-600 hover:to-orange-700 transform hover:scale-105 transition duration-200 shadow-lg flex items-center space-x-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  <span>添加账号</span>
                </button>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div v-for="account in claudeAccounts" :key="account.id" 
                     class="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm border border-orange-200 rounded-2xl p-6 hover:shadow-lg transition duration-300 group">
                  <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                      </div>
                      <div>
                        <h4 class="text-lg font-bold text-gray-900">{{ account.name }}</h4>
                        <p class="text-sm text-gray-500">{{ account.description || 'Claude Code 账号' }}</p>
                      </div>
                    </div>
                    <span :class="getAccountStatusClass(account.status)" class="px-3 py-1 text-xs font-medium rounded-full">
                      {{ getAccountStatusText(account.status) }}
                    </span>
                  </div>
                  
                  <div class="space-y-3 mb-6">
                    <div v-if="account.tokenInfo?.hasToken" class="space-y-2">
                      <div class="flex items-center space-x-2 text-sm">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                        <span class="text-gray-600">Token 状态: {{ account.tokenInfo.isExpired ? '已过期' : '有效' }}</span>
                      </div>
                      <div v-if="account.tokenInfo.expiresAt" class="flex items-center space-x-2 text-sm">
                        <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="text-gray-600">过期时间: {{ formatDate(account.tokenInfo.expiresAt) }}</span>
                      </div>
                    </div>
                    <div v-else class="flex items-center space-x-2 text-sm">
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"></path>
                      </svg>
                      <span class="text-gray-600">需要授权认证</span>
                    </div>
                  </div>
                  
                  <div class="flex space-x-2">
                    <button v-if="!account.tokenInfo?.hasToken" 
                            @click="startOAuthFlow(account)" 
                            class="px-4 py-2 text-orange-600 hover:text-orange-700 rounded-xl border border-orange-200 hover:border-orange-300 transition duration-200 text-sm">
                      授权登录
                    </button>
                    <button v-if="account.tokenInfo?.hasToken && account.tokenInfo.isExpired" 
                            @click="refreshAccountToken(account.id)" 
                            class="px-4 py-2 text-blue-600 hover:text-blue-700 rounded-xl border border-blue-200 hover:border-blue-300 transition duration-200 text-sm">
                      刷新 Token
                    </button>
                    <button @click="deleteAccount(account.id)" 
                            class="px-4 py-2 text-red-600 hover:text-red-700 rounded-xl border border-red-200 hover:border-red-300 transition duration-200 text-sm">
                      删除
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-if="claudeAccounts.length === 0" class="text-center py-8">
                <p class="text-gray-500">暂无 Claude Code 账号</p>
              </div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  </div>

  <!-- 添加账号模态框 -->
  <div v-if="showAddAccountModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
      <h3 class="text-lg font-bold text-gray-900 mb-4">添加 Claude Code 账号</h3>
      <form @submit.prevent="addAccount">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">账号名称</label>
            <input v-model="newAccount.name" type="text" required 
                   class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" 
                   placeholder="输入账号名称">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">描述（可选）</label>
            <input v-model="newAccount.description" type="text" 
                   class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" 
                   placeholder="输入账号描述">
          </div>
        </div>
        <div class="flex space-x-3 mt-6">
          <button type="button" @click="showAddAccountModal = false" 
                  class="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition duration-200">
            取消
          </button>
          <button type="submit" 
                  class="flex-1 py-2 px-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition duration-200">
            添加
          </button>
        </div>
      </form>
    </div>
  </div>

  <!-- OAuth 授权模态框 -->
  <div v-if="showOAuthModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
      <h3 class="text-lg font-bold text-gray-900 mb-4">OAuth 授权</h3>
      
      <div v-if="oauthStep === 1" class="space-y-4">
        <p class="text-sm text-gray-600">请点击下方按钮前往 Claude Code 完成授权</p>
        <div class="bg-orange-50 p-4 rounded-xl">
          <p class="text-sm text-orange-700 font-medium">重要提示：</p>
          <p class="text-sm text-orange-600 mt-1">授权完成后，请从浏览器地址栏复制 code 参数的值</p>
        </div>
        <div class="flex space-x-3">
          <button @click="showOAuthModal = false" 
                  class="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition duration-200">
            取消
          </button>
          <button @click="openAuthUrl" 
                  class="flex-1 py-2 px-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition duration-200">
            前往授权
          </button>
        </div>
      </div>
      
      <div v-if="oauthStep === 2" class="space-y-4">
        <p class="text-sm text-gray-600">请粘贴从地址栏复制的授权码</p>
        <input v-model="authCode" type="text" 
               class="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500" 
               placeholder="粘贴授权码...">
        <div class="flex space-x-3">
          <button @click="showOAuthModal = false" 
                  class="flex-1 py-2 px-4 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition duration-200">
            取消
          </button>
          <button @click="exchangeToken" :disabled="!authCode"
                  class="flex-1 py-2 px-4 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            完成授权
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- 编辑供应商模态框 -->
  <div v-if="showEditProviderModal && editingProvider" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4">
      <div class="px-6 py-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-xl font-bold text-gray-900">编辑供应商</h3>
          <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        
        <ProviderForm 
          :provider="editingProvider"
          :loading="editLoading"
          @submit="updateProvider"
          @cancel="cancelEdit" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardData } from '../../../../shared/types/admin/dashboard'
import type { ModelProvider, EditProviderRequest } from '../../../../shared/types/admin/providers'
import type { ClaudeAccount, AddClaudeAccountRequest } from '../../../../shared/types/admin/claude-accounts'
import { API_ENDPOINTS } from '../../../../shared/constants/endpoints'

useHead({
  title: 'Claude Code 管理中心 - 仪表板',
  meta: [
    { name: 'description', content: 'Claude Code 管理中心仪表板' }
  ]
})

const config = useRuntimeConfig()
const router = useRouter()

const activeTab = ref('claude-accounts')
const dashboard = ref<DashboardData | null>(null)
const providers = ref<ModelProvider[]>([])
const availableModels = ref<Array<{ id: string; name: string; type: 'official' | 'provider'; providerId?: string }>>([])

// Claude 账号相关数据
const claudeAccounts = ref<ClaudeAccount[]>([])
const showAddAccountModal = ref(false)
const showOAuthModal = ref(false)
const showEditProviderModal = ref(false)
const editLoading = ref(false)
const oauthStep = ref(1) // 1: 打开授权链接, 2: 输入授权码
const newAccount = ref<AddClaudeAccountRequest>({ name: '', description: '' })
const currentOAuthAccount = ref<ClaudeAccount | null>(null)
const editingProvider = ref<ModelProvider | null>(null)
const authCode = ref('')
const oauthData = ref<any>(null)

// 检查认证状态
onMounted(async () => {
  if (sessionStorage.getItem('admin_authenticated') !== 'true') {
    await router.push('/admin')
    return
  }
  
  await loadDashboardData()
  await loadProviders()
  await loadAvailableModels()
  await loadClaudeAccounts()
})

const loadDashboardData = async () => {
  try {
    const response = await $fetch<{ success: boolean; data: DashboardData }>(
      API_ENDPOINTS.ADMIN_DASHBOARD,
      { baseURL: config.public.apiBaseUrl }
    )
    if (response.success) {
      dashboard.value = response.data
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error)
  }
}

const loadProviders = async () => {
  try {
    const response = await $fetch<{ success: boolean; data: ModelProvider[] }>(
      API_ENDPOINTS.ADMIN_PROVIDERS,
      { baseURL: config.public.apiBaseUrl }
    )
    if (response.success) {
      providers.value = response.data
    }
  } catch (error) {
    console.error('Failed to load providers:', error)
  }
}

const loadAvailableModels = async () => {
  try {
    const response = await $fetch<{ success: boolean; data: Array<{ id: string; name: string; type: 'official' | 'provider'; providerId?: string }> }>(
      API_ENDPOINTS.ADMIN_MODELS,
      { baseURL: config.public.apiBaseUrl }
    )
    if (response.success) {
      availableModels.value = response.data
    }
  } catch (error) {
    console.error('Failed to load available models:', error)
  }
}

const selectModel = async (model: { id: string; name: string; type: 'official' | 'provider'; providerId?: string }) => {
  try {
    const response = await $fetch<{ success: boolean; data: any }>(
      API_ENDPOINTS.ADMIN_SELECT_MODEL,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl,
        body: {
          modelId: model.id,
          type: model.type,
          providerId: model.providerId
        }
      }
    )
    
    if (response.success) {
      await loadDashboardData() // 刷新仪表板数据
      showNotification(`已切换到: ${model.name}`, 'success')
    }
  } catch (error) {
    console.error('Failed to select model:', error)
    showNotification('切换模型失败', 'error')
  }
}

const editProvider = (provider: ModelProvider) => {
  editingProvider.value = { ...provider }
  showEditProviderModal.value = true
}

const updateProvider = async (request: EditProviderRequest) => {
  if (!editingProvider.value) return
  
  editLoading.value = true
  
  try {
    const response = await $fetch<{ success: boolean; data: ModelProvider }>(
      `${API_ENDPOINTS.ADMIN_PROVIDERS}/${editingProvider.value.id}`,
      {
        method: 'PUT',
        baseURL: config.public.apiBaseUrl,
        body: request
      }
    )
    
    if (response.success) {
      await loadProviders() // 刷新供应商列表
      await loadAvailableModels() // 刷新模型列表
      showEditProviderModal.value = false
      editingProvider.value = null
      showNotification('供应商更新成功', 'success')
    }
  } catch (error) {
    console.error('Failed to update provider:', error)
    showNotification('更新供应商失败', 'error')
  } finally {
    editLoading.value = false
  }
}

const cancelEdit = () => {
  showEditProviderModal.value = false
  editingProvider.value = null
}

const deleteProvider = async (id: string) => {
  if (!confirm('确定要删除这个供应商吗？')) return
  
  try {
    const response = await $fetch<{ success: boolean }>(
      `${API_ENDPOINTS.ADMIN_PROVIDERS}/${id}`,
      {
        method: 'DELETE',
        baseURL: config.public.apiBaseUrl
      }
    )
    
    if (response.success) {
      await loadProviders()
      await loadAvailableModels()
      await loadDashboardData()
      showNotification('删除供应商成功', 'success')
    }
  } catch (error) {
    console.error('Failed to delete provider:', error)
    showNotification('删除供应商失败', 'error')
  }
}

const maskApiKey = (apiKey: string) => {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return apiKey
  return apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4)
}

const logout = async () => {
  sessionStorage.removeItem('admin_authenticated')
  sessionStorage.removeItem('admin_username')
  await router.push('/admin')
}

const showNotification = (message: string, type: 'success' | 'error' = 'info') => {
  // 简单的通知实现
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

// ==================== Claude 账号管理方法 ====================

const loadClaudeAccounts = async () => {
  try {
    const response = await $fetch<{ success: boolean; data: ClaudeAccount[] }>(
      API_ENDPOINTS.ADMIN_CLAUDE_ACCOUNTS,
      { baseURL: config.public.apiBaseUrl }
    )
    if (response.success) {
      claudeAccounts.value = response.data
    }
  } catch (error) {
    console.error('Failed to load Claude accounts:', error)
  }
}

const addAccount = async () => {
  if (!newAccount.value.name.trim()) {
    showNotification('请输入账号名称', 'error')
    return
  }

  try {
    const response = await $fetch<{ success: boolean; data: ClaudeAccount }>(
      API_ENDPOINTS.ADMIN_CLAUDE_ACCOUNTS,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl,
        body: newAccount.value
      }
    )
    
    if (response.success) {
      await loadClaudeAccounts()
      await loadDashboardData()
      showAddAccountModal.value = false
      newAccount.value = { name: '', description: '' }
      showNotification('账号添加成功', 'success')
    }
  } catch (error) {
    console.error('Failed to add Claude account:', error)
    showNotification('添加账号失败', 'error')
  }
}

const deleteAccount = async (id: string) => {
  if (!confirm('确定要删除这个 Claude Code 账号吗？')) return
  
  try {
    const response = await $fetch<{ success: boolean }>(
      `${API_ENDPOINTS.ADMIN_CLAUDE_ACCOUNTS}/${id}`,
      {
        method: 'DELETE',
        baseURL: config.public.apiBaseUrl
      }
    )
    
    if (response.success) {
      await loadClaudeAccounts()
      await loadDashboardData()
      showNotification('账号删除成功', 'success')
    }
  } catch (error) {
    console.error('Failed to delete Claude account:', error)
    showNotification('删除账号失败', 'error')
  }
}

const startOAuthFlow = async (account: ClaudeAccount) => {
  try {
    const response = await $fetch<{ success: boolean; data: any }>(
      API_ENDPOINTS.ADMIN_CLAUDE_GENERATE_AUTH,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl,
        body: { accountId: account.id }
      }
    )
    
    if (response.success) {
      currentOAuthAccount.value = account
      oauthData.value = response.data
      oauthStep.value = 1
      showOAuthModal.value = true
    }
  } catch (error) {
    console.error('Failed to generate auth URL:', error)
    showNotification('生成授权链接失败', 'error')
  }
}

const openAuthUrl = () => {
  if (oauthData.value?.authUrl) {
    window.open(oauthData.value.authUrl, '_blank')
    oauthStep.value = 2
  }
}

const exchangeToken = async () => {
  if (!authCode.value.trim() || !currentOAuthAccount.value || !oauthData.value) {
    showNotification('请输入授权码', 'error')
    return
  }

  try {
    const response = await $fetch<{ success: boolean }>(
      API_ENDPOINTS.ADMIN_CLAUDE_EXCHANGE_TOKEN,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl,
        body: {
          accountId: currentOAuthAccount.value.id,
          code: authCode.value,
          pkce: oauthData.value.pkce
        }
      }
    )
    
    if (response.success) {
      await loadClaudeAccounts()
      await loadDashboardData()
      showOAuthModal.value = false
      authCode.value = ''
      oauthStep.value = 1
      currentOAuthAccount.value = null
      oauthData.value = null
      showNotification('授权成功', 'success')
    }
  } catch (error) {
    console.error('Failed to exchange token:', error)
    showNotification('授权失败，请检查授权码是否正确', 'error')
  }
}

const refreshAccountToken = async (accountId: string) => {
  try {
    const response = await $fetch<{ success: boolean }>(
      `${API_ENDPOINTS.ADMIN_CLAUDE_ACCOUNTS}/${accountId}/refresh`,
      {
        method: 'POST',
        baseURL: config.public.apiBaseUrl
      }
    )
    
    if (response.success) {
      await loadClaudeAccounts()
      await loadDashboardData()
      showNotification('Token 刷新成功', 'success')
    }
  } catch (error) {
    console.error('Failed to refresh token:', error)
    showNotification('Token 刷新失败', 'error')
  }
}

// 工具方法
const getAccountStatusClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-700'
    case 'expired':
      return 'bg-yellow-100 text-yellow-700'
    case 'inactive':
    default:
      return 'bg-red-100 text-red-700'
  }
}

const getAccountStatusText = (status: string) => {
  switch (status) {
    case 'active':
      return '• 活跃'
    case 'expired':
      return '• 已过期'
    case 'inactive':
    default:
      return '• 未授权'
  }
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>