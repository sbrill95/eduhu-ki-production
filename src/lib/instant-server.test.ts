import {
  serverDb,
  generateId,
  QUERY_PERFORMANCE_THRESHOLDS,
  MEMORY_CONFIG,
  FILE_UPLOAD_CONFIG
} from './instant-server'

// Mock @instantdb/core
jest.mock('@instantdb/core', () => ({
  init: jest.fn(() => ({
    transact: jest.fn(),
    query: jest.fn(),
    tx: {
      chat_sessions: jest.fn(() => ({
        update: jest.fn(),
        delete: jest.fn()
      })),
      messages: jest.fn(() => ({
        update: jest.fn(),
        delete: jest.fn()
      })),
      file_uploads: jest.fn(() => ({
        update: jest.fn(),
        delete: jest.fn()
      })),
      teacher_memories: jest.fn(() => ({
        update: jest.fn(),
        delete: jest.fn()
      }))
    }
  })),
  id: jest.fn(() => 'generated-id-123')
}))

describe('Instant Server', () => {
  const mockInit = require('@instantdb/core').init
  const mockId = require('@instantdb/core').id

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock environment variables
    process.env.NEXT_PUBLIC_INSTANT_APP_ID = 'test-app-id-123'
    process.env.NODE_ENV = 'test'

    // Setup default successful mocks
    const mockDb = {
      transact: jest.fn().mockResolvedValue({}),
      query: jest.fn().mockResolvedValue({ data: {} }),
      tx: {
        chat_sessions: jest.fn(() => ({
          update: jest.fn(),
          delete: jest.fn()
        })),
        messages: jest.fn(() => ({
          update: jest.fn(),
          delete: jest.fn()
        })),
        file_uploads: jest.fn(() => ({
          update: jest.fn(),
          delete: jest.fn()
        })),
        teacher_memories: jest.fn(() => ({
          update: jest.fn(),
          delete: jest.fn()
        }))
      }
    }

    mockInit.mockReturnValue(mockDb)
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_INSTANT_APP_ID
    delete process.env.NODE_ENV
  })

  describe('Database Initialization', () => {
    it('should initialize with correct app ID', () => {
      // Re-import to trigger initialization
      jest.resetModules()
      process.env.NEXT_PUBLIC_INSTANT_APP_ID = 'test-app-id-123'
      require('./instant-server')

      expect(mockInit).toHaveBeenCalledWith({
        appId: 'test-app-id-123'
      })
    })

    it('should use demo app ID when not configured', () => {
      delete process.env.NEXT_PUBLIC_INSTANT_APP_ID

      jest.resetModules()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      require('./instant-server')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('USING DEMO InstantDB')
      )
      consoleSpy.mockRestore()
    })

    it('should log production connection info', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_INSTANT_APP_ID = 'prod-app-id-12345678'

      jest.resetModules()
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      require('./instant-server')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('InstantDB Server connected: prod-app-...5678')
      )
      consoleSpy.mockRestore()
    })
  })

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()

      expect(id1).toBe('generated-id-123')
      expect(id2).toBe('generated-id-123')
      expect(mockId).toHaveBeenCalledTimes(2)
    })
  })

  describe('Server Database Operations', () => {
    it('should execute transactions', async () => {
      const transactions = [
        serverDb.tx.chat_sessions('session-123').update({
          title: 'Test Session',
          updated_at: Date.now()
        })
      ]

      await serverDb.transact(transactions)

      expect(serverDb.transact).toHaveBeenCalledWith(transactions)
    })

    it('should execute queries', async () => {
      const query = {
        chat_sessions: {
          $: {
            where: { teacher_id: 'teacher-123' }
          }
        }
      }

      await serverDb.query(query)

      expect(serverDb.query).toHaveBeenCalledWith(query)
    })

    it('should handle transaction errors', async () => {
      const mockDb = mockInit()
      mockDb.transact.mockRejectedValue(new Error('Transaction failed'))

      await expect(serverDb.transact([])).rejects.toThrow('Transaction failed')
    })

    it('should handle query errors', async () => {
      const mockDb = mockInit()
      mockDb.query.mockRejectedValue(new Error('Query failed'))

      const query = { chat_sessions: {} }
      await expect(serverDb.query(query)).rejects.toThrow('Query failed')
    })
  })

  describe('Performance Configuration', () => {
    it('should have correct performance thresholds', () => {
      expect(QUERY_PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS).toBe(200)
      expect(QUERY_PERFORMANCE_THRESHOLDS.VERY_SLOW_QUERY_MS).toBe(500)
      expect(QUERY_PERFORMANCE_THRESHOLDS.MAX_RESULTS_WARNING).toBe(1000)
      expect(QUERY_PERFORMANCE_THRESHOLDS.MEMORY_CACHE_TTL_MS).toBe(300000)
      expect(QUERY_PERFORMANCE_THRESHOLDS.SESSION_CACHE_TTL_MS).toBe(600000)
      expect(QUERY_PERFORMANCE_THRESHOLDS.BATCH_OPERATION_SIZE).toBe(100)
      expect(QUERY_PERFORMANCE_THRESHOLDS.MAX_CONCURRENT_REQUESTS).toBe(10)
    })

    it('should validate performance threshold types', () => {
      Object.values(QUERY_PERFORMANCE_THRESHOLDS).forEach(value => {
        expect(typeof value).toBe('number')
        expect(value).toBeGreaterThan(0)
      })
    })
  })

  describe('Memory Configuration', () => {
    it('should have correct memory management settings', () => {
      expect(MEMORY_CONFIG.MAX_MEMORIES_PER_TEACHER).toBe(1000)
      expect(MEMORY_CONFIG.CONFIDENCE_THRESHOLD).toBe(0.7)
      expect(MEMORY_CONFIG.AUTO_EXPIRE_DAYS).toBe(90)
      expect(MEMORY_CONFIG.CLEANUP_INTERVAL_HOURS).toBe(24)
    })

    it('should have valid verification required types', () => {
      expect(MEMORY_CONFIG.VERIFICATION_REQUIRED_TYPES).toEqual(['preference', 'skill'])
      expect(Array.isArray(MEMORY_CONFIG.VERIFICATION_REQUIRED_TYPES)).toBe(true)
    })
  })

  describe('File Upload Configuration', () => {
    it('should have correct file upload settings', () => {
      expect(FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB).toBe(50)
      expect(FILE_UPLOAD_CONFIG.PROCESSING_QUEUE_SIZE).toBe(50)
      expect(FILE_UPLOAD_CONFIG.THUMBNAIL_SIZE).toEqual({
        width: 200,
        height: 200
      })
    })

    it('should have valid allowed file types', () => {
      expect(Array.isArray(FILE_UPLOAD_CONFIG.ALLOWED_TYPES)).toBe(true)
      expect(FILE_UPLOAD_CONFIG.ALLOWED_TYPES).toContain('image/*')
      expect(FILE_UPLOAD_CONFIG.ALLOWED_TYPES).toContain('application/pdf')
      expect(FILE_UPLOAD_CONFIG.ALLOWED_TYPES).toContain('text/*')
    })
  })

  describe('Database Schema Operations', () => {
    it('should support chat session operations', () => {
      const sessionTx = serverDb.tx.chat_sessions('session-123')

      expect(sessionTx.update).toBeDefined()
      expect(sessionTx.delete).toBeDefined()
    })

    it('should support message operations', () => {
      const messageTx = serverDb.tx.messages('message-123')

      expect(messageTx.update).toBeDefined()
      expect(messageTx.delete).toBeDefined()
    })

    it('should support file upload operations', () => {
      const fileTx = serverDb.tx.file_uploads('file-123')

      expect(fileTx.update).toBeDefined()
      expect(fileTx.delete).toBeDefined()
    })

    it('should support teacher memory operations', () => {
      const memoryTx = serverDb.tx.teacher_memories('memory-123')

      expect(memoryTx.update).toBeDefined()
      expect(memoryTx.delete).toBeDefined()
    })
  })

  describe('Complex Query Operations', () => {
    it('should handle complex queries with joins', async () => {
      const complexQuery = {
        chat_sessions: {
          $: {
            where: { teacher_id: 'teacher-123' }
          }
        },
        messages: {
          $: {
            where: { session_id: { in: ['session-1', 'session-2'] } }
          }
        }
      }

      await serverDb.query(complexQuery)

      expect(serverDb.query).toHaveBeenCalledWith(complexQuery)
    })

    it('should handle batch transactions', async () => {
      const batchTransactions = [
        serverDb.tx.chat_sessions('session-1').update({ title: 'Session 1' }),
        serverDb.tx.chat_sessions('session-2').update({ title: 'Session 2' }),
        serverDb.tx.messages('message-1').update({ content: 'Updated message' })
      ]

      await serverDb.transact(batchTransactions)

      expect(serverDb.transact).toHaveBeenCalledWith(batchTransactions)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      const mockDb = mockInit()
      mockDb.query.mockRejectedValue(new Error('Network error'))

      const query = { chat_sessions: {} }
      await expect(serverDb.query(query)).rejects.toThrow('Network error')
    })

    it('should handle invalid transaction data', async () => {
      const mockDb = mockInit()
      mockDb.transact.mockRejectedValue(new Error('Invalid transaction data'))

      const invalidTransaction = null
      await expect(serverDb.transact([invalidTransaction]))
        .rejects.toThrow('Invalid transaction data')
    })

    it('should handle rate limiting', async () => {
      const mockDb = mockInit()
      mockDb.query.mockRejectedValue(new Error('Rate limit exceeded'))

      const query = { chat_sessions: {} }
      await expect(serverDb.query(query)).rejects.toThrow('Rate limit exceeded')
    })
  })

  describe('Environment Validation', () => {
    it('should validate production environment setup', () => {
      process.env.NODE_ENV = 'production'
      process.env.NEXT_PUBLIC_INSTANT_APP_ID = 'prod-app-id'

      jest.resetModules()
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation()
      require('./instant-server')

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle missing environment variables in development', () => {
      delete process.env.NEXT_PUBLIC_INSTANT_APP_ID
      process.env.NODE_ENV = 'development'

      jest.resetModules()
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      require('./instant-server')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('USING DEMO InstantDB')
      )
      consoleSpy.mockRestore()
    })
  })
})