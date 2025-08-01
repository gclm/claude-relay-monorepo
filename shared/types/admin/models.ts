/**
 * 模型选择相关类型定义
 */

export interface SelectedModel {
  id: string
  name: string
  type: 'official' | 'provider'
  providerId?: string
}

export interface SelectModelRequest {
  modelId: string
  type: 'official' | 'provider'
  providerId?: string
}