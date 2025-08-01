/**
 * Hono validator 工具函数集
 */

import { validator } from 'hono/validator'
import { HTTPException } from 'hono/http-exception'

/**
 * 创建必填字段验证器
 * @param fields 必填字段列表
 */
export const requiredFields = (fields: string[]) => {
  return validator('json', (value: any) => {
    const missing: string[] = []
    
    for (const field of fields) {
      if (value[field] === undefined || value[field] === null || value[field] === '') {
        missing.push(field)
      }
    }
    
    if (missing.length > 0) {
      throw new HTTPException(400, {
        message: `以下字段不能为空: ${missing.join(', ')}`
      })
    }
    
    return value
  })
}

/**
 * 创建带自定义验证的验证器
 * @param validationFn 自定义验证函数
 */
export const customValidator = <T = any>(
  validationFn: (value: any) => T | Promise<T>
) => {
  return validator('json', async (value: any) => {
    try {
      return await validationFn(value)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }
      throw new HTTPException(400, {
        message: error instanceof Error ? error.message : '验证失败'
      })
    }
  })
}

/**
 * 路径参数必填验证器
 * @param params 必填的路径参数
 */
export const requiredParams = (params: string[]) => {
  return validator('param', (value: any) => {
    const missing: string[] = []
    
    for (const param of params) {
      if (!value[param]) {
        missing.push(param)
      }
    }
    
    if (missing.length > 0) {
      throw new HTTPException(400, {
        message: `缺少必需的路径参数: ${missing.join(', ')}`
      })
    }
    
    return value
  })
}

/**
 * 查询参数验证器
 * @param required 必填的查询参数
 */
export const queryValidator = (required: string[] = []) => {
  return validator('query', (value: any) => {
    const missing: string[] = []
    
    for (const param of required) {
      if (!value[param]) {
        missing.push(param)
      }
    }
    
    if (missing.length > 0) {
      throw new HTTPException(400, {
        message: `缺少必需的查询参数: ${missing.join(', ')}`
      })
    }
    
    return value
  })
}

/**
 * 组合多个验证器
 * @param validators 验证器函数数组
 */
export const combineValidators = <T = any>(
  validators: Array<(value: any) => void>
) => {
  return validator('json', (value: any) => {
    for (const validate of validators) {
      validate(value)
    }
    return value as T
  })
}