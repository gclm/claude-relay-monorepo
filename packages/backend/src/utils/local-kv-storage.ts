/**
 * 本地 KV 存储 - 兼容 Cloudflare KV Namespace 接口
 * 每个 key 存储为单独的 JSON 文件，便于调试和测试
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

export class LocalKVStorage {
  private basePath: string

  constructor(basePath = '.kv-storage') {
    this.basePath = basePath
    if (!existsSync(basePath)) {
      mkdirSync(basePath, { recursive: true })
    }
  }

  /**
   * 将 KV key 转换为安全的文件名
   */
  private keyToFileName(key: string): string {
    // 替换文件系统不允许的字符
    return key.replace(/[<>:"/\\|?*]/g, '_') + '.json'
  }

  /**
   * 从文件名恢复 KV key
   */
  private fileNameToKey(fileName: string): string {
    return fileName.replace(/\.json$/, '').replace(/_/g, ':')
  }

  /**
   * 获取 key 对应的文件路径
   */
  private getFilePath(key: string): string {
    return join(this.basePath, this.keyToFileName(key))
  }

  async get(key: string, options?: { type?: string }): Promise<any> {
    const filePath = this.getFilePath(key)
    
    if (!existsSync(filePath)) {
      return null
    }
    
    try {
      const content = readFileSync(filePath, 'utf-8')
      
      // 支持 json 类型
      if (options?.type === 'json') {
        return JSON.parse(content)
      }
      
      // 默认返回字符串
      return content
    } catch (error) {
      console.warn(`Error reading KV file ${filePath}:`, error)
      return null
    }
  }

  async put(key: string, value: string | any): Promise<void> {
    const filePath = this.getFilePath(key)
    
    try {
      let content: string
      
      if (typeof value === 'string') {
        // 如果是字符串，尝试解析为 JSON 再格式化
        try {
          const parsed = JSON.parse(value)
          content = JSON.stringify(parsed, null, 2)
        } catch {
          // 如果不是有效的 JSON，直接存储字符串
          content = value
        }
      } else {
        // 如果是对象，格式化为 JSON
        content = JSON.stringify(value, null, 2)
      }
      
      writeFileSync(filePath, content, 'utf-8')
    } catch (error) {
      console.error(`Error writing KV file ${filePath}:`, error)
      throw error
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key)
    
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
      } catch (error) {
        console.error(`Error deleting KV file ${filePath}:`, error)
        throw error
      }
    }
  }

  async list(options?: { prefix?: string }): Promise<any> {
    try {
      const files = readdirSync(this.basePath).filter(file => file.endsWith('.json'))
      const keys = files
        .map(file => this.fileNameToKey(file))
        .filter(key => !options?.prefix || key.startsWith(options.prefix))
        .map(name => ({ name }))
      
      return { 
        keys,
        list_complete: true,
        cacheStatus: null
      }
    } catch (error) {
      console.error('Error listing KV files:', error)
      return { 
        keys: [],
        list_complete: true,
        cacheStatus: null
      }
    }
  }

  // 兼容方法 - 简单实现
  async getWithMetadata(): Promise<any> {
    throw new Error('getWithMetadata not implemented in local storage')
  }
}