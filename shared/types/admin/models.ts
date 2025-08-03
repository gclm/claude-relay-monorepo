/**
 * 模型选择相关类型定义
 */

export interface SelectedModel {
  id: string
  name: string
  type: 'claude' | 'route'  // claude: 官方模型，route: 路由配置
  routeId?: string  // 当 type 为 'route' 时使用
}

export interface SelectModelRequest {
  type: 'claude' | 'route'
  routeId?: string  // 当 type 为 'route' 时使用
}