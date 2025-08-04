/**
 * 统一错误处理 Composable - 简化版
 * 提供全局的错误处理、展示和管理功能
 */

import { ref } from 'vue'

export interface AppError {
  message: string
  details?: any
  timestamp: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    details?: any
  }
  timestamp: string
}

// 全局错误状态
const globalError = ref<AppError | null>(null)
const errorHistory = ref<AppError[]>([])

export const useErrorHandler = () => {
  
  /**
   * 解析 API 错误响应
   */
  const parseApiError = (err: any): AppError => {
    // 1. 标准 API 错误响应格式
    if (err?.data?.error?.message) {
      return {
        message: err.data.error.message,
        details: err.data.error.details,
        timestamp: err.data.timestamp || new Date().toISOString()
      }
    }
    
    // 2. Nuxt $fetch 错误
    if (err?.data && typeof err.data === 'object') {
      return {
        message: err.data.message || err.message || '请求失败',
        details: err.data,
        timestamp: new Date().toISOString()
      }
    }
    
    // 3. 网络错误或其他错误
    if (err?.message) {
      return {
        message: err.message,
        timestamp: new Date().toISOString()
      }
    }
    
    // 4. 字符串错误
    if (typeof err === 'string') {
      return {
        message: err,
        timestamp: new Date().toISOString()
      }
    }
    
    // 5. 未知错误
    return {
      message: '发生未知错误，请重试',
      details: err,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * 处理错误并显示
   */
  const handleError = (error: any, context?: string) => {
    const appError = parseApiError(error)
    
    // 添加上下文信息
    if (context) {
      appError.details = {
        ...appError.details,
        context
      }
    }
    
    // 设置全局错误状态
    globalError.value = appError
    
    // 添加到错误历史
    errorHistory.value.unshift(appError)
    
    // 限制历史记录数量
    if (errorHistory.value.length > 50) {
      errorHistory.value = errorHistory.value.slice(0, 50)
    }
    
    // 控制台输出错误详情（开发模式）
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Error Handler] ${context || 'Unknown context'}:`, error)
      console.error('[Parsed Error]:', appError)
    }
    
    return appError
  }

  /**
   * 清除全局错误
   */
  const clearError = () => {
    globalError.value = null
  }

  /**
   * 获取用户友好的错误消息（基于 HTTP 状态码）
   */
  const getFriendlyMessage = (error: AppError): string => {
    // 直接使用错误消息，或根据常见错误模式提供友好提示
    const message = error.message.toLowerCase()
    
    if (message.includes('unauthorized') || message.includes('未授权') || message.includes('登录')) {
      return '未授权访问，请重新登录'
    }
    
    if (message.includes('not found') || message.includes('不存在')) {
      return '请求的资源不存在'
    }
    
    if (message.includes('invalid') || message.includes('无效') || message.includes('参数')) {
      return '请求参数有误，请检查输入'
    }
    
    if (message.includes('network') || message.includes('网络') || message.includes('连接')) {
      return '网络连接异常，请检查网络后重试'
    }
    
    // 默认返回原始错误消息
    return error.message
  }

  /**
   * 显示通知消息（成功、信息、警告）
   */
  const showNotification = (
    message: string, 
    type: 'success' | 'info' | 'warning' | 'error' = 'info',
    duration: number = 3000
  ) => {
    const notification = document.createElement('div')
    const bgColors = {
      success: 'bg-emerald-500',
      info: 'bg-blue-500', 
      warning: 'bg-orange-500',
      error: 'bg-red-500'
    }
    
    notification.className = `fixed top-4 right-4 z-50 px-6 py-3 rounded-xl text-white font-medium shadow-lg transform translate-x-full transition-transform duration-300 ${bgColors[type]}`
    notification.textContent = message
    document.body.appendChild(notification)
    
    // 显示动画
    setTimeout(() => {
      notification.classList.remove('translate-x-full')
    }, 100)
    
    // 隐藏动画
    setTimeout(() => {
      notification.classList.add('translate-x-full')
      setTimeout(() => {
        document.body.removeChild(notification)
      }, 300)
    }, duration)
  }

  /**
   * 包装异步操作的错误处理
   */
  const withErrorHandling = async <T>(
    operation: () => Promise<T>,
    context?: string,
    showSuccess = false,
    successMessage = '操作成功'
  ): Promise<T | null> => {
    try {
      const result = await operation()
      
      if (showSuccess) {
        showNotification(successMessage, 'success')
      }
      
      return result
    } catch (error) {
      handleError(error, context)
      return null
    }
  }

  return {
    // 状态
    globalError: globalError,
    errorHistory: errorHistory,
    
    // 方法
    handleError,
    clearError,
    parseApiError,
    getFriendlyMessage,
    showNotification,
    withErrorHandling
  }
}