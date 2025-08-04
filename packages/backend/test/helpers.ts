import { LocalKVStorage } from '../src/utils/local-kv-storage'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// 全局测试 KV 存储实例，在所有测试间共享但在每次测试前清理
let globalTestKV: LocalKVStorage | null = null

/**
 * 获取或创建全局测试 KV 存储实例
 * 使用后端实际的 .kv-storage 目录，可以测试前端配置的真实数据
 */
function getTestKV(): LocalKVStorage {
  if (!globalTestKV) {
    // 使用后端实际的 .kv-storage 目录
    const realKVPath = join(__dirname, '../.kv-storage')
    globalTestKV = new LocalKVStorage(realKVPath)
  }
  return globalTestKV
}

/**
 * 清理测试数据
 */
export async function clearTestData() {
  const kv = getTestKV()
  const result = await kv.list()
  for (const key of result.keys) {
    await kv.delete(key.name)
  }
}

/**
 * 创建测试用的应用实例
 * 直接复用 index.bun.ts 的逻辑，但使用独立的 KV 存储实例避免测试数据污染
 */
export function createTestApp() {
  const testKVStorage = getTestKV()
  
  // 创建测试用的 fetch 函数，复用 bun app 的环境设置逻辑
  const testFetch = async (request: Request) => {
    // 复用 index.bun.ts 的环境设置，但使用测试专用的 KV 存储
    const env = {
      NODE_ENV: 'test',
      ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'test-admin',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'test-password',
      CLAUDE_RELAY_ADMIN_KV: testKVStorage
    }
    
    // 创建最小的 ExecutionContext
    const ctx = {
      waitUntil: (_promise: Promise<any>) => { /* 测试中不执行 */ },
      passThroughOnException: () => { /* 测试中不执行 */ }
    }
    
    // 直接调用 worker app 的 fetch（index.bun.ts 内部使用的同一个）
    const workerApp = await import('../src/index')
    return workerApp.default.fetch(request, env, ctx as any)
  }
  
  return {
    request: testFetch,
    // 暴露 KV 存储实例，方便测试中直接访问
    kv: testKVStorage
  }
}

/**
 * 创建测试请求
 */
export function createTestRequest(path: string, options: RequestInit = {}) {
  const url = `http://localhost${path}`
  return new Request(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  })
}

/**
 * 获取管理员认证 token
 */
export async function getAdminToken() {
  // 在实际测试中，可以根据需要生成或模拟 token
  return 'test-admin-token'
}

/**
 * 创建带认证的请求
 */
export function createAuthenticatedRequest(path: string, options: RequestInit = {}) {
  return createTestRequest(path, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${getAdminToken()}`
    }
  })
}