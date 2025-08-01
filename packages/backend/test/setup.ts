import { beforeAll, afterAll, beforeEach } from 'vitest'
import { LocalKVStorage } from '../src/utils/local-kv-storage'
import { rmSync } from 'fs'

// 测试用的 KV 存储实例
export let testKV: LocalKVStorage

// 全局设置
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test'
  process.env.ADMIN_USERNAME = 'test-admin'
  process.env.ADMIN_PASSWORD = 'test-password'
  
  // 创建测试专用的 KV 存储
  testKV = new LocalKVStorage('.test-kv-storage')
})

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