<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
    <!-- Claude 账号状态 -->
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

    <!-- 模型供应商 -->
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

    <!-- Claude 账号数量 -->
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
</template>

<script setup lang="ts">
import type { DashboardData } from '../../../../shared/types/admin/dashboard'

interface Props {
  dashboard: DashboardData | null
}

defineProps<Props>()
</script>