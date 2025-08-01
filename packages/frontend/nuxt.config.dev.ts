import baseConfig from './nuxt.config'

export default defineNuxtConfig({
  ...baseConfig,
  // 开发模式特定优化
  compatibilityDate: '2025-07-27',
  
  // 开发服务器端口
  devServer: {
    port: 3000
  },
  
  // 开发工具
  devtools: { enabled: true },
  
  // 精简的模块配置（开发必需）
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],
  
  // CSS 配置
  css: ['~/assets/css/main.css'],
  
  // 开发模式 Vite 优化
  vite: {
    // 清空缓存以确保最新代码
    clearScreen: true,
    // 更快的依赖预构建
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia'],
      exclude: ['@nuxtjs/tailwindcss']  // Tailwind 不需要预构建
    },
    // 开发服务器优化
    server: {
      // 更快的热重载
      hmr: {
        overlay: false,  // 禁用错误覆盖层，减少干扰
        port: 24678     // 固定 HMR 端口
      },
      // 文件监听优化（如果需要可以启用）
      watch: {
        usePolling: false,  // 默认不使用轮询
        ignored: ['**/node_modules/**', '**/.git/**']
      }
    },
    // 开发构建优化
    build: {
      // 开发模式不需要压缩
      minify: false,
      // 快速构建，不优化
      cssCodeSplit: false,
      // 启用 source map 便于调试
      sourcemap: 'inline',
      // 不检查 chunk 大小
      chunkSizeWarningLimit: Infinity
    }
  },
  
  // Nitro 开发配置
  nitro: {
    // 使用 Node.js 预设，启动更快
    preset: 'node-server',
    // 开发模式
    dev: true,
    // 开发服务器配置
    devServer: {
      watch: ['./']
    },
    // 禁用压缩
    compressPublicAssets: false,
    // 不预渲染
    prerender: {
      routes: []
    }
  },
  
  // 开发性能优化
  ssr: true,
  
  // TypeScript 配置（开发模式放宽限制）
  typescript: {
    typeCheck: false,  // 禁用类型检查加快启动
    strict: false,     // 非严格模式
    shim: false       // 不需要 shim
  },
  
  // 环境变量配置
  runtimeConfig: {
    public: {
      apiBaseUrl: 'http://localhost:8787',
      appName: 'Claude Relay Frontend (Dev)',
      appVersion: '1.0.0-dev'
    }
  },
  
  // Tailwind CSS 开发配置
  tailwindcss: {
    cssPath: '~/assets/css/main.css',
    viewer: false  // 禁用 Tailwind viewer，减少开销
  },
  
  // 实验性功能（开发模式禁用）
  experimental: {
    payloadExtraction: false,
    viewTransition: false,
    componentIslands: false,
    asyncContext: false
  },
  
  // 日志级别
  logLevel: 'info'
})