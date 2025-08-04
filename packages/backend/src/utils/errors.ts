/**
 * 自定义异常类
 */

import { ErrorType } from '../../../../shared/constants/errors'

export class AppError extends Error {
  constructor(
    public errorType: ErrorType,
    message?: string,
    public originalError?: Error
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class AuthError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('TOKEN_EXCHANGE_FAILED', message, originalError)
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('INVALID_REQUEST', message)
  }
}


export class TokenExpiredError extends AppError {
  constructor(message: string) {
    super('TOKEN_EXPIRED', message)
  }
}

export class ProxyError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('PROXY_ERROR', message, originalError)
  }
}

export class ResourceNotFoundError extends AppError {
  constructor(message: string) {
    super('RESOURCE_NOT_FOUND', message)
  }
}