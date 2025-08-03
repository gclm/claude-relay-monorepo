/**
 * 路由配置相关类型定义
 */

/**
 * 模型目标
 */
export interface ModelTarget {
  providerId: string  // 供应商 ID
  model: string      // 具体模型名称
}

/**
 * 路由规则
 */
export interface RouteRules {
  default: ModelTarget              // 默认模型（必填）
  longContext?: ModelTarget        // 长上下文模型（可选）
  background?: ModelTarget         // 后台任务模型（可选）
  think?: ModelTarget              // 思考模型（可选）
  webSearch?: ModelTarget          // 网络搜索模型（可选）
}

/**
 * 路由配置选项
 */
export interface RouteConfigOptions {
  longContextThreshold?: number    // 长上下文阈值（字符数）
  [key: string]: any              // 允许其他自定义配置
}

/**
 * 路由配置
 */
export interface RouteConfig {
  id: string
  name: string
  description?: string
  rules: RouteRules                // 路由规则
  config?: RouteConfigOptions      // 配置选项
  status: 'active' | 'inactive'    // 状态
  createdAt: string                // ISO 8601 时间字符串
  updatedAt: string                // ISO 8601 时间字符串
}

/**
 * 添加路由配置请求
 */
export interface AddRouteConfigRequest {
  name: string
  description?: string
  rules: RouteRules
  config?: RouteConfigOptions
}

/**
 * 编辑路由配置请求
 */
export interface EditRouteConfigRequest {
  name?: string
  description?: string
  rules?: RouteRules
  config?: RouteConfigOptions
  status?: 'active' | 'inactive'
}