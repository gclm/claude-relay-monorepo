/**
 * Routes 层统一导出
 * 提供所有路由模块的集中访问点
 */

// 导出所有路由
export { adminRoutes } from './admin'
export { claudeRoutes } from './proxy'

// 路由配置类型
export interface RouteConfig {
  path: string
  description: string
  module: string
}

// 路由清单（用于文档或自动化）
export const ROUTE_MANIFEST: RouteConfig[] = [
  {
    path: '/api/admin/*',
    description: '管理中心 API 路由',
    module: 'admin'
  },
  {
    path: '/v1/*',
    description: 'Claude API 代理路由',
    module: 'claude'
  }
]