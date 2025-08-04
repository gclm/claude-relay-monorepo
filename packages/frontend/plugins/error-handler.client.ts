/**
 * 错误处理插件 - 客户端专用
 * 注册全局错误处理功能
 */

export default defineNuxtPlugin(() => {
  // 全局错误处理
  const { handleError } = useErrorHandler()
  
  // 处理未捕获的 Promise 错误
  if (process.client) {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason)
      handleError(event.reason, 'Unhandled Promise Rejection')
      
      // 阻止默认的控制台错误输出
      event.preventDefault()
    })

    // 处理未捕获的 JavaScript 错误
    window.addEventListener('error', (event) => {
      console.error('Unhandled error:', event.error)
      handleError(event.error, 'JavaScript Error')
    })
  }
})