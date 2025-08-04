import { beforeAll, afterAll, beforeEach } from 'vitest'
import { LocalKVStorage } from '../src/utils/local-kv-storage'
import { rmSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'fs'
import { join } from 'path'

// 测试用的 KV 存储实例
export let testKV: LocalKVStorage

// 全局设置
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test'
  process.env.ADMIN_USERNAME = 'test-admin'
  process.env.ADMIN_PASSWORD = 'test-password'
  
  // 复制实际 KV 数据到测试目录
  copyKVDataForTesting()
  
  // 创建测试专用的 KV 存储
  testKV = new LocalKVStorage('.test-kv-storage')
})

// 复制 .kv-storage 的数据到 .test-kv-storage 用于测试
function copyKVDataForTesting() {
  const sourceDir = '.kv-storage'
  const targetDir = '.test-kv-storage'
  
  // 确保测试目录存在
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true })
  }
  
  // 如果源目录存在，复制所有文件
  if (existsSync(sourceDir)) {
    try {
      const files = readdirSync(sourceDir)
      for (const file of files) {
        const sourcePath = join(sourceDir, file)
        const targetPath = join(targetDir, file)
        copyFileSync(sourcePath, targetPath)
      }
      console.log(`已复制 ${files.length} 个 KV 数据文件用于测试`)
    } catch (error) {
      console.warn('复制 KV 数据时出错:', error)
    }
  } else {
    console.log('未找到 .kv-storage 目录，使用空的测试数据')
  }
}

// 每个测试前重置
beforeEach(async () => {
  // 清空所有数据
  const result = await testKV.list()
  for (const key of result.keys) {
    await testKV.delete(key.name)
  }
})

afterAll(() => {
  // 清理测试目录
  try {
    rmSync('.test-kv-storage', { recursive: true, force: true })
  } catch (e) {
    // 忽略错误
  }
})