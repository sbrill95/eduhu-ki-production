/**
 * Database Layer Tests
 * Focus on core functionality with proper mocking
 */

import { DatabaseError } from './database'

// Mock InstantDB modules - use existing mocks from jest.setup.js
jest.mock('./instant', () => ({
  db: {
    transact: jest.fn(() => Promise.resolve({})),
    query: jest.fn(() => Promise.resolve({ data: {} })),
    tx: new Proxy({}, {
      get(target, entityName) {
        return new Proxy({}, {
          get(target, id) {
            return {
              update: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'update'
              }),
              delete: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'delete'
              })
            }
          }
        })
      }
    })
  }
}))

jest.mock('./instant-server', () => ({
  serverDb: {
    transact: jest.fn(() => Promise.resolve({})),
    query: jest.fn(() => Promise.resolve({ data: {} })),
    getChatSession: jest.fn(() => Promise.resolve(null)),
    addMessageToSession: jest.fn(() => Promise.resolve('server-message-id')),
    tx: new Proxy({}, {
      get(target, entityName) {
        return new Proxy({}, {
          get(target, id) {
            return {
              update: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'update'
              }),
              delete: jest.fn().mockReturnValue({
                entity: entityName,
                id,
                operation: 'delete'
              })
            }
          }
        })
      }
    })
  },
  generateId: jest.fn(() => 'generated-server-id-123')
}))

// Import after mocking
const database = require('./database')
const { db } = require('./instant')
const { serverDb } = require('./instant-server')

describe('Database Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers() // Use real timers for async operations

    // Set up environment for testing
    process.env.NODE_ENV = 'test'

    // Reset mocks to successful states
    db.transact.mockResolvedValue({})
    db.query.mockResolvedValue({ data: {}, chat_sessions: [] })
    serverDb.transact.mockResolvedValue({})
    serverDb.query.mockResolvedValue({ data: {}, chat_sessions: [] })
    serverDb.getChatSession.mockResolvedValue(null)
    serverDb.addMessageToSession.mockResolvedValue('server-message-id')
  })

  afterEach(() => {
    jest.useFakeTimers() // Restore fake timers
  })

  describe('DatabaseError', () => {
    it('should create a custom database error', () => {
      const originalError = new Error('Original error')
      const dbError = new DatabaseError('Database operation failed', originalError)

      expect(dbError.message).toBe('Database operation failed')
      expect(dbError.originalError).toBe(originalError)
      expect(dbError.name).toBe('DatabaseError')
    })

    it('should work without original error', () => {
      const dbError = new DatabaseError('Simple error')

      expect(dbError.message).toBe('Simple error')
      expect(dbError.originalError).toBeUndefined()
      expect(dbError.name).toBe('DatabaseError')
    })
  })

  describe('Core Database Operations', () => {
    it('should handle client-side environment detection', () => {
      // Mock window to simulate client-side
      Object.defineProperty(global, 'window', {
        value: {},
        writable: true
      })

      expect(typeof window).not.toBe('undefined')
    })

    it('should handle server-side environment detection', () => {
      // Mock window as undefined to simulate server-side
      const originalWindow = global.window
      delete (global as any).window

      expect(typeof window).toBe('undefined')

      // Restore window
      global.window = originalWindow
    })

    it('should generate UUIDs in client environment', () => {
      const uuid = crypto.randomUUID()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('Session Management', () => {
    it('should export createChatSession function', () => {
      expect(typeof database.createChatSession).toBe('function')
    })

    describe('createChatSession', () => {
      it('should create a chat session in server environment', async () => {
        // Mock server environment
        const originalWindow = global.window
        delete (global as any).window

        const sessionId = await database.createChatSession('teacher-123', 'Test Session', 'lesson_planning')

        expect(sessionId).toBe('generated-server-id-123')
        expect(serverDb.transact).toHaveBeenCalledWith([
          expect.objectContaining({
            entity: 'chat_sessions',
            id: 'generated-server-id-123',
            operation: 'update'
          })
        ])

        // Restore window
        global.window = originalWindow
      })

      it('should create a chat session in client environment', async () => {
        // Mock client environment
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        // Mock crypto.randomUUID
        global.crypto = {
          randomUUID: jest.fn(() => 'client-generated-uuid')
        }

        const sessionId = await database.createChatSession('teacher-456', 'Client Session')

        expect(sessionId).toBe('client-generated-uuid')
        expect(db.transact).toHaveBeenCalled()
      })

      it('should use default title when not provided', async () => {
        const originalWindow = global.window
        delete (global as any).window

        await database.createChatSession('teacher-789', undefined, 'assessment')

        expect(serverDb.transact).toHaveBeenCalledWith([
          expect.objectContaining({
            entity: 'chat_sessions',
            id: 'generated-server-id-123',
            operation: 'update'
          })
        ])

        global.window = originalWindow
      })

      it('should handle errors and throw DatabaseError', async () => {
        const originalWindow = global.window
        delete (global as any).window

        serverDb.transact.mockRejectedValue(new Error('Database connection failed'))

        await expect(database.createChatSession('teacher-error', 'Error Session'))
          .rejects.toThrow(DatabaseError)

        global.window = originalWindow
      })
    })

    describe('getChatSessions', () => {
      beforeEach(() => {
        db.query.mockResolvedValue({
          chat_sessions: [
            { id: 'session-1', teacher_id: 'teacher-123', title: 'Session 1' },
            { id: 'session-2', teacher_id: 'teacher-123', title: 'Session 2' }
          ]
        })
      })

      it('should fetch chat sessions with default options', async () => {
        const sessions = await database.getChatSessions('teacher-123')

        expect(db.query).toHaveBeenCalledWith({
          chat_sessions: {
            $: {
              where: {
                teacher_id: 'teacher-123',
                is_archived: false
              },
              order: {
                last_message_at: 'desc'
              },
              limit: 50,
              offset: 0
            }
          }
        })
        expect(sessions).toHaveLength(2)
      })

      it('should handle custom filtering options', async () => {
        await database.getChatSessions('teacher-456', {
          limit: 10,
          offset: 20,
          includeArchived: true,
          sessionType: 'lesson_planning',
          orderBy: 'created_at',
          orderDirection: 'asc'
        })

        expect(db.query).toHaveBeenCalledWith({
          chat_sessions: {
            $: {
              where: {
                teacher_id: 'teacher-456',
                session_type: 'lesson_planning'
              },
              order: {
                created_at: 'asc'
              },
              limit: 10,
              offset: 20
            }
          }
        })
      })

      it('should handle errors and throw DatabaseError', async () => {
        db.query.mockRejectedValue(new Error('Query failed'))

        await expect(database.getChatSessions('teacher-error'))
          .rejects.toThrow(DatabaseError)
      })

      it('should return empty array when no sessions found', async () => {
        db.query.mockResolvedValue({ chat_sessions: undefined })

        const sessions = await database.getChatSessions('teacher-empty')
        expect(sessions).toEqual([])
      })
    })

    describe('getChatSession', () => {
      it('should fetch single session in server environment', async () => {
        const originalWindow = global.window
        delete (global as any).window

        const mockSession = { id: 'session-123', title: 'Test Session' }
        serverDb.getChatSession.mockResolvedValue(mockSession)

        const session = await database.getChatSession('session-123')

        expect(serverDb.getChatSession).toHaveBeenCalledWith('session-123')
        expect(session).toEqual(mockSession)

        global.window = originalWindow
      })

      it('should fetch single session in client environment', async () => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        const mockSession = { id: 'session-456', title: 'Client Session' }
        db.query.mockResolvedValue({ chat_sessions: [mockSession] })

        const session = await database.getChatSession('session-456')

        expect(db.query).toHaveBeenCalledWith({
          chat_sessions: {
            $: {
              where: { id: 'session-456' }
            }
          }
        })
        expect(session).toEqual(mockSession)
      })

      it('should return null when session not found', async () => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        db.query.mockResolvedValue({ chat_sessions: [] })

        const session = await database.getChatSession('nonexistent')
        expect(session).toBeNull()
      })

      it('should handle errors and throw DatabaseError', async () => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        db.query.mockRejectedValue(new Error('Query failed'))

        await expect(database.getChatSession('error-session'))
          .rejects.toThrow(DatabaseError)
      })
    })
  })

  describe('Message Management', () => {
    describe('addMessageToSession', () => {
      it('should add message in server environment', async () => {
        const originalWindow = global.window
        delete (global as any).window

        const messageId = await database.addMessageToSession(
          'session-123',
          'Test message content',
          'user',
          { teacherId: 'teacher-456', contentType: 'text', tokenCount: 50 }
        )

        expect(messageId).toBe('server-message-id')
        expect(serverDb.addMessageToSession).toHaveBeenCalledWith(
          'session-123',
          'Test message content',
          'user',
          {
            teacherId: 'teacher-456',
            contentType: 'text',
            tokenCount: 50,
            responseTimeMs: undefined,
            educationalTopics: undefined,
            intentClassification: undefined
          }
        )

        global.window = originalWindow
      })

      it('should add message in client environment', async () => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        global.crypto = {
          randomUUID: jest.fn(() => 'client-message-uuid')
        }

        // Mock getChatSession to return a session
        const mockSession = { id: 'session-456', teacher_id: 'teacher-789' }
        db.query.mockResolvedValue({ chat_sessions: [mockSession] })

        const messageId = await database.addMessageToSession(
          'session-456',
          'Client message',
          'assistant'
        )

        expect(messageId).toBe('client-message-uuid')
        expect(db.transact).toHaveBeenCalled()
      })

      it('should handle session not found error', async () => {
        Object.defineProperty(global, 'window', {
          value: {},
          writable: true
        })

        // Mock getChatSession to return null (session not found)
        db.query.mockResolvedValue({ chat_sessions: [] })

        await expect(database.addMessageToSession('nonexistent', 'message', 'user'))
          .rejects.toThrow('Session nonexistent not found')
      })

      it('should handle errors and throw DatabaseError', async () => {
        const originalWindow = global.window
        delete (global as any).window

        serverDb.addMessageToSession.mockRejectedValue(new Error('Database error'))

        await expect(database.addMessageToSession('session-error', 'message', 'user'))
          .rejects.toThrow(DatabaseError)

        global.window = originalWindow
      })
    })
  })

  describe('Utility Functions', () => {
    describe('withRetry', () => {
      it('should succeed on first attempt', async () => {
        const operation = jest.fn().mockResolvedValue('success')

        const result = await database.withRetry(operation)

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(1)
      })

      it('should retry on failure and eventually succeed', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockRejectedValueOnce(new Error('Second failure'))
          .mockResolvedValue('success')

        const result = await database.withRetry(operation)

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(3)
      })

      it('should throw error after max retries', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'))

        await expect(database.withRetry(operation, 2))
          .rejects.toThrow('Persistent failure')

        expect(operation).toHaveBeenCalledTimes(2)
      })

      it('should handle custom retry parameters', async () => {
        const operation = jest.fn()
          .mockRejectedValueOnce(new Error('First failure'))
          .mockResolvedValue('success')

        const startTime = Date.now()
        const result = await database.withRetry(operation, 3, 100)
        const endTime = Date.now()

        expect(result).toBe('success')
        expect(operation).toHaveBeenCalledTimes(2)
        // Should have waited at least 100ms between retries
        expect(endTime - startTime).toBeGreaterThanOrEqual(100)
      })
    })

    it('should export getChatSession function', () => {
      expect(typeof database.getChatSession).toBe('function')
    })

    it('should export withRetry function', () => {
      expect(typeof database.withRetry).toBe('function')
    })

    it('should export addMessageToSession function', () => {
      expect(typeof database.addMessageToSession).toBe('function')
    })

    it('should export getChatSessions function', () => {
      expect(typeof database.getChatSessions).toBe('function')
    })
  })
})
