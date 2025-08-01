/**
 * Proxy 路由模块统一导出
 */

export { claudeRoutes } from './claude'

// 代理路由配置
export const PROXY_ROUTES = {
  claude: '/v1/*',
  health: '/v1/health'
} as const