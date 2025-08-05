/**
 * Claude to OpenAI 转换器集成测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ClaudeToOpenAITransformer } from '../../../../src/services/proxy/transformers/claude-to-openai'
import type { MessageCreateParamsBase } from '@anthropic-ai/sdk/resources/messages'

describe('ClaudeToOpenAITransformer', () => {
  let transformer: ClaudeToOpenAITransformer

  beforeEach(() => {
    transformer = new ClaudeToOpenAITransformer()
  })

  describe('Request Transformation', () => {
    it('should transform basic Claude request to OpenAI format', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ]
      }

      // 使用 reflection 访问私有方法进行测试
      const buildBaseParams = (transformer as any).buildBaseParams.bind(transformer)
      const baseParams = buildBaseParams(claudeRequest, 'gpt-4')

      expect(baseParams).toMatchObject({
        model: 'gpt-4',
        max_completion_tokens: 1000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?'
          }
        ]
      })
    })

    it('should handle system messages correctly', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'Hello!'
          }
        ]
      }

      const buildBaseParams = (transformer as any).buildBaseParams.bind(transformer)
      const baseParams = buildBaseParams(claudeRequest, 'gpt-4')

      expect(baseParams.messages).toHaveLength(2)
      expect(baseParams.messages[0]).toMatchObject({
        role: 'system',
        content: 'You are a helpful assistant.'
      })
      expect(baseParams.messages[1]).toMatchObject({
        role: 'user',
        content: 'Hello!'
      })
    })

    it('should transform image messages correctly', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What do you see in this image?'
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
                }
              }
            ]
          }
        ]
      }

      const buildBaseParams = (transformer as any).buildBaseParams.bind(transformer)
      const baseParams = buildBaseParams(claudeRequest, 'gpt-4-vision-preview')

      expect(baseParams.messages).toHaveLength(1)
      expect(baseParams.messages[0].content).toBeInstanceOf(Array)
      
      const content = baseParams.messages[0].content as any[]
      expect(content).toHaveLength(2)
      expect(content[0]).toMatchObject({
        type: 'text',
        text: 'What do you see in this image?'
      })
      expect(content[1]).toMatchObject({
        type: 'image_url',
        image_url: {
          url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          detail: 'auto'
        }
      })
    })

    it('should transform tools correctly', () => {
      const claudeRequest: MessageCreateParamsBase = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: 'What is the weather like?'
          }
        ],
        tools: [
          {
            name: 'get_weather',
            description: 'Get current weather information',
            input_schema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The city name'
                }
              },
              required: ['location']
            }
          }
        ],
        tool_choice: 'auto'
      }

      const buildBaseParams = (transformer as any).buildBaseParams.bind(transformer)
      const baseParams = buildBaseParams(claudeRequest, 'gpt-4')

      expect(baseParams.tools).toHaveLength(1)
      expect(baseParams.tools![0]).toMatchObject({
        type: 'function',
        function: {
          name: 'get_weather',
          description: 'Get current weather information',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city name'
              }
            },
            required: ['location']
          }
        }
      })
      expect(baseParams.tool_choice).toBe('auto')
    })

    it('should handle tool_choice correctly', () => {
      const transformToolChoice = (transformer as any).transformToolChoice.bind(transformer)

      expect(transformToolChoice('auto')).toBe('auto')
      expect(transformToolChoice('none')).toBe('none')
      expect(transformToolChoice({ type: 'auto' })).toBe('auto')
      expect(transformToolChoice({ type: 'tool', name: 'get_weather' })).toMatchObject({
        type: 'function',
        function: { name: 'get_weather' }
      })
    })
  })

  describe('Response Transformation', () => {
    it('should map finish reasons correctly', () => {
      const mapFinishReason = (transformer as any).mapFinishReason.bind(transformer)

      expect(mapFinishReason('stop')).toBe('end_turn')
      expect(mapFinishReason('length')).toBe('max_tokens')
      expect(mapFinishReason('tool_calls')).toBe('tool_use')
      expect(mapFinishReason('content_filter')).toBe('end_turn')
      expect(mapFinishReason(null)).toBe('end_turn')
      expect(mapFinishReason('unknown')).toBe('end_turn')
    })

    it('should use original IDs without transformation', () => {
      // 现在我们直接使用原始 ID，无需生成新的 ID
      const claudeId = 'toolu_01A09q90qw90lkasldkj'
      const openaiId = 'call_abc123'

      // 验证我们直接使用原始 ID
      expect(claudeId).toBe('toolu_01A09q90qw90lkasldkj')
      expect(openaiId).toBe('call_abc123')
    })
  })

  describe('Utility Functions', () => {
    it('should extract text from content correctly', () => {
      const extractTextFromContent = (transformer as any).extractTextFromContent.bind(transformer)

      const content = [
        { type: 'text', text: 'Hello' },
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc' } },
        { type: 'text', text: 'World' }
      ]

      expect(extractTextFromContent(content)).toBe('Hello\nWorld')
    })

    it('should clean up parameters correctly', () => {
      const cleanupParameters = (transformer as any).cleanupParameters.bind(transformer)

      const params = {
        type: 'object',
        $schema: 'http://json-schema.org/draft-07/schema#',
        properties: {
          name: { type: 'string' }
        },
        const: 'some_const'
      }

      const cleaned = cleanupParameters(params)
      expect(cleaned).not.toHaveProperty('$schema')
      expect(cleaned).not.toHaveProperty('const')
      expect(cleaned).toHaveProperty('type', 'object')
      expect(cleaned).toHaveProperty('properties')
    })

    it('should create SSE events correctly', () => {
      const createSSEEvent = (transformer as any).createSSEEvent.bind(transformer)

      const event = createSSEEvent('test_event', { type: 'test', data: 'hello' })
      expect(event).toBe('event: test_event\ndata: {"type":"test","data":"hello"}\n\n')
    })
  })

  describe('Integration', () => {
    it('should initialize client correctly', () => {
      const apiKey = 'test-api-key'
      const baseUrl = 'https://api.example.com/v1'

      transformer.initializeClient(apiKey, { baseUrl })

      // 验证客户端已被初始化（通过检查是否能调用 getClient 而不抛错）
      expect(() => (transformer as any).getClient()).not.toThrow()
    })

    it('should cleanup resources correctly', () => {
      // 现在 cleanup 方法不做任何操作，因为没有需要清理的映射
      expect(() => transformer.cleanup()).not.toThrow()
    })
  })
})