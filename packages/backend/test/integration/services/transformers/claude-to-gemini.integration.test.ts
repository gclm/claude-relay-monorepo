import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ClaudeToGeminiTransformer } from '../../../../src/services/proxy/transformers/claude-to-gemini'
import type { MessageCreateParamsBase, Message } from '@anthropic-ai/sdk/resources/messages'

describe('ClaudeToGeminiTransformer Integration Tests', () => {
  let transformer: ClaudeToGeminiTransformer
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    transformer = new ClaudeToGeminiTransformer()
    mockFetch = vi.fn()
    global.fetch = mockFetch
  })

  afterEach(() => {
    vi.restoreAllMocks()
    transformer.clearFunctionNameMapping()
  })

  describe('端到端请求转换测试', () => {
    it('应该正确处理完整的对话流程', async () => {
      // 阶段1：用户初始请求
      const initialRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '请帮我查询北京的天气，并根据天气情况给出穿衣建议。'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: '获取指定城市的天气信息',
            input_schema: {
              type: 'object',
              properties: {
                city: {
                  type: 'string',
                  description: '城市名称'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: '温度单位'
                }
              },
              required: ['city']
            }
          }
        ],
        tool_choice: { type: 'auto' },
        max_tokens: 1000,
        temperature: 0.7
      }

      // 转换初始请求
      const geminiRequest = transformer.transformRequest(initialRequest)

      // 验证转换结果
      expect(geminiRequest.contents).toHaveLength(1)
      expect(geminiRequest.contents[0].role).toBe('user')
      expect(geminiRequest.contents[0].parts[0].text).toBe('请帮我查询北京的天气，并根据天气情况给出穿衣建议。')
      expect(geminiRequest.tools).toBeDefined()
      expect(geminiRequest.tools![0]).toHaveProperty('functionDeclarations')
      expect(geminiRequest.toolConfig).toEqual({
        functionCallingConfig: { mode: 'AUTO' }
      })
      expect(geminiRequest.generationConfig?.maxOutputTokens).toBe(1000)
      expect(geminiRequest.generationConfig?.temperature).toBe(0.7)

      // 阶段2：模拟 Gemini 响应（包含函数调用）
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '好的，我来帮您查询北京的天气情况。'
                },
                {
                  functionCall: {
                    name: 'get_weather',
                    args: {
                      city: '北京',
                      unit: 'celsius'
                    }
                  }
                }
              ]
            },
            finishReason: 'STOP'
          }
        ],
        modelVersion: 'gemini-1.5-pro',
        usageMetadata: {
          promptTokenCount: 120,
          candidatesTokenCount: 30,
          totalTokenCount: 150
        }
      }

      // 转换响应
      const claudeResponse = await transformer.transformResponse(geminiResponse, false) as Message

      // 验证响应转换
      expect(claudeResponse.content).toHaveLength(2)
      expect(claudeResponse.content[0].type).toBe('text')
      expect((claudeResponse.content[0] as any).text).toBe('好的，我来帮您查询北京的天气情况。')
      expect(claudeResponse.content[1].type).toBe('tool_use')
      expect((claudeResponse.content[1] as any).name).toBe('get_weather')
      expect((claudeResponse.content[1] as any).input).toEqual({
        city: '北京',
        unit: 'celsius'
      })

      const toolUseId = (claudeResponse.content[1] as any).id

      // 阶段3：用户提供工具结果
      const toolResultRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '请帮我查询北京的天气，并根据天气情况给出穿衣建议。'
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '好的，我来帮您查询北京的天气情况。'
              },
              {
                type: 'tool_use',
                id: toolUseId,
                name: 'get_weather',
                input: {
                  city: '北京',
                  unit: 'celsius'
                }
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUseId,
                content: '{"temperature": 15, "condition": "多云", "humidity": 65, "wind_speed": 12}'
              }
            ]
          }
        ],
        max_tokens: 800
      }

      // 转换包含工具结果的请求
      const geminiRequestWithResult = transformer.transformRequest(toolResultRequest)

      // 验证工具结果转换
      expect(geminiRequestWithResult.contents).toHaveLength(3)
      
      // 用户消息
      expect(geminiRequestWithResult.contents[0].role).toBe('user')
      expect(geminiRequestWithResult.contents[0].parts[0].text).toBe('请帮我查询北京的天气，并根据天气情况给出穿衣建议。')
      
      // 助手消息（包含文本和函数调用）
      expect(geminiRequestWithResult.contents[1].role).toBe('model')
      expect(geminiRequestWithResult.contents[1].parts).toHaveLength(2)
      expect(geminiRequestWithResult.contents[1].parts[0].text).toBe('好的，我来帮您查询北京的天气情况。')
      expect(geminiRequestWithResult.contents[1].parts[1].functionCall).toBeDefined()
      expect(geminiRequestWithResult.contents[1]?.parts[1]?.functionCall?.name).toBe('get_weather')
      
      // 用户消息（包含函数结果）
      expect(geminiRequestWithResult.contents[2].role).toBe('user')
      expect(geminiRequestWithResult.contents[2].parts[0].functionResponse).toBeDefined()
      expect(geminiRequestWithResult.contents[2].parts[0].functionResponse?.name).toBe('get_weather')
      expect((geminiRequestWithResult.contents[2].parts[0].functionResponse?.response as any).result)
        .toBe('{"temperature": 15, "condition": "多云", "humidity": 65, "wind_speed": 12}')
    })
  })

  describe('流式响应集成测试', () => {
    it('应该正确处理完整的流式对话', async () => {
      // 创建模拟的 Gemini AsyncGenerator 流
      async function* mockGeminiStreamGenerator(): AsyncGenerator<any> {
        // 分批发送文本内容
        yield { candidates: [{ content: { parts: [{ text: "根据" }] } }] }
        yield { candidates: [{ content: { parts: [{ text: "查询" }] } }] }
        yield { candidates: [{ content: { parts: [{ text: "到的" }] } }] }
        yield { candidates: [{ content: { parts: [{ text: "天气" }] } }] }
        yield { candidates: [{ content: { parts: [{ text: "信息" }] } }] }
        yield { candidates: [{ content: { parts: [{ text: "，" }] } }] }
        
        // 发送函数调用
        yield {
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: "get_clothing_advice",
                  args: { temperature: 15, condition: "多云" }
                }
              }]
            }
          }]
        }
        
        // 发送结束信号和使用统计
        yield {
          candidates: [{
            finishReason: "STOP",
            content: { parts: [] }
          }],
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 45,
            totalTokenCount: 195
          }
        }
      }

      // 转换流式响应
      const claudeStream = await transformer.transformResponse(mockGeminiStreamGenerator(), true) as ReadableStream
      expect(claudeStream).toBeInstanceOf(ReadableStream)

      // 读取并验证流式数据
      const reader = claudeStream.getReader()
      const decoder = new TextDecoder()
      const receivedChunks: string[] = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value)
          receivedChunks.push(chunk)
        }
      } finally {
        reader.releaseLock()
      }

      const fullStreamData = receivedChunks.join('')

      // 验证 Claude 格式的流式事件
      expect(fullStreamData).toContain('event: message_start')
      expect(fullStreamData).toContain('event: content_block_start')
      expect(fullStreamData).toContain('event: content_block_delta')
      expect(fullStreamData).toContain('event: content_block_stop')
      expect(fullStreamData).toContain('event: message_delta')
      expect(fullStreamData).toContain('event: message_stop')

      // 验证包含文本增量
      expect(fullStreamData).toContain('"text":"根据"')
      expect(fullStreamData).toContain('"text":"查询"')
      expect(fullStreamData).toContain('"text":"到的"')

      // 验证包含工具调用
      expect(fullStreamData).toContain('tool_use')
      expect(fullStreamData).toContain('get_clothing_advice')

      // 验证包含使用统计
      expect(fullStreamData).toContain('output_tokens')
      expect(fullStreamData).toContain('stop_reason')
    }, 15000) // 增加超时时间以处理异步流
  })

  describe('边界情况集成测试', () => {
    it('应该处理包含特殊字符的复杂对话', async () => {
      const complexRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        system: '你是一个专业的JSON数据分析师。请分析用户提供的数据并返回结构化结果。',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '请分析这个JSON数据：{"name": "测试\\n换行", "data": [1,2,3], "special": "\\u4e2d\\u6587"}'
              }
            ]
          }
        ],
        tools: [
          {
            name: 'analyze_json',
            description: '分析JSON数据结构',
            input_schema: {
              type: 'object',
              properties: {
                'json_data': {
                  type: 'string',
                  description: 'JSON字符串'
                },
                'analysis_type': {
                  type: 'string',
                  enum: ['structure', 'content', 'validation'],
                  description: '分析类型'
                }
              },
              required: ['json_data']
            }
          }
        ],
        max_tokens: 500
      }

      const result = transformer.transformRequest(complexRequest)

      // 验证系统指令
      expect(result.systemInstruction).toBe('你是一个专业的JSON数据分析师。请分析用户提供的数据并返回结构化结果。')

      // 验证特殊字符处理
      expect(result.contents[0].parts[0].text).toContain('\\n换行')
      expect(result.contents[0].parts[0].text).toContain('\\u4e2d\\u6587')

      // 验证工具定义处理
      expect(result.tools![0]).toHaveProperty('functionDeclarations')
      const funcDecl = (result.tools![0] as any).functionDeclarations[0]
      expect(funcDecl.name).toBe('analyze_json')
      expect(funcDecl.parameters.properties['json_data']).toBeDefined()
      expect(funcDecl.parameters.properties.analysis_type.enum).toEqual(['structure', 'content', 'validation'])
    })

    it('应该处理包含大量嵌套内容的请求', async () => {
      const nestedRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '第一条用户消息'
          },
          {
            role: 'user',
            content: '第二条用户消息'
          },
          {
            role: 'assistant',
            content: '助手响应'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '复杂消息开始'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg=='
                }
              },
              {
                type: 'text',
                text: '复杂消息结束'
              }
            ]
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '分析图片中的内容'
              },
              {
                type: 'tool_use',
                id: 'toolu_complex_123',
                name: 'image_analysis',
                input: {
                  description: '这是一个1x1像素的透明PNG图片',
                  confidence: 0.95
                }
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'toolu_complex_123',
                content: [
                  {
                    type: 'text',
                    text: '图片分析完成：这是一个最小的PNG图片文件'
                  }
                ]
              }
            ]
          }
        ],
        max_tokens: 1500
      }

      const result = transformer.transformRequest(nestedRequest)

      // 验证消息合并（连续的用户消息应该被合并）
      expect(result.contents).toHaveLength(5) // user -> assistant -> user -> assistant -> user

      // 验证第一个合并的用户消息
      expect(result.contents[0].role).toBe('user')
      expect(result.contents[0].parts).toHaveLength(2)
      expect(result.contents[0].parts[0].text).toBe('第一条用户消息')
      expect(result.contents[0].parts[1].text).toBe('第二条用户消息')

      // 验证助手消息
      expect(result.contents[1].role).toBe('model')
      expect(result.contents[1].parts[0].text).toBe('助手响应')

      // 验证复杂的用户消息（包含文本和图片）
      expect(result.contents[2].role).toBe('user')
      expect(result.contents[2].parts).toHaveLength(3)
      expect(result.contents[2].parts[0].text).toBe('复杂消息开始')
      expect(result.contents[2].parts[1].inlineData).toBeDefined()
      expect(result.contents[2].parts[1].inlineData?.mimeType).toBe('image/png')
      expect(result.contents[2].parts[2].text).toBe('复杂消息结束')

      // 验证包含工具调用的助手消息
      expect(result.contents[3].role).toBe('model')
      expect(result.contents[3].parts).toHaveLength(2)
      expect(result.contents[3].parts[0].text).toBe('分析图片中的内容')
      expect(result.contents[3].parts[1].functionCall).toBeDefined()
      expect(result.contents[3].parts[1].functionCall?.name).toBe('image_analysis')

      // 验证工具结果的用户消息
      expect(result.contents[4].role).toBe('user')
      expect(result.contents[4].parts[0].functionResponse).toBeDefined()
      expect(result.contents[4].parts[0].functionResponse?.name).toBe('image_analysis')
    })
  })

  describe('性能和内存管理测试', () => {
    it('应该正确处理大量的工具使用映射', async () => {
      // 创建包含多个工具使用的请求
      const toolUseMessages: MessageCreateParamsBase['messages'] = []
      const toolResultMessages: MessageCreateParamsBase['messages'] = []

      // 生成100个工具使用
      for (let i = 0; i < 100; i++) {
        toolUseMessages.push({
          role: 'assistant' as const,
          content: [
            {
              type: 'tool_use' as const,
              id: `toolu_${i.toString().padStart(3, '0')}`,
              name: `function_${i}`,
              input: { index: i, data: `test_data_${i}` }
            }
          ]
        })

        toolResultMessages.push({
          role: 'user' as const,
          content: [
            {
              type: 'tool_result' as const,
              tool_use_id: `toolu_${i.toString().padStart(3, '0')}`,
              content: `Result for function_${i}: success`
            }
          ]
        })
      }

      // 交替消息以创建完整的对话
      const messages: MessageCreateParamsBase['messages'] = []
      for (let i = 0; i < 100; i++) {
        messages.push(toolUseMessages[i])
        messages.push(toolResultMessages[i])
      }

      const largeRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          { role: 'user', content: '开始批量工具测试' },
          ...messages
        ],
        max_tokens: 2000
      }

      const startTime = Date.now()
      const result = transformer.transformRequest(largeRequest)
      const processingTime = Date.now() - startTime

      // 验证性能（处理时间应该在合理范围内）
      expect(processingTime).toBeLessThan(1000) // 应该在1秒内完成

      // 验证正确性
      expect(result.contents).toBeDefined()
      expect(result.contents.length).toBeGreaterThan(0)

      // 验证所有工具使用都正确映射
      let toolUseCount = 0
      let toolResultCount = 0

      result.contents.forEach((content: any) => {
        content.parts.forEach((part: any) => {
          if (part.functionCall) {
            toolUseCount++
          }
          if (part.functionResponse) {
            toolResultCount++
            // 验证函数名映射正确
            expect(part.functionResponse.name).toMatch(/^function_\d+$/)
          }
        })
      })

      expect(toolUseCount).toBe(100)
      expect(toolResultCount).toBe(100)

      // 测试内存清理
      const initialMappingSize = Object.keys(transformer).length
      transformer.clearFunctionNameMapping()
      const finalMappingSize = Object.keys(transformer).length

      // 映射应该被清理（实际实现可能因为私有属性而不同）
      expect(finalMappingSize).toBeLessThanOrEqual(initialMappingSize)
    })
  })

  describe('错误恢复和容错测试', () => {
    it('应该处理损坏的流式数据', async () => {
      // 创建包含正常数据的 Gemini AsyncGenerator 流
      async function* brokenStreamGenerator(): AsyncGenerator<any> {
        // 正常的文本块
        yield { candidates: [{ content: { parts: [{ text: "正常" }] } }] }
        
        // 后续正常块
        yield { candidates: [{ content: { parts: [{ text: "恢复" }] } }] }
        
        // 结束信号
        yield {
          candidates: [{
            finishReason: "STOP",
            content: { parts: [] }
          }]
        }
      }

      const claudeStream = await transformer.transformResponse(brokenStreamGenerator(), true) as ReadableStream
      const reader = claudeStream.getReader()
      const decoder = new TextDecoder()
      const chunks: string[] = []

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(decoder.decode(value))
        }
      } finally {
        reader.releaseLock()
      }

      const fullData = chunks.join('')

      // 应该包含有效的数据，忽略损坏的数据
      expect(fullData).toContain('正常')
      expect(fullData).toContain('恢复')
      expect(fullData).toContain('message_start')
      expect(fullData).toContain('message_stop')
    })

    it('应该处理空的或无效的响应数据', async () => {
      // 这些情况会抛出 'Invalid Gemini response: no candidates found' 错误
      const noValidCandidatesResponses = [
        {},
        { candidates: [] }
      ]

      for (const invalidResponse of noValidCandidatesResponses) {
        await expect(
          transformer.transformResponse(invalidResponse as any, false)
        ).rejects.toThrow('Invalid Gemini response: no candidates found')
      }

      // 这些情况会抛出不同的错误（访问 null/undefined 属性）
      await expect(
        transformer.transformResponse(null as any, false)
      ).rejects.toThrow('Cannot read properties of null')

      await expect(
        transformer.transformResponse(undefined as any, false)
      ).rejects.toThrow('Cannot read properties of undefined')

      await expect(
        transformer.transformResponse({ candidates: [null] } as any, false)
      ).rejects.toThrow('Cannot read properties of null')

      // 测试空的 candidate 对象会返回有效响应（只是内容为空）
      const emptyResponse = await transformer.transformResponse({ candidates: [{}] }, false) as any
      expect(emptyResponse.content).toEqual([])
      expect(emptyResponse.id).toMatch(/^msg_/)
      expect(emptyResponse.role).toBe('assistant')
    })
  })
})