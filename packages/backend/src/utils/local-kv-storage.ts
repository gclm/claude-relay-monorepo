/**
 * 本地 KV 存储 - 兼容 Cloudflare KV Namespace 接口
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export class LocalKVStorage {
  private dataFile: string
  private data: Record<string, string> = {}

  constructor(basePath = '.kv-storage') {
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }
    
    this.dataFile = join(basePath, 'data.json')
    this.load()
  }

  private load() {
    if (existsSync(this.dataFile)) {
      try {
        this.data = JSON.parse(readFileSync(this.dataFile, 'utf-8'))
      } catch {
        this.data = {}
      }
    }
  }

  private save() {
    writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2))
  }

  async get(key: string, options?: { type?: string }): Promise<any> {
    const value = this.data[key] || null
    if (!value) return null
    
    // 支持 json 类型
    if (options?.type === 'json') {
      try {
        return JSON.parse(value)
      } catch {
        return null
      }
    }
    
    return value
  }

  async put(key: string, value: string | any): Promise<void> {
    // 处理对象自动转 JSON
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value)
    this.data[key] = stringValue
    this.save()
  }

  async delete(key: string): Promise<void> {
    delete this.data[key]
    this.save()
  }

  async list(options?: { prefix?: string }): Promise<any> {
    const keys = Object.keys(this.data)
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .map(name => ({ name }))
    return { 
      keys,
      list_complete: true,
      cacheStatus: null
    }
  }

  // 兼容方法 - 简单实现
  async getWithMetadata(): Promise<any> {
    throw new Error('getWithMetadata not implemented in local storage')
  }
}