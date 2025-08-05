/**
 * Claude Proxy OpenAI 集成测试
 * 模拟真实的编程场景，测试 Claude-to-OpenAI 转换器
 * 包含工具调用、流式响应等完整场景
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { createTestApp, createTestRequest } from '../../../helpers'

describe('Claude Proxy OpenAI 集成测试', () => {
  let testApp: ReturnType<typeof createTestApp>

  beforeEach(() => {
    testApp = createTestApp()
    console.log('🧪 初始化测试应用，连接 OpenAI API')
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
      model: 'claude-3-5-sonnet-20241022', // 路由到 OpenAI GPT-4
      messages: [
        {
          role: 'user',
          content: `我的 Python 函数有问题，请帮我调试：

\`\`\`python
def process_orders(orders):
    total_revenue = 0
    processed_orders = []
    
    for order in orders:
        if order['status'] == 'pending':
            # 计算订单总价
            order_total = 0
            for item in order['items']:
                order_total += item['price'] * item['quantity']
            
            # 应用折扣
            if order['discount'] > 0:
                order_total = order_total * (1 - order['discount'])
            
            processed_orders.append({
                'id': order['id'],
                'total': order_total,
                'status': 'processed'
            })
            
            total_revenue += order_total
    
    return total_revenue, processed_orders

# 测试数据
orders = [
    {
        'id': 1,
        'status': 'pending',
        'items': [
            {'price': 100, 'quantity': 2},
            {'price': 50, 'quantity': 1}
        ],
        'discount': 0.1
    },
    {
        'id': 2,
        'status': 'completed',
        'items': [{'price': 200, 'quantity': 1}]
    }
]

revenue, processed = process_orders(orders)
print(f"Total revenue: {revenue}")
\`\`\`

这个函数逻辑有什么问题吗？请指出潜在的 bug 并提供改进建议。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(debugRequest)
    })

    console.log('📤 发送代码调试请求到 OpenAI')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查响应是否包含调试相关内容
    const hasDebuggingContent = responseText.includes('discount') || 
                               responseText.includes('KeyError') || 
                               responseText.includes('错误') ||
                               responseText.includes('bug') ||
                               responseText.includes('改进')
    
    if (hasDebuggingContent) {
      console.log('✅ OpenAI 成功识别并调试了代码问题')
    }
    
    console.log('📝 响应预览:', responseText.substring(0, 500) + '...')
  }, 30000)

  test('编程助手场景：工具调用 - 代码执行', async () => {
    console.log('🔍 测试：工具调用代码执行场景')
    
    const toolCallRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '请帮我计算斐波那契数列的第10项，并解释算法复杂度。你可以使用代码执行工具来验证结果。'
        }
      ],
      tools: [
        {
          name: 'execute_python',
          description: '执行 Python 代码并返回结果',
          input_schema: {
            type: 'object',
            properties: {
              code: {
                type: 'string',
                description: '要执行的 Python 代码'
              }
            },
            required: ['code']
          }
        },
        {
          name: 'analyze_complexity',
          description: '分析算法时间和空间复杂度',
          input_schema: {
            type: 'object',
            properties: {
              algorithm_name: {
                type: 'string',
                description: '算法名称'
              },
              code: {
                type: 'string',
                description: '算法代码'
              }
            },
            required: ['algorithm_name', 'code']
          }
        }
      ],
      tool_choice: 'auto'
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(toolCallRequest)
    })

    console.log('📤 发送工具调用请求到 OpenAI')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含工具调用
    const hasToolCall = responseText.includes('tool_use') || 
                       responseText.includes('execute_python') ||
                       responseText.includes('analyze_complexity')
    
    if (hasToolCall) {
      console.log('✅ OpenAI 成功生成了工具调用')
    }
    
    console.log('📝 工具调用响应预览:', responseText.substring(0, 800) + '...')
  }, 30000)

  test('编程助手场景：多步骤工具调用', async () => {
    console.log('🔍 测试：多步骤工具调用场景')
    
    // 第一步：发送包含工具调用的请求
    const initialRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '请帮我设计一个简单的用户管理系统的数据库表结构，然后生成对应的 SQL 创建语句。'
        }
      ],
      tools: [
        {
          name: 'design_database_schema',
          description: '设计数据库表结构',
          input_schema: {
            type: 'object',
            properties: {
              table_name: {
                type: 'string',
                description: '表名'
              },
              columns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    type: { type: 'string' },
                    constraints: { type: 'array', items: { type: 'string' } }
                  }
                },
                description: '表列定义'
              }
            },
            required: ['table_name', 'columns']
          }
        },
        {
          name: 'generate_sql',
          description: '根据表结构生成 SQL 语句',
          input_schema: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['CREATE_TABLE', 'INSERT', 'SELECT', 'UPDATE', 'DELETE']
              },
              table_schema: {
                type: 'object',
                description: '表结构定义'
              }
            },
            required: ['operation', 'table_schema']
          }
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(initialRequest)
    })

    console.log('📤 发送多步骤工具调用请求到 OpenAI')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 解析响应，检查工具调用
    const hasDesignTool = responseText.includes('design_database_schema')
    const hasGenerateTool = responseText.includes('generate_sql')
    
    if (hasDesignTool || hasGenerateTool) {
      console.log('✅ OpenAI 成功生成了数据库相关的工具调用')
    }
    
    console.log('📝 多步骤工具调用响应预览:', responseText.substring(0, 600) + '...')
  }, 30000)

  test('编程助手场景：带工具结果的对话', async () => {
    console.log('🔍 测试：带工具结果的完整对话场景')
    
    const conversationWithToolsRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '请帮我分析一个 API 的性能，检查响应时间是否正常。'
        },
        {
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: '我来帮你分析 API 性能。让我先检查一下 API 的响应时间。'
            },
            {
              type: 'tool_use',
              id: 'toolu_api_check_001',
              name: 'check_api_performance',
              input: {
                url: 'https://jsonplaceholder.typicode.com/posts/1',
                method: 'GET',
                timeout: 5000
              }
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_api_check_001',
              content: JSON.stringify({
                status_code: 200,
                response_time_ms: 245,
                content_length: 292,
                headers: {
                  'content-type': 'application/json; charset=utf-8',
                  'cache-control': 'max-age=43200'
                }
              })
            }
          ]
        },
        {
          role: 'user',
          content: '根据检查结果，这个 API 的性能怎么样？有什么优化建议吗？'
        }
      ],
      tools: [
        {
          name: 'check_api_performance',
          description: '检查 API 性能指标',
          input_schema: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              method: { type: 'string' },
              timeout: { type: 'number' }
            },
            required: ['url', 'method']
          }
        },
        {
          name: 'suggest_optimization',
          description: '基于性能数据提供优化建议',
          input_schema: {
            type: 'object',
            properties: {
              performance_data: { type: 'object' },
              target_response_time: { type: 'number' }
            },
            required: ['performance_data']
          }
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(conversationWithToolsRequest)
    })

    console.log('📤 发送带工具结果的对话请求到 OpenAI')
    console.log('💬 消息数量:', conversationWithToolsRequest.messages.length)
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否理解了工具结果并提供分析
    const hasAnalysis = responseText.includes('245') || 
                       responseText.includes('毫秒') || 
                       responseText.includes('性能') ||
                       responseText.includes('优化') ||
                       responseText.includes('建议')
    
    if (hasAnalysis) {
      console.log('✅ OpenAI 成功理解工具结果并提供了性能分析')
    }
    
    console.log('📝 工具结果分析响应:', responseText.substring(0, 700) + '...')
  }, 30000)

  test('编程助手场景：流式响应与工具调用', async () => {
    console.log('🔍 测试：流式响应工具调用场景')
    
    const streamToolRequest = {
      model: 'claude-3-5-sonnet-20241022',
      stream: true,
      messages: [
        {
          role: 'user',
          content: '请帮我创建一个 Node.js Express 服务器的基本结构，包括路由和中间件配置。'
        }
      ],
      tools: [
        {
          name: 'generate_express_app',
          description: '生成 Express 应用程序结构',
          input_schema: {
            type: 'object',
            properties: {
              app_name: { type: 'string' },
              routes: {
                type: 'array',
                items: { type: 'string' }
              },
              middleware: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['app_name']
          }
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(streamToolRequest)
    })

    console.log('📤 发送流式工具调用请求到 OpenAI')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    console.log('📥 响应头:', Object.fromEntries(response.headers.entries()))
    
    if (response.status === 200) {
      expect(response.headers.get('Content-Type')).toContain('text/event-stream')
      console.log('✅ 正确设置了流式响应头')
      
      const responseText = await response.text()
      console.log('📊 流式响应长度:', responseText.length, '字符')
      
      // 检查 SSE 格式和工具调用
      const hasSSEFormat = responseText.includes('data:') && responseText.includes('event:')
      const hasToolCall = responseText.includes('tool_use') || responseText.includes('generate_express_app')
      
      if (hasSSEFormat) {
        console.log('✅ 检测到正确的 SSE 格式')
      }
      
      if (hasToolCall) {
        console.log('✅ 检测到流式工具调用')
      }
      
      console.log('📝 流式工具调用响应开头:', responseText.substring(0, 400) + '...')
    }
  }, 30000)

  test('编程助手场景：复杂数据分析', async () => {
    console.log('🔍 测试：复杂数据分析场景')
    
    const dataAnalysisRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: `请分析这个电商网站的用户行为数据，并提供优化建议：

\`\`\`json
{
  "period": "2024-01-01 to 2024-01-31",
  "metrics": {
    "total_users": 15420,
    "new_users": 3245,
    "returning_users": 12175,
    "bounce_rate": 0.67,
    "avg_session_duration": 245,
    "page_views": 89234,
    "conversion_rate": 0.023,
    "revenue": 156780
  },
  "top_pages": [
    {"path": "/", "views": 23456, "avg_time": 45},
    {"path": "/products", "views": 18234, "avg_time": 120},
    {"path": "/product/123", "views": 8945, "avg_time": 180},
    {"path": "/cart", "views": 4567, "avg_time": 90},
    {"path": "/checkout", "views": 2341, "avg_time": 210}
  ],
  "user_flow": {
    "home_to_products": 0.78,
    "products_to_cart": 0.25,
    "cart_to_checkout": 0.51,
    "checkout_to_complete": 0.45
  }
}
\`\`\`

请分析关键指标，识别问题点，并提供具体的优化建议。`
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(dataAnalysisRequest)
    })

    console.log('📤 发送数据分析请求到 OpenAI')
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含数据分析相关内容
    const hasDataAnalysis = responseText.includes('跳出率') || 
                           responseText.includes('转化率') || 
                           responseText.includes('67%') ||
                           responseText.includes('2.3%') ||
                           responseText.includes('优化')
    
    if (hasDataAnalysis) {
      console.log('✅ OpenAI 成功分析了数据并提供了优化建议')
    }
    
    console.log('📝 数据分析响应预览:', responseText.substring(0, 600) + '...')
  }, 30000)

  test('编程助手场景：多轮技术对话', async () => {
    console.log('🔍 测试：多轮技术对话场景')
    
    const multiTurnRequest = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: '我想在我的 React 应用中实现无限滚动功能，有什么好的方案？'
        },
        {
          role: 'assistant',
          content: '实现无限滚动有几种常用方案：\n\n1. **Intersection Observer API** - 现代浏览器推荐方案\n2. **scroll 事件监听** - 传统方案，兼容性更好\n3. **使用现成库** - 如 react-infinite-scroll-component\n\n我推荐使用 Intersection Observer API，它性能更好，不会频繁触发事件。你的应用主要展示什么类型的数据？这样我可以提供更具体的实现建议。'
        },
        {
          role: 'user',
          content: '主要是展示新闻文章列表，每次加载20条，数据从 REST API 获取。请提供一个具体的实现示例。'
        },
        {
          role: 'assistant',
          content: '好的，我来为你创建一个新闻文章无限滚动的完整示例：\n\n```jsx\nimport React, { useState, useEffect, useCallback, useRef } from \'react\';\n\nconst NewsInfiniteScroll = () => {\n  const [articles, setArticles] = useState([]);\n  const [loading, setLoading] = useState(false);\n  const [page, setPage] = useState(1);\n  const [hasMore, setHasMore] = useState(true);\n  const observer = useRef();\n\n  // API 调用函数\n  const fetchArticles = async (pageNum) => {\n    setLoading(true);\n    try {\n      const response = await fetch(`/api/news?page=${pageNum}&limit=20`);\n      const data = await response.json();\n      return data;\n    } catch (error) {\n      console.error(\'Error fetching articles:\', error);\n      return { articles: [], hasMore: false };\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  // 加载更多文章\n  const loadMore = useCallback(async () => {\n    if (loading || !hasMore) return;\n    \n    const data = await fetchArticles(page);\n    setArticles(prev => [...prev, ...data.articles]);\n    setHasMore(data.hasMore);\n    setPage(prev => prev + 1);\n  }, [page, loading, hasMore]);\n\n  // Intersection Observer 回调\n  const lastArticleRef = useCallback(node => {\n    if (loading) return;\n    if (observer.current) observer.current.disconnect();\n    \n    observer.current = new IntersectionObserver(entries => {\n      if (entries[0].isIntersecting && hasMore) {\n        loadMore();\n      }\n    });\n    \n    if (node) observer.current.observe(node);\n  }, [loading, hasMore, loadMore]);\n\n  // 初始加载\n  useEffect(() => {\n    loadMore();\n  }, []);\n\n  return (\n    <div className=\"news-container\">\n      <h1>最新新闻</h1>\n      <div className=\"articles-list\">\n        {articles.map((article, index) => {\n          const isLast = index === articles.length - 1;\n          return (\n            <div \n              key={article.id}\n              ref={isLast ? lastArticleRef : null}\n              className=\"article-card\"\n            >\n              <h3>{article.title}</h3>\n              <p>{article.summary}</p>\n              <span className=\"publish-date\">{article.publishDate}</span>\n            </div>\n          );\n        })}\n      </div>\n      {loading && <div className=\"loading\">加载中...</div>}\n      {!hasMore && <div className=\"end-message\">没有更多文章了</div>}\n    </div>\n  );\n};\n\nexport default NewsInfiniteScroll;\n```\n\n这个实现的关键点：\n1. 使用 `useCallback` 优化性能\n2. `lastArticleRef` 只附加到最后一个元素\n3. 防止重复加载的逻辑\n4. 错误处理和加载状态管理\n\n你还需要配置对应的 CSS 样式，要我也提供吗？'
        },
        {
          role: 'user',
          content: '这个实现很好！但我担心在快速滚动时会有性能问题，有什么优化建议吗？'
        }
      ]
    }

    const request = createTestRequest('/v1/messages', {
      method: 'POST',
      body: JSON.stringify(multiTurnRequest)
    })

    console.log('📤 发送多轮技术对话请求到 OpenAI')
    console.log('💬 消息数量:', multiTurnRequest.messages.length)
    
    const response = await testApp.request(request)
    
    console.log('📥 响应状态:', response.status)
    expect(response.status).toBe(200)
    
    const responseText = await response.text()
    console.log('📊 响应长度:', responseText.length, '字符')
    
    // 检查是否包含性能优化相关内容
    const hasOptimization = responseText.includes('性能') || 
                           responseText.includes('优化') || 
                           responseText.includes('虚拟化') ||
                           responseText.includes('节流') ||
                           responseText.includes('debounce') ||
                           responseText.includes('React.memo')
    
    if (hasOptimization) {
      console.log('✅ OpenAI 在多轮对话中正确理解了上下文并提供了性能优化建议')
    }
    
    console.log('📝 性能优化建议预览:', responseText.substring(0, 500) + '...')
  }, 30000)
})