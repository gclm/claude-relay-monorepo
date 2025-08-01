/**
 * 错误相关常量
 */

/**
 * HTTP 状态码
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

/**
 * 错误消息模板
 */
export const ERROR_MESSAGES = {
  INVALID_REQUEST: '请求格式无效',
  UNAUTHORIZED: '未授权访问',
  TOKEN_EXPIRED: 'Token 已过期',
  PROVIDER_NOT_FOUND: '未找到指定的模型供应商',
  MODEL_NOT_FOUND: '未找到指定的模型',
  KV_NOT_BOUND: 'KV 存储未正确绑定',
  INTERNAL_ERROR: '服务器内部错误'
} as const

/**
 * 错误代码
 */
export const ERROR_CODES = {
  INVALID_REQUEST: 'ERR_INVALID_REQUEST',
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  PROVIDER_ERROR: 'ERR_PROVIDER_ERROR',
  TRANSFORM_ERROR: 'ERR_TRANSFORM_ERROR',
  NETWORK_ERROR: 'ERR_NETWORK_ERROR'
} as const