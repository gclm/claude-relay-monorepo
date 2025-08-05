/**
 * Claude Proxy Gemini 集成测试
 * 模拟真实的编程场景，测试 Claude-to-Gemini 转换器
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createTestApp, createTestRequest } from '../../../helpers'

describe('Claude Proxy Gemini 集成测试', () => {
  let testApp: ReturnType<typeof createTestApp>

  beforeEach(() => {
    testApp = createTestApp()
    console.log('🧪 初始化测试应用，连接 Gemini 2.5 Pro')
  })

  test('健康检查', async () => {
    console.log('🔍 测试：系统健康检查')
    
    const request = createTestRequest('/v1/health')
    const response = await testApp.request(request)
    
    expect(response.status).toBe(200)
    console.log('✅ 系统健康检查通过')
  })

  test('编程助手场景：代码调试', async () => {
    console.log('🔍 测试：代码调试场景')
    
    const debugRequest = {
      model: 'claude-3-5-sonnet-20241022', // 路由到 gemini-2.5-pro
      messages: [
        {
          role: 'user',
          content: `我的 JavaScript 函数有问题，请帮我调试：

\`\`\`javascript
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

const cart = [
  { price: 10, quantity: 2 },
  { price: 5, quantity: 3 }
];

console.log(calculateTotal(cart));
\`\`\`

这个函数运行时出错了，请找出问题并提供修复方案。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(debugRequest)
    })

    console.log('📤 发送代码调试请求到 Gemini')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查响应是否包含调试相关内容
    const hasDebuggingContent = responseText.includes('索引') || 
                               responseText.includes('边界') || 
                               responseText.includes('<=') ||
                               responseText.includes('修复')
    
    if (hasDebuggingContent) {
      console.log('✅ Gemini 成功识别并调试了代码问题')
    }
    
    console.log('📝 响应预览:', responseText)
  }, 30000)

  test('编程助手场景：代码重构', async () => {
    console.log('🔍 测试：代码重构场景')
    
    const refactorRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `请帮我重构这个 React 组件，使其更加现代化和高效：

\`\`\`jsx
class UserList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      users: [],
      loading: true
    };
  }

  componentDidMount() {
    fetch('/api/users')
      .then(response => response.json())
      .then(users => {
        this.setState({ users, loading: false });
      });
  }

  render() {
    if (this.state.loading) {
      return <div>Loading...</div>;
    }

    return (
      <div>
        {this.state.users.map(user => (
          <div key={user.id}>
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
        ))}
      </div>
    );
  }
}
\`\`\`

请重构为现代的函数组件，使用 Hooks。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(refactorRequest)
    })

    console.log('📤 发送代码重构请求到 Gemini')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含现代 React 特性
    const hasModernReact = responseText.includes('useState') || 
                          responseText.includes('useEffect') || 
                          responseText.includes('const ') ||
                          responseText.includes('function')
    
    if (hasModernReact) {
      console.log('✅ Gemini 成功重构为现代 React 组件')
    }
    
    console.log('📝 响应预览:', responseText)
  }, 30000)

  test('编程助手场景：算法优化', async () => {
    console.log('🔍 测试：算法优化场景')
    
    const optimizeRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `我需要优化这个查找算法的性能：

\`\`\`python
def find_user_by_email(users, target_email):
    for user in users:
        if user['email'] == target_email:
            return user
    return None

# 使用示例
users = [
    {'id': 1, 'name': 'Alice', 'email': 'alice@example.com'},
    {'id': 2, 'name': 'Bob', 'email': 'bob@example.com'},
    # ... 可能有上万个用户
]

user = find_user_by_email(users, 'bob@example.com')
\`\`\`

这个算法在用户数量很大时性能很差，请提供优化方案。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(optimizeRequest)
    })

    console.log('📤 发送算法优化请求到 Gemini')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含优化相关内容
    const hasOptimization = responseText.includes('字典') || 
                           responseText.includes('哈希') || 
                           responseText.includes('索引') ||
                           responseText.includes('O(1)') ||
                           responseText.includes('dict')
    
    if (hasOptimization) {
      console.log('✅ Gemini 成功提供了算法优化方案')
    }
    
    console.log('📝 响应预览:', responseText)
  }, 30000)

  test('编程助手场景：流式响应', async () => {
    console.log('🔍 测试：流式响应编程场景')
    
    const streamRequest = {
      model: 'claude-3-5-sonnet-20241022',
      stream: true,
      messages: [
        {
          role: 'user',
          content: '请详细解释 TypeScript 中的泛型概念，并提供实用的代码示例。'
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(streamRequest)
    })

    console.log('📤 发送流式响应请求到 Gemini')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    console.log('📥 响应头:', Object.fromEntries(response.headers.entries()))
    
    if (response.status === 200) {
      expect(response.headers.get('Content-Type')).toContain('text/event-stream')
      console.log('✅ 正确设置了流式响应头')
      
      const responseText = await response.text()
      console.log('📊 流式响应长度:', responseText.length, '字符')
      
      // 检查 SSE 格式
      if (responseText.includes('data:') && responseText.includes('event:')) {
        console.log('✅ 检测到正确的 SSE 格式')
      }
      
      console.log('📝 流式响应开头:', responseText.substring(0, 300) + '...')
    }
  }, 30000)

  test('编程助手场景：多轮对话', async () => {
    console.log('🔍 测试：多轮编程对话场景')
    
    const conversationRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '我想学习 React Hooks，请介绍最重要的几个。'
        },
        {
          role: 'assistant',
          content: 'React Hooks 是 React 16.8 引入的重要特性。最重要的几个 Hooks 包括：\n\n1. **useState** - 管理组件状态\n2. **useEffect** - 处理副作用\n3. **useContext** - 访问 Context\n4. **useCallback** - 缓存函数\n5. **useMemo** - 缓存计算结果\n\n你想深入了解哪一个？'
        },
        {
          role: 'user',
          content: '请详细讲解 useEffect，包括依赖数组和清理函数的使用。'
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(conversationRequest)
    })

    console.log('📤 发送多轮对话请求到 Gemini')
    console.log('💬 消息数量:', conversationRequest.messages.length)
    
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含 useEffect 相关内容
    const hasUseEffectContent = responseText.includes('useEffect') || 
                               responseText.includes('依赖数组') || 
                               responseText.includes('清理函数') ||
                               responseText.includes('副作用')
    
    if (hasUseEffectContent) {
      console.log('✅ Gemini 在多轮对话中正确理解了上下文')
    }
    
    console.log('📝 响应预览:', responseText)
  }, 30000)
})