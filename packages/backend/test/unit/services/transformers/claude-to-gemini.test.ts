import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClaudeToGeminiTransformer } from '../../../../src/services/proxy/transformers/claude-to-gemini'
import type { MessageCreateParamsBase, Message } from '@anthropic-ai/sdk/resources/messages'

describe('ClaudeToGeminiTransformer', () => {
  let transformer: ClaudeToGeminiTransformer

  beforeEach(() => {
    transformer = new ClaudeToGeminiTransformer()
  })

  describe('transformRequest', () => {
    it('应该正确转换带有函数定义的请求', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '今天天气怎么样？'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: '获取指定位置的天气信息',
            input_schema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: '城市名称'
                },
                unit: {
                  type: 'string',
                  enum: ['celsius', 'fahrenheit'],
                  description: '温度单位'
                }
              },
              required: ['location']
            }
          }
        ],
        tool_choice: { type: 'auto' },
        max_tokens: 1000
      }

      const result = transformer.transformRequest(claudeRequest)

      // 验证工具定义被正确转换
      expect(result.tools).toBeDefined()
      expect(result.tools!).toHaveLength(1)
      expect((result.tools![0] as any).functionDeclarations).toBeDefined()
      expect((result.tools![0] as any).functionDeclarations).toHaveLength(1)
      
      const funcDecl = (result.tools![0] as any).functionDeclarations[0]
      expect(funcDecl.name).toBe('get_weather')
      expect(funcDecl.description).toBe('获取指定位置的天气信息')
      expect(funcDecl.parameters).toBeDefined()
      
      // 验证工具选择策略
      expect(result.toolConfig).toEqual({ 
        functionCallingConfig: { mode: 'AUTO' }
      })
    })

    it('应该正确转换包含函数调用的消息', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '北京天气怎么样？'
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: '我来帮您查询北京的天气情况。'
              },
              {
                type: 'tool_use',
                id: 'toolu_01abc123',
                name: 'get_weather',
                input: {
                  location: '北京',
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
                tool_use_id: 'toolu_01abc123',
                content: '{"temperature": 25, "condition": "晴朗"}'
              }
            ]
          }
        ],
        max_tokens: 1000
      }

      const result = transformer.transformRequest(claudeRequest)

      // 验证消息被正确转换
      expect(result.contents).toHaveLength(3)
      
      // 第一条用户消息
      expect(result.contents[0].role).toBe('user')
      expect(result.contents[0].parts[0].text).toBe('北京天气怎么样？')
      
      // 助手消息（包含文本和函数调用）
      expect(result.contents[1].role).toBe('model')
      expect(result.contents[1].parts).toHaveLength(2)
      expect(result.contents[1].parts[0].text).toBe('我来帮您查询北京的天气情况。')
      expect(result.contents[1].parts[1].functionCall).toBeDefined()
      expect(result.contents[1].parts[1].functionCall.name).toBe('get_weather')
      expect(result.contents[1].parts[1].functionCall.args).toEqual({
        location: '北京',
        unit: 'celsius'
      })
      
      // 用户消息（包含函数结果）
      expect(result.contents[2].role).toBe('user')
      expect(result.contents[2].parts[0].functionResponse).toBeDefined()
      expect((result.contents[2].parts[0].functionResponse.response as any).result).toBe('{"temperature": 25, "condition": "晴朗"}')
    })

    it('应该合并连续的同角色消息', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '你好'
          },
          {
            role: 'user',
            content: '请帮我查询天气'
          },
          {
            role: 'assistant',
            content: '好的'
          },
          {
            role: 'assistant',
            content: '我来帮您查询'
          }
        ],
        max_tokens: 1000
      }

      const result = transformer.transformRequest(claudeRequest)

      // 验证消息被合并
      expect(result.contents).toHaveLength(2)
      
      // 合并后的用户消息
      expect(result.contents[0].role).toBe('user')
      expect(result.contents[0].parts).toHaveLength(2)
      expect(result.contents[0].parts[0].text).toBe('你好')
      expect(result.contents[0].parts[1].text).toBe('请帮我查询天气')
      
      // 合并后的助手消息
      expect(result.contents[1].role).toBe('model')
      expect(result.contents[1].parts).toHaveLength(2)
      expect(result.contents[1].parts[0].text).toBe('好的')
      expect(result.contents[1].parts[1].text).toBe('我来帮您查询')
    })

    it('应该清理不支持的参数属性', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-opus-20240229',
        messages: [
          {
            role: 'user',
            content: '测试'
          }
        ],
        tools: [
          {
            name: 'test_function',
            description: '测试函数',
            input_schema: {
              $schema: 'http://json-schema.org/draft-07/schema#',
              type: 'object',
              additionalProperties: false,
              properties: {
                field1: {
                  type: 'string',
                  format: 'email',
                  const: 'test@example.com'
                },
                field2: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            }
          }
        ],
        max_tokens: 100
      }

      const result = transformer.transformRequest(claudeRequest)

      const params = (result.tools![0] as any).functionDeclarations[0].parameters
      
      // 验证不支持的属性被移除
      expect(params.$schema).toBeUndefined()
      expect(params.additionalProperties).toBeUndefined()
      expect(params.properties.field1.const).toBeUndefined()
      expect(params.properties.field1.format).toBeUndefined() // email format 应该被移除
      expect(params.properties.field2.format).toBe('date-time') // date-time format 应该保留
    })
  })

  describe('transformResponse', () => {
    it('应该正确转换包含函数调用的响应', async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '我来帮您查询天气信息。'
                },
                {
                  functionCall: {
                    name: 'get_weather',
                    args: {
                      location: '北京'
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
          promptTokenCount: 100,
          candidatesTokenCount: 50,
          totalTokenCount: 150
        }
      }

      const result = await transformer.transformResponse(geminiResponse, false) as Message

      expect(result.content).toHaveLength(2)
      
      // 文本内容
      expect(result.content[0].type).toBe('text')
      expect((result.content[0] as any).text).toBe('我来帮您查询天气信息。')
      
      // 函数调用
      expect(result.content[1].type).toBe('tool_use')
      expect((result.content[1] as any).id).toMatch(/^toolu_/)
      expect((result.content[1] as any).name).toBe('get_weather')
      expect((result.content[1] as any).input).toEqual({
        location: '北京'
      })
    })

    it('应该正确处理缓存的 token 计数', async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '这是响应文本'
                }
              ]
            },
            finishReason: 'STOP'
          }
        ],
        modelVersion: 'gemini-1.5-pro',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 20,
          totalTokenCount: 120,
          cachedContentTokenCount: 50
        }
      }

      const result = await transformer.transformResponse(geminiResponse, false) as Message

      expect(result.usage.input_tokens).toBe(100)
      expect(result.usage.output_tokens).toBe(20)
      expect((result.usage as any).cache_creation_input_tokens).toBe(0)
      expect((result.usage as any).cache_read_input_tokens).toBe(50)
    })
  })

  describe('工具选择策略转换', () => {
    it('应该正确转换各种 tool_choice 选项', () => {
      const testCases = [
        { input: 'auto', expected: { functionCallingConfig: { mode: 'AUTO' } } },
        { input: 'none', expected: { functionCallingConfig: { mode: 'NONE' } } },
        { input: 'required', expected: { functionCallingConfig: { mode: 'ANY' } } },
        { input: 'any', expected: { functionCallingConfig: { mode: 'ANY' } } },
        { 
          input: 'get_weather', 
          expected: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['get_weather'] } } 
        },
        { 
          input: { type: 'tool', name: 'get_weather' }, 
          expected: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['get_weather'] } } 
        }
      ]

      testCases.forEach(({ input, expected }) => {
        const request: MessageCreateParamsBase = {
          model: 'claude-3',
          messages: [{ role: 'user', content: 'test' }],
          tool_choice: input as any,
          max_tokens: 100
        }

        const result = transformer.transformRequest(request)
        expect(result.toolConfig).toEqual(expected)
      })
    })
  })

  describe('流式响应处理', () => {
    it('应该正确处理流式响应转换', async () => {
      // 模拟 Gemini SSE 流数据
      const mockStreamData = [
        'data: {"candidates":[{"content":{"parts":[{"text":"我来帮您"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"查询天气"}]}}]}\n\n',
        'data: {"candidates":[{"finishReason":"STOP","content":{"parts":[]}}],"usageMetadata":{"candidatesTokenCount":20}}\n\n',
        'data: [DONE]\n\n'
      ]

      // 创建模拟的 ReadableStream
      const mockStream = new ReadableStream({
        start(controller) {
          mockStreamData.forEach((data, index) => {
            setTimeout(() => {
              controller.enqueue(new TextEncoder().encode(data))
              if (index === mockStreamData.length - 1) {
                controller.close()
              }
            }, index * 10)
          })
        }
      })

      const claudeStream = await transformer.transformResponse(mockStream, true) as ReadableStream
      expect(claudeStream).toBeInstanceOf(ReadableStream)

      // 读取流数据并验证格式
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
      
      // 验证包含 Claude 格式的流事件
      expect(fullData).toContain('event: message_start')
      expect(fullData).toContain('event: content_block_start')
      expect(fullData).toContain('event: content_block_delta')
      expect(fullData).toContain('event: content_block_stop')
      expect(fullData).toContain('event: message_stop')
    }, 10000) // 设置较长的超时时间
  })

  describe('错误处理', () => {
    it('应该处理无效的 Gemini 响应', async () => {
      const invalidResponse = {
        // 没有 candidates
      }

      await expect(transformer.transformResponse(invalidResponse, false))
        .rejects.toThrow('Invalid Gemini response: no candidates found')
    })

    it('应该处理 tool_use_id 映射丢失的情况', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'unknown_id',
                content: 'test result'
              }
            ]
          }
        ],
        max_tokens: 100
      }

      // 捕获控制台警告
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const result = transformer.transformRequest(claudeRequest)
      
      // 验证处理了缺失的映射，并生成了警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No function name found for tool_use_id: unknown_id')
      )
      
      // 验证生成了占位符函数名
      expect(result.contents[0].parts[0].functionResponse.name)
        .toBe('unknown_function_unknown_id')
      
      consoleSpy.mockRestore()
    })
  })

  describe('系统消息处理', () => {
    it('应该正确处理字符串类型的系统消息', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        system: '你是一个有用的助手',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100
      }

      const result = transformer.transformRequest(claudeRequest)
      expect(result.systemInstruction).toBe('你是一个有用的助手')
    })

    it('应该正确处理复杂类型的系统消息', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        system: [
          { type: 'text', text: '你是一个有用的助手。' },
          { type: 'text', text: '请始终保持礼貌。' }
        ],
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 100
      }

      const result = transformer.transformRequest(claudeRequest)
      expect(result.systemInstruction).toBe('你是一个有用的助手。\n请始终保持礼貌。')
    })
  })

  describe('图片处理', () => {
    it('应该正确处理 base64 图片', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
                }
              }
            ]
          }
        ],
        max_tokens: 100
      }

      const result = transformer.transformRequest(claudeRequest)
      
      expect(result.contents[0].parts[0].inlineData).toBeDefined()
      expect(result.contents[0].parts[0].inlineData.mimeType).toBe('image/jpeg')
      expect(result.contents[0].parts[0].inlineData.data)
        .toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==')
    })

    it('应该正确处理 URL 图片（转为文本占位符）', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'url',
                  url: 'https://example.com/image.jpg'
                }
              }
            ]
          }
        ],
        max_tokens: 100
      }

      const result = transformer.transformRequest(claudeRequest)
      
      expect(result.contents[0].parts[0].text)
        .toBe('[Image: https://example.com/image.jpg]')
    })
  })

  describe('内存管理', () => {
    it('应该能清理函数名映射表', () => {
      // 添加一些映射
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool_use',
                id: 'test_id',
                name: 'test_function',
                input: {}
              }
            ]
          }
        ],
        max_tokens: 100
      }

      transformer.transformRequest(claudeRequest)
      
      // 验证映射存在（通过尝试查找已知映射）
      const request2: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'test_id',
                content: 'result'
              }
            ]
          }
        ],
        max_tokens: 100
      }

      const result2 = transformer.transformRequest(request2)
      expect(result2.contents[0].parts[0].functionResponse.name).toBe('test_function')
      
      // 清理映射
      transformer.clearFunctionNameMapping()
      
      // 验证映射被清理（应该生成占位符名称）
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result3 = transformer.transformRequest(request2)
      expect(result3.contents[0].parts[0].functionResponse.name).toBe('unknown_function_test_id')
      
      consoleSpy.mockRestore()
    })
  })

  describe('完成原因映射', () => {
    it('应该正确映射各种完成原因', async () => {
      const testCases = [
        { geminiReason: 'STOP', claudeReason: 'end_turn' },
        { geminiReason: 'MAX_TOKENS', claudeReason: 'max_tokens' },
        { geminiReason: 'SAFETY', claudeReason: 'end_turn' },
        { geminiReason: 'RECITATION', claudeReason: 'end_turn' },
        { geminiReason: 'OTHER', claudeReason: 'end_turn' },
        { geminiReason: 'UNKNOWN_REASON', claudeReason: 'end_turn' },
        { geminiReason: null, claudeReason: 'end_turn' }
      ]

      for (const { geminiReason, claudeReason } of testCases) {
        const geminiResponse = {
          candidates: [
            {
              content: {
                parts: [{ text: 'test' }]
              },
              finishReason: geminiReason
            }
          ],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5
          }
        }

        const result = await transformer.transformResponse(geminiResponse, false) as Message
        expect(result.stop_reason).toBe(claudeReason)
      }
    })
  })

  describe('生成配置转换', () => {
    it('应该正确转换所有生成配置参数', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1000,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        stop_sequences: ['stop1', 'stop2']
      }

      const result = transformer.transformRequest(claudeRequest)
      
      expect(result.generationConfig?.maxOutputTokens).toBe(1000)
      expect(result.generationConfig?.temperature).toBe(0.7)
      expect(result.generationConfig?.topP).toBe(0.9)
      expect(result.generationConfig?.topK).toBe(40)
      expect(result.generationConfig?.stopSequences).toEqual(['stop1', 'stop2'])
    })

    it('应该处理缺失的生成配置参数', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 100
        // 没有指定任何生成配置
      }

      const result = transformer.transformRequest(claudeRequest)
      
      expect(result.generationConfig).toBeDefined()
      expect(result.generationConfig?.maxOutputTokens).toBe(100)
      expect(result.generationConfig?.temperature).toBeUndefined()
      expect(result.generationConfig?.topP).toBeUndefined()
      expect(result.generationConfig?.topK).toBeUndefined()
      expect(result.generationConfig?.stopSequences).toBeUndefined()
    })
  })
})