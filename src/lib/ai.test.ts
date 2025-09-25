import { OpenAIProvider, type ChatMessage } from './ai'

// Mock OpenAI
jest.mock('openai')
const MockOpenAI = require('openai').OpenAI

describe('AI Provider', () => {
  const mockCreate = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup OpenAI mock
    MockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate
        }
      }
    }))

    // Mock environment variables
    process.env.OPENAI_API_KEY = 'sk-test-key-12345678901234567890'
    process.env.NEXT_PUBLIC_AI_MODEL = 'gpt-4o-mini'

    // Setup default successful responses
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          role: 'assistant',
          content: 'Test AI response'
        }
      }],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 15,
        total_tokens: 25
      }
    })
  })

  afterEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.NEXT_PUBLIC_AI_MODEL
  })

  describe('OpenAIProvider.sendMessage', () => {
    it('should successfully generate a chat completion', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello, how are you?' }
      ]

      const response = await OpenAIProvider.sendMessage(messages)

      expect(response).toBe('Test AI response')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'Hello, how are you?' })
          ]),
          max_tokens: 1000,
          temperature: 0.7
        })
      )
    })

    it('should handle API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('OpenAI API error'))

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      await expect(OpenAIProvider.sendMessage(messages)).rejects.toThrow('OpenAI API error')
    })

    it('should enforce rate limiting', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      // Make requests beyond rate limit (30 is the limit)
      const promises = []
      for (let i = 0; i < 35; i++) {
        promises.push(
          OpenAIProvider.sendMessage(messages, 'test-teacher').catch(err => err)
        )
      }

      const results = await Promise.all(promises)
      const rateLimitErrors = results.filter(r =>
        r instanceof Error && r.message.includes('Rate limit exceeded')
      )

      expect(rateLimitErrors.length).toBeGreaterThan(0)
    })

    it('should include system prompt', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' }
      ]

      await OpenAIProvider.sendMessage(messages)

      const calledMessages = mockCreate.mock.calls[0][0].messages
      expect(calledMessages[0].role).toBe('system')
      expect(calledMessages[0].content).toContain('educational AI assistant')
    })

    it('should handle retries on failures', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          choices: [{
            message: { role: 'assistant', content: 'Success after retry' }
          }]
        })

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      const response = await OpenAIProvider.sendMessage(messages)

      expect(response).toBe('Success after retry')
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })
  })

  describe('OpenAIProvider.streamMessage', () => {
    it('should handle streaming responses', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { choices: [{ delta: { content: 'Hello' } }] }
          yield { choices: [{ delta: { content: ' world' } }] }
        }
      }
      mockCreate.mockResolvedValue(mockStream)

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      const stream = await OpenAIProvider.streamMessage(messages)

      expect(stream).toBe(mockStream)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true
        })
      )
    })

    it('should enforce rate limiting for streaming', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      // Exhaust rate limit
      const promises = []
      for (let i = 0; i < 35; i++) {
        promises.push(
          OpenAIProvider.streamMessage(messages, 'test-teacher').catch(err => err)
        )
      }

      const results = await Promise.all(promises)
      const rateLimitErrors = results.filter(r =>
        r instanceof Error && r.message.includes('Rate limit exceeded')
      )

      expect(rateLimitErrors.length).toBeGreaterThan(0)
    })
  })

  describe('OpenAIProvider.validateEnvironment', () => {
    it('should return true for valid environment', () => {
      const isValid = OpenAIProvider.validateEnvironment()
      expect(isValid).toBe(true)
    })

    it('should return false for missing API key', () => {
      delete process.env.OPENAI_API_KEY

      const isValid = OpenAIProvider.validateEnvironment()
      expect(isValid).toBe(false)
    })

    it('should return false for invalid API key', () => {
      process.env.OPENAI_API_KEY = 'invalid-short-key'

      const isValid = OpenAIProvider.validateEnvironment()
      expect(isValid).toBe(false)
    })
  })

  describe('OpenAIProvider.getFallbackResponse', () => {
    it('should return fallback response', () => {
      const response = OpenAIProvider.getFallbackResponse('Hello')

      expect(typeof response).toBe('string')
      expect(response.length).toBeGreaterThan(0)
    })

    it('should handle different message types', () => {
      const responses = [
        OpenAIProvider.getFallbackResponse('How are you?'),
        OpenAIProvider.getFallbackResponse('What is 2+2?'),
        OpenAIProvider.getFallbackResponse('')
      ]

      responses.forEach(response => {
        expect(typeof response).toBe('string')
        expect(response.length).toBeGreaterThan(0)
      })
    })
  })

  describe('OpenAIProvider.formatMessagesForAPI', () => {
    it('should format simple messages', () => {
      const chatMessages = [
        { content: 'Hello', role: 'user' as const },
        { content: 'Hi there', role: 'assistant' as const }
      ]

      const formatted = OpenAIProvider.formatMessagesForAPI(chatMessages)

      expect(formatted).toHaveLength(2)
      expect(formatted[0]).toEqual({
        role: 'user',
        content: 'Hello'
      })
      expect(formatted[1]).toEqual({
        role: 'assistant',
        content: 'Hi there'
      })
    })

    it('should handle messages with file attachments', () => {
      const chatMessages = [
        {
          content: 'Look at this image',
          role: 'user' as const,
          fileAttachments: [{
            file_type: 'image/jpeg',
            file_url: 'https://example.com/image.jpg'
          }]
        }
      ]

      const formatted = OpenAIProvider.formatMessagesForAPI(chatMessages)

      expect(formatted).toHaveLength(1)
      expect(formatted[0].content).toEqual([
        { type: 'text', text: 'Look at this image' },
        {
          type: 'image_url',
          image_url: {
            url: 'https://example.com/image.jpg',
            detail: 'auto'
          }
        }
      ])
    })
  })

  describe('OpenAIProvider.validateMessages', () => {
    it('should validate correct messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]

      const isValid = OpenAIProvider.validateMessages(messages)
      expect(isValid).toBe(true)
    })

    it('should reject empty messages array', () => {
      const isValid = OpenAIProvider.validateMessages([])
      expect(isValid).toBe(false)
    })

    it('should reject messages with empty content', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: '' }
      ]

      const isValid = OpenAIProvider.validateMessages(messages)
      expect(isValid).toBe(false)
    })
  })

  describe('OpenAIProvider.getRateLimitStatus', () => {
    it('should return rate limit status', () => {
      const status = OpenAIProvider.getRateLimitStatus()

      expect(status).toHaveProperty('remaining')
      expect(status).toHaveProperty('resetTime')
      expect(typeof status.remaining).toBe('number')
      expect(typeof status.resetTime).toBe('number')
    })

    it('should handle user-specific rate limits', () => {
      const userStatus = OpenAIProvider.getRateLimitStatus('user-123')

      expect(userStatus).toHaveProperty('remaining')
      expect(userStatus).toHaveProperty('resetTime')
    })
  })

  describe('OpenAIProvider.createMessageWithFiles', () => {
    it('should create message with file context', () => {
      const files = [{
        filename: 'document.pdf',
        content: 'Document content',
        metadata: { pages: 5 }
      }]

      const message = OpenAIProvider.createMessageWithFiles(
        'Analyze this document',
        files
      )

      expect(message.role).toBe('user')
      expect(message.content).toContain('Analyze this document')
      expect(message.content).toContain('Document content')
      expect(message.content).toContain('document.pdf')
    })

    it('should handle multiple files', () => {
      const files = [
        { filename: 'doc1.pdf', content: 'Content 1' },
        { filename: 'doc2.txt', content: 'Content 2' }
      ]

      const message = OpenAIProvider.createMessageWithFiles(
        'Compare these files',
        files
      )

      expect(message.content).toContain('Content 1')
      expect(message.content).toContain('Content 2')
      expect(message.content).toContain('doc1.pdf')
      expect(message.content).toContain('doc2.txt')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network timeout', async () => {
      mockCreate.mockRejectedValue(new Error('Request timeout'))

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      await expect(OpenAIProvider.sendMessage(messages))
        .rejects.toThrow('Request timeout')
    })

    it('should handle malformed API response', async () => {
      mockCreate.mockResolvedValue({
        choices: [] // Empty choices array
      })

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' }
      ]

      const response = await OpenAIProvider.sendMessage(messages)

      // Should return fallback response
      expect(typeof response).toBe('string')
      expect(response.length).toBeGreaterThan(0)
    })

    it('should handle very long message history', async () => {
      const longMessages: ChatMessage[] = []
      for (let i = 0; i < 100; i++) {
        longMessages.push({ role: 'user', content: `Message ${i}` })
        longMessages.push({ role: 'assistant', content: `Response ${i}` })
      }

      await OpenAIProvider.sendMessage(longMessages)

      // Should still make API call (implementation handles token limits internally)
      expect(mockCreate).toHaveBeenCalled()
    })
  })
})