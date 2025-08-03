/**
 * Claude Proxy 集成测试
 * 使用预设的测试数据进行端到端测试
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createTestApp, createTestRequest } from '../../../helpers'

describe('Claude Proxy 集成测试', () => {
  let testApp: ReturnType<typeof createTestApp>

  beforeEach(() => {
    // 创建测试应用，会自动使用测试数据目录中的 KV 存储
    testApp = createTestApp()
    console.log('\n🧪 初始化测试应用，使用测试数据')
  })

  test('健康检查', async () => {
    console.log('\n🔍 测试：健康检查')
    
    const request = createTestRequest('/health')
    const response = await testApp.request(request)
    
    expect(response.status).toBe(200)
    const data = await response.json()
    console.log('健康检查响应:', data)
  })

  test('Claude API 健康检查', async () => {
    console.log('\n🔍 测试：Claude API 健康检查')
    
    const request = createTestRequest('/v1/health')
    const response = await testApp.request(request)
    
    expect(response.status).toBe(200)
    console.log('Claude API 健康检查通过')
  })

  test('简单聊天请求', async () => {
    console.log('\n🔍 测试：简单聊天请求')
    console.log('期望：使用路由配置，选择默认模型')
    
    const chatRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: '请简单回复：你好'
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(chatRequest)
    })

    console.log('发送请求:', JSON.stringify(chatRequest, null, 2))
    
    const response = await testApp.request(request)
    
    console.log('响应状态:', response.status)
    console.log('响应头:', Object.fromEntries(response.headers.entries()))
    
    // 检查 CORS 头
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    
    // 基本断言 - 应该返回 200 或者有意义的错误状态
    if (response.status !== 200) {
      const errorText = await response.text()
      console.log('错误响应:', errorText)
    } else {
      const responseText = await response.text()
      console.log('响应内容长度:', responseText.length)
      console.log('响应开头:', responseText.substring(0, 200))
    }
    
    console.log('✅ 请观察日志中的路由选择和模型选择')
  })

  test('长上下文请求', async () => {
    console.log('\n🔍 测试：长上下文请求')
    console.log('期望：触发长上下文路由，选择 glm-4-long 模型')
    
    const longContextRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `这是一个很长的上下文消息，用于测试长上下文路由。${'很长的文本内容 '.repeat(2000)}请简单回复。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(longContextRequest)
    })

    console.log('发送长上下文请求，内容长度:', JSON.stringify(longContextRequest).length)
    
    const response = await testApp.request(request)
    
    console.log('响应状态:', response.status)
    
    if (response.status !== 200) {
      const errorText = await response.text()
      console.log('错误响应:', errorText)
    } else {
      const responseText = await response.text()
      console.log('响应内容长度:', responseText.length)
    }
    
    console.log('✅ 请观察日志中是否选择了长上下文模型 (glm-4-long)')
  })

  test('思考模式请求', async () => {
    console.log('\n🔍 测试：思考模式请求')
    console.log('期望：识别数学问题，选择思考模式模型')
    
    const thinkRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: '解这个数学题：x^2 + 5x + 6 = 0，请详细说明解题步骤'
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(thinkRequest)
    })

    console.log('发送思考模式请求:', JSON.stringify(thinkRequest, null, 2))
    
    const response = await testApp.request(request)
    
    console.log('响应状态:', response.status)
    
    if (response.status !== 200) {
      const errorText = await response.text()
      console.log('错误响应:', errorText)
    } else {
      const responseText = await response.text()
      console.log('响应内容长度:', responseText.length)
    }
    
    console.log('✅ 请观察日志中是否选择了思考模式模型 (Qwen2.5-Math-72B)')
  })

  test('检查测试数据加载', async () => {
    console.log('\n🔍 测试：检查测试数据是否正确加载')
    
    // 检查供应商数据
    const providers = await testApp.kv.get('admin_model_providers')
    expect(providers).toBeTruthy()
    
    const providersData = JSON.parse(providers)
    console.log(`✅ 加载了 ${providersData.length} 个供应商:`, providersData.map((p: any) => p.name))
    
    // 检查路由配置
    const selectedConfig = await testApp.kv.get('admin_selected_config')
    expect(selectedConfig).toBeTruthy()
    
    const configData = JSON.parse(selectedConfig)
    console.log('✅ 当前选择的配置:', configData)
    
    // 检查路由配置详情
    if (configData.type === 'route' && configData.routeId) {
      const routeConfig = await testApp.kv.get(`admin_route_config:${configData.routeId}`)
      expect(routeConfig).toBeTruthy()
      
      const routeData = JSON.parse(routeConfig)
      console.log('✅ 路由配置详情:', routeData.name, routeData.rules)
    }
    
    // 检查 Key Pool 数据
    const keyPoolKeys = (await testApp.kv.list({ prefix: 'key_pool_' })).keys
    console.log(`✅ 找到 ${keyPoolKeys.length} 个 Key Pool:`, keyPoolKeys.map(k => k.name))
  })
})

console.log(`
📋 集成测试说明：

1. 测试使用预设的测试数据（位于 test/integration/services/proxy/data/.kv-storage/）
2. 观察控制台日志，查看：
   - 路由选择逻辑
   - 模型选择过程  
   - Key Pool 轮换
   - API 调用状态

3. 测试场景：
   - 简单聊天（默认路由）
   - 长上下文（长上下文路由）
   - 数学问题（思考模式路由）

4. 运行命令：
   npm run test test/integration/services/proxy/claude-proxy.test.ts
`)