/**
 * 中间件相关类型定义
 */

import { Context } from 'hono'
import { Bindings } from '../env'

/**
 * 中间件上下文类型
 */
export type MiddlewareContext = Context<{ Bindings: Bindings }>

/**
 * 错误处理中间件配置
 */
export interface ErrorHandlerConfig {
  logErrors?: boolean
  includeStackTrace?: boolean
  customFormatter?: (error: Error) => any
}

/**
 * KV 验证中间件配置
 */
export interface KVValidatorConfig {
  required?: boolean
  errorMessage?: string
}