import {
  createChat,
  addMessage,
  updateChatTitle,
  formatChatTitle,
  sortMessagesByTimestamp,
  sortChatsByUpdatedAt,
  DatabaseError,
  withRetry,
  testDatabaseConnection,
  monitorQueryPerformance,
  generateId
} from '../database'

// Mock InstantDB
jest.mock('../instant', () => ({
  db: {
    transact: jest.fn(),
    useQuery: jest.fn(),
    tx: {
      chats: {
        'test-chat-id': {
          update: jest.fn().mockReturnValue('chat-update-operation')
        }
      },
      messages: {
        'test-message-id': {
          update: jest.fn().mockReturnValue('message-update-operation')
        }
      }
    }
  }
}))

// Mock ID generation from InstantDB
jest.mock('@instantdb/react', () => ({
  id: jest.fn().mockReturnValue('generated-id')
}))

import { db } from '../instant'
import { id } from '@instantdb/react'

const mockDb = db as jest.Mocked<typeof db>
const mockId = id as jest.MockedFunction<typeof id>

describe('Database Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    // Reset to fake timers for each test
    jest.useFakeTimers()
    mockId.mockReturnValue('generated-id')
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('Chat Operations', () => {
    describe('createChat', () => {
      it('should create a new chat with correct data structure', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        const title = 'New lesson plan discussion'
        const chatId = await createChat(title)

        expect(chatId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalledWith([
          'chat-update-operation'
        ])
      })

      it('should handle teacher-specific lesson planning titles', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        const title = 'Help me create a 5th grade science lesson about photosynthesis'
        const chatId = await createChat(title)

        expect(chatId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalled()
      })

      it('should throw DatabaseError when transaction fails', async () => {
        const dbError = new Error('Connection failed')
        mockDb.transact.mockRejectedValue(dbError)

        await expect(createChat('Test chat')).rejects.toThrow(DatabaseError)
        await expect(createChat('Test chat')).rejects.toThrow('Failed to create new chat')
      })

      it('should retry on temporary failures', async () => {
        mockDb.transact
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce(undefined)

        const chatId = await createChat('Test chat')

        expect(chatId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalledTimes(2)
      })
    })

    describe('updateChatTitle', () => {
      it('should update chat title and timestamp', async () => {
        mockDb.transact.mockResolvedValue(undefined)
        const fixedTime = 1234567890
        jest.setSystemTime(fixedTime)

        await updateChatTitle('chat-123', 'Updated lesson plan')

        expect(mockDb.transact).toHaveBeenCalledWith([
          'chat-update-operation'
        ])
      })

      it('should handle database errors gracefully', async () => {
        mockDb.transact.mockRejectedValue(new Error('Update failed'))

        await expect(updateChatTitle('chat-123', 'New title')).rejects.toThrow(DatabaseError)
      })
    })
  })

  describe('Message Operations', () => {
    describe('addMessage', () => {
      it('should save user message with correct structure', async () => {
        mockDb.transact.mockResolvedValue(undefined)
        const fixedTime = 1234567890
        jest.setSystemTime(fixedTime)

        const messageId = await addMessage(
          'chat-123',
          'What are some effective reading comprehension strategies for 3rd graders?',
          'user'
        )

        expect(messageId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalledWith([
          'message-update-operation',
          'chat-update-operation'
        ])
      })

      it('should save AI assistant response correctly', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        const messageId = await addMessage(
          'chat-123',
          'Here are some proven reading comprehension strategies for 3rd graders: 1. Graphic organizers, 2. Think-alouds...',
          'assistant'
        )

        expect(messageId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalled()
      })

      it('should handle long educational content correctly', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        const longEducationalContent = `
        Here's a comprehensive lesson plan for teaching fractions to 4th graders:

        Objective: Students will understand basic fraction concepts and be able to identify numerator and denominator.

        Materials needed:
        - Fraction circles or bars
        - Worksheets
        - Interactive whiteboard

        Activity 1: Visual representation...
        `.trim()

        const messageId = await addMessage('chat-123', longEducationalContent, 'assistant')

        expect(messageId).toBe('generated-id')
        expect(mockDb.transact).toHaveBeenCalled()
      })

      it('should throw DatabaseError when message save fails', async () => {
        mockDb.transact.mockRejectedValue(new Error('Database unavailable'))

        await expect(addMessage('chat-123', 'Test message', 'user'))
          .rejects.toThrow(DatabaseError)
        await expect(addMessage('chat-123', 'Test message', 'user'))
          .rejects.toThrow('Failed to save message')
      })

      it('should batch message and chat update in single transaction', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        await addMessage('chat-123', 'Test message', 'user')

        // Verify transaction contains both operations
        expect(mockDb.transact).toHaveBeenCalledWith([
          'message-update-operation',
          'chat-update-operation'
        ])
      })
    })
  })

  describe('Utility Functions', () => {
    describe('formatChatTitle', () => {
      it('should format teacher question appropriately', () => {
        const question = 'How can I help struggling readers in my 2nd grade classroom improve their fluency?'
        const formatted = formatChatTitle(question, 50)

        expect(formatted).toBe('How can I help struggling readers in my 2nd grade...')
        expect(formatted.length).toBeLessThanOrEqual(53) // 50 + "..."
      })

      it('should handle short educational queries without truncation', () => {
        const question = 'Math lesson ideas?'
        const formatted = formatChatTitle(question, 50)

        expect(formatted).toBe('Math lesson ideas?')
        expect(formatted).not.toContain('...')
      })

      it('should clean up multi-line lesson plans', () => {
        const multilineContent = `Help me create a lesson plan\nfor teaching multiplication\nto 4th graders`
        const formatted = formatChatTitle(multilineContent, 50)

        expect(formatted).toBe('Help me create a lesson plan for teaching multi...')
        expect(formatted).not.toContain('\n')
      })

      it('should handle empty or whitespace-only content', () => {
        expect(formatChatTitle('   \n  \n  ', 50)).toBe('')
        expect(formatChatTitle('', 50)).toBe('')
      })
    })

    describe('sortMessagesByTimestamp', () => {
      it('should sort messages chronologically for chat display', () => {
        const messages = [
          { id: '3', chat_id: 'chat-1', content: 'Third message', role: 'user' as const, timestamp: 300 },
          { id: '1', chat_id: 'chat-1', content: 'First message', role: 'user' as const, timestamp: 100 },
          { id: '2', chat_id: 'chat-1', content: 'Second message', role: 'assistant' as const, timestamp: 200 }
        ]

        const sorted = sortMessagesByTimestamp(messages)

        expect(sorted[0].id).toBe('1')
        expect(sorted[1].id).toBe('2')
        expect(sorted[2].id).toBe('3')
      })

      it('should handle empty message array', () => {
        const sorted = sortMessagesByTimestamp([])
        expect(sorted).toEqual([])
      })

      it('should not mutate original array', () => {
        const originalMessages = [
          { id: '2', chat_id: 'chat-1', content: 'Second', role: 'user' as const, timestamp: 200 },
          { id: '1', chat_id: 'chat-1', content: 'First', role: 'user' as const, timestamp: 100 }
        ]
        const originalOrder = [...originalMessages]

        sortMessagesByTimestamp(originalMessages)

        expect(originalMessages).toEqual(originalOrder)
      })
    })

    describe('sortChatsByUpdatedAt', () => {
      it('should sort chats by most recently updated first', () => {
        const chats = [
          { id: '1', title: 'Old chat', created_at: 100, updated_at: 100 },
          { id: '3', title: 'Newest chat', created_at: 300, updated_at: 500 },
          { id: '2', title: 'Recent chat', created_at: 200, updated_at: 300 }
        ]

        const sorted = sortChatsByUpdatedAt(chats)

        expect(sorted[0].id).toBe('3') // Most recently updated
        expect(sorted[1].id).toBe('2')
        expect(sorted[2].id).toBe('1') // Oldest update
      })
    })

    describe('generateId', () => {
      it('should generate unique identifiers using InstantDB', () => {
        mockId.mockReturnValueOnce('id-1').mockReturnValueOnce('id-2')

        const id1 = generateId()
        const id2 = generateId()

        expect(id1).toBe('id-1')
        expect(id2).toBe('id-2')
        expect(mockId).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Error Handling & Recovery', () => {
    describe('DatabaseError', () => {
      it('should create error with message and original error', () => {
        const originalError = new Error('Network timeout')
        const dbError = new DatabaseError('Database operation failed', originalError)

        expect(dbError.message).toBe('Database operation failed')
        expect(dbError.name).toBe('DatabaseError')
        expect(dbError.originalError).toBe(originalError)
        expect(dbError).toBeInstanceOf(Error)
      })

      it('should work without original error', () => {
        const dbError = new DatabaseError('Operation failed')

        expect(dbError.message).toBe('Operation failed')
        expect(dbError.originalError).toBeUndefined()
      })
    })

    describe('withRetry', () => {
      it('should execute successful operation immediately', async () => {
        const operation = jest.fn().mockResolvedValue('success')

        const result = await withRetry(operation)

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(1)
      })

      it('should retry failed operations with exponential backoff', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('Fail 1'))
          .mockRejectedValueOnce(new Error('Fail 2'))
          .mockResolvedValueOnce('success')

        const promise = withRetry(operation, 3, 100)

        // Fast-forward through the delays
        await jest.advanceTimersByTimeAsync(100) // First retry delay
        await jest.advanceTimersByTimeAsync(200) // Second retry delay (exponential backoff)

        const result = await promise

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(3)
      })

      it('should throw DatabaseError after max retries exceeded', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'))

        const promise = withRetry(operation, 2, 50)

        // Fast-forward through delays
        await jest.advanceTimersByTimeAsync(50)  // First retry
        await jest.advanceTimersByTimeAsync(100) // Second retry (exponential backoff)

        await expect(promise).rejects.toThrow(DatabaseError)
        await expect(promise).rejects.toThrow('Operation failed after 2 attempts')
        expect(operation).toHaveBeenCalledTimes(2)
      })

      it('should handle non-Error thrown values', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce('string error')
          .mockResolvedValueOnce('success')

        const promise = withRetry(operation, 3, 10)
        await jest.advanceTimersByTimeAsync(10)

        const result = await promise
        expect(result).toBe('success')
      })
    })

    describe('testDatabaseConnection', () => {
      it('should return true for successful connection test', async () => {
        mockDb.transact.mockResolvedValue(undefined)

        const isConnected = await testDatabaseConnection()

        expect(isConnected).toBe(true)
        expect(mockDb.transact).toHaveBeenCalledWith([])
      })

      it('should return false when connection test fails', async () => {
        mockDb.transact.mockRejectedValue(new Error('Connection failed'))

        const isConnected = await testDatabaseConnection()

        expect(isConnected).toBe(false)
      })

      it('should use retry mechanism for connection testing', async () => {
        mockDb.transact
          .mockRejectedValueOnce(new Error('Temporary failure'))
          .mockResolvedValueOnce(undefined)

        const promise = testDatabaseConnection()
        await jest.advanceTimersByTimeAsync(1000) // Default retry delay

        const isConnected = await promise
        expect(isConnected).toBe(true)
        expect(mockDb.transact).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('Performance Monitoring', () => {
    describe('monitorQueryPerformance', () => {
      const originalConsole = console

      beforeEach(() => {
        global.console = {
          ...originalConsole,
          debug: jest.fn(),
          warn: jest.fn(),
          info: jest.fn(),
        }
      })

      afterEach(() => {
        global.console = originalConsole
      })

      it('should log successful query completion in development', () => {
        process.env.NODE_ENV = 'development'

        const queryResult = {
          data: { messages: [] },
          isLoading: false,
          error: null
        }

        const result = monitorQueryPerformance('test-query', queryResult)

        expect(result).toBe(queryResult)
        expect(console.debug).toHaveBeenCalledWith("📊 Query 'test-query' completed successfully")
      })

      it('should log query errors in development', () => {
        process.env.NODE_ENV = 'development'

        const queryResult = {
          data: null,
          isLoading: false,
          error: new Error('Query failed')
        }

        monitorQueryPerformance('failed-query', queryResult)

        expect(console.warn).toHaveBeenCalledWith(
          "⚠️ Query 'failed-query' failed:",
          queryResult.error
        )
      })

      it('should track performance metrics in production', () => {
        process.env.NODE_ENV = 'production'

        const queryResult = {
          data: { messages: [] },
          isLoading: false,
          error: null
        }

        monitorQueryPerformance('prod-query', queryResult)

        expect(console.info).toHaveBeenCalledWith(
          "Query Performance: prod-query - success",
          {}
        )
      })

      it('should not log during loading state', () => {
        process.env.NODE_ENV = 'development'

        const queryResult = {
          data: null,
          isLoading: true,
          error: null
        }

        monitorQueryPerformance('loading-query', queryResult)

        expect(console.debug).not.toHaveBeenCalled()
        expect(console.warn).not.toHaveBeenCalled()
      })
    })
  })
})