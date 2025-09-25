import {
  saveMemory,
  getMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  extractMemoriesFromMessage,
  applyMemoryContext,
  cleanupMemories,
  getMemoryStatistics,
  MEMORY_CONFIG,
  TeacherMemory
} from '../memory'
import { serverDb, type Message } from '../instant-server'
import { DatabaseError, withRetry } from '../database'
import { id } from '@instantdb/core'

// Mock external dependencies
jest.mock('../instant-server')
jest.mock('../database')
jest.mock('@instantdb/core')

const mockServerDb = serverDb as jest.Mocked<typeof serverDb>
const mockWithRetry = withRetry as jest.MockedFunction<typeof withRetry>
const mockId = id as jest.MockedFunction<typeof id>

describe('memory', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Setup common mock behavior
    mockWithRetry.mockImplementation(async (fn) => await fn())
    mockId.mockReturnValue('mock-id-123')

    // Mock serverDb methods
    mockServerDb.tx = {
      teacher_memory: jest.fn(() => ({
        update: jest.fn()
      }))
    } as any
    mockServerDb.transact = jest.fn().mockResolvedValue(undefined)
    mockServerDb.query = jest.fn()
  })

  describe('saveMemory', () => {
    const mockTeacherId = 'teacher-123'
    const mockKey = 'test-key'
    const mockValue = 'test-value'
    const mockType = 'preference'

    it('should create new memory when none exists', async () => {
      // Mock getMemory to return null (no existing memory)
      mockServerDb.query.mockResolvedValue({ teacher_memory: [] })

      const result = await saveMemory(mockTeacherId, mockKey, mockValue, mockType, {
        confidenceScore: 0.9,
        sourceSessionId: 'session-123'
      })

      expect(result).toBe('mock-id-123')
      expect(mockServerDb.transact).toHaveBeenCalledWith([
        expect.objectContaining({})
      ])
    })

    it('should update existing memory', async () => {
      const existingMemory: Partial<TeacherMemory> = {
        id: 'existing-id',
        teacher_id: mockTeacherId,
        key: mockKey,
        memory_type: mockType,
        value: 'old-value'
      }

      mockServerDb.query.mockResolvedValue({
        teacher_memory: [existingMemory]
      })

      const result = await saveMemory(mockTeacherId, mockKey, mockValue, mockType, {
        confidenceScore: 0.8
      })

      expect(result).toBe('existing-id')
      expect(mockServerDb.transact).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      mockServerDb.query.mockRejectedValue(new Error('Database error'))

      await expect(
        saveMemory(mockTeacherId, mockKey, mockValue, mockType)
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('getMemories', () => {
    const mockTeacherId = 'teacher-123'

    it('should retrieve all memories for a teacher', async () => {
      const mockMemories = [
        {
          id: '1',
          teacher_id: mockTeacherId,
          key: 'key1',
          value: 'value1',
          memory_type: 'preference',
          confidence_score: 0.8,
          created_at: Date.now(),
          updated_at: Date.now()
        },
        {
          id: '2',
          teacher_id: mockTeacherId,
          key: 'key2',
          value: 'value2',
          memory_type: 'context',
          confidence_score: 0.9,
          created_at: Date.now(),
          updated_at: Date.now()
        }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await getMemories(mockTeacherId)

      expect(result).toEqual(mockMemories)
      expect(mockServerDb.query).toHaveBeenCalledWith({
        teacher_memory: {
          $: {
            where: { teacher_id: mockTeacherId },
            order: { updated_at: 'desc' },
            limit: 1000
          }
        }
      })
    })

    it('should filter by memory type', async () => {
      const mockMemories = [
        { id: '1', memory_type: 'preference', confidence_score: 0.8 }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      await getMemories(mockTeacherId, 'preference')

      expect(mockServerDb.query).toHaveBeenCalledWith({
        teacher_memory: {
          $: {
            where: {
              teacher_id: mockTeacherId,
              memory_type: 'preference'
            },
            order: { updated_at: 'desc' },
            limit: 1000
          }
        }
      })
    })

    it('should filter out expired memories', async () => {
      const now = Date.now()
      const mockMemories = [
        {
          id: '1',
          expires_at: now + 10000, // Future expiry
          confidence_score: 0.8
        },
        {
          id: '2',
          expires_at: now - 10000, // Past expiry (should be filtered out)
          confidence_score: 0.8
        },
        {
          id: '3',
          expires_at: null, // No expiry
          confidence_score: 0.8
        }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await getMemories(mockTeacherId)

      expect(result).toHaveLength(2)
      expect(result.map(m => m.id)).toEqual(['1', '3'])
    })

    it('should filter by confidence score', async () => {
      const mockMemories = [
        { id: '1', confidence_score: 0.9 },
        { id: '2', confidence_score: 0.5 },
        { id: '3', confidence_score: 0.8 }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await getMemories(mockTeacherId, undefined, {
        minConfidence: 0.7
      })

      expect(result).toHaveLength(2)
      expect(result.map(m => m.id)).toEqual(['1', '3'])
    })
  })

  describe('getMemory', () => {
    const mockTeacherId = 'teacher-123'
    const mockKey = 'test-key'
    const mockType = 'preference'

    it('should retrieve specific memory by key and type', async () => {
      const mockMemory = {
        id: '1',
        teacher_id: mockTeacherId,
        key: mockKey,
        memory_type: mockType,
        value: 'test-value'
      }

      mockServerDb.query.mockResolvedValue({
        teacher_memory: [mockMemory]
      })

      const result = await getMemory(mockTeacherId, mockKey, mockType)

      expect(result).toEqual(mockMemory)
      expect(mockServerDb.query).toHaveBeenCalledWith({
        teacher_memory: {
          $: {
            where: {
              teacher_id: mockTeacherId,
              key: mockKey,
              memory_type: mockType
            }
          }
        }
      })
    })

    it('should return null for expired memory', async () => {
      const expiredMemory = {
        id: '1',
        expires_at: Date.now() - 10000 // Past expiry
      }

      mockServerDb.query.mockResolvedValue({
        teacher_memory: [expiredMemory]
      })

      const result = await getMemory(mockTeacherId, mockKey, mockType)

      expect(result).toBeNull()
    })

    it('should return null when memory not found', async () => {
      mockServerDb.query.mockResolvedValue({
        teacher_memory: []
      })

      const result = await getMemory(mockTeacherId, mockKey, mockType)

      expect(result).toBeNull()
    })
  })

  describe('extractMemoriesFromMessage', () => {
    const mockMessage: Message = {
      id: 'msg-1',
      session_id: 'session-123',
      teacher_id: 'teacher-123',
      content: '',
      role: 'user',
      timestamp: Date.now(),
      content_type: 'text'
    }

    it('should extract teaching preferences', async () => {
      const messageWithPreference = {
        ...mockMessage,
        content: 'I prefer using hands-on activities in my classroom.'
      }

      const result = await extractMemoriesFromMessage(messageWithPreference, 'teacher-123')

      expect(result.extracted).toContainEqual({
        key: 'teaching_preference',
        value: 'using hands-on activities in my classroom',
        type: 'preference',
        confidence: 0.7
      })
    })

    it('should extract grade levels', async () => {
      const messageWithGrades = {
        ...mockMessage,
        content: 'I teach 3rd grade and sometimes help with Grade 5 students.'
      }

      const result = await extractMemoriesFromMessage(messageWithGrades, 'teacher-123')

      const gradeMemory = result.extracted.find(e => e.key === 'grade_levels')
      expect(gradeMemory).toBeDefined()
      expect(gradeMemory?.value).toEqual([3, 5])
      expect(gradeMemory?.type).toBe('context')
      expect(gradeMemory?.confidence).toBe(0.9)
    })

    it('should extract subjects', async () => {
      const messageWithSubjects = {
        ...mockMessage,
        content: 'I love teaching math and science to my students.'
      }

      const result = await extractMemoriesFromMessage(messageWithSubjects, 'teacher-123')

      const subjectMemory = result.extracted.find(e => e.key === 'subjects')
      expect(subjectMemory).toBeDefined()
      expect(subjectMemory?.value).toEqual(['math', 'science'])
      expect(subjectMemory?.type).toBe('context')
    })

    it('should extract teaching styles', async () => {
      const messageWithStyle = {
        ...mockMessage,
        content: 'I believe in collaborative learning and group work.'
      }

      const result = await extractMemoriesFromMessage(messageWithStyle, 'teacher-123')

      const styleMemory = result.extracted.find(e => e.key === 'teaching_style')
      expect(styleMemory).toBeDefined()
      expect(styleMemory?.value).toBe('collaborative')
      expect(styleMemory?.type).toBe('preference')
    })

    it('should extract years of experience', async () => {
      const messageWithExperience = {
        ...mockMessage,
        content: 'I have 15 years of teaching experience.'
      }

      const result = await extractMemoriesFromMessage(messageWithExperience, 'teacher-123')

      const experienceMemory = result.extracted.find(e => e.key === 'years_experience')
      expect(experienceMemory).toBeDefined()
      expect(experienceMemory?.value).toBe(15)
      expect(experienceMemory?.type).toBe('context')
    })

    it('should return empty array for content without extractable memories', async () => {
      const messageWithoutMemories = {
        ...mockMessage,
        content: 'Hello, how are you today?'
      }

      const result = await extractMemoriesFromMessage(messageWithoutMemories, 'teacher-123')

      expect(result.extracted).toHaveLength(0)
      expect(result.sourceSessionId).toBe('session-123')
    })
  })

  describe('applyMemoryContext', () => {
    const mockTeacherId = 'teacher-123'
    const mockMessages: Message[] = [
      {
        id: 'msg-1',
        session_id: 'session-123',
        teacher_id: mockTeacherId,
        content: 'How can I improve my math lessons?',
        role: 'user',
        timestamp: Date.now(),
        content_type: 'text'
      }
    ]

    it('should add context prompt when memories exist', async () => {
      const mockMemories = [
        {
          id: '1',
          memory_type: 'preference',
          key: 'teaching_style',
          value: 'collaborative',
          confidence_score: 0.8
        },
        {
          id: '2',
          memory_type: 'context',
          key: 'subjects',
          value: ['math', 'science'],
          confidence_score: 0.9
        }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await applyMemoryContext(mockMessages, mockTeacherId)

      expect(result.enhancedMessages).toHaveLength(2) // System message + original message
      expect(result.enhancedMessages[0].role).toBe('system')
      expect(result.enhancedMessages[0].content).toContain('Teacher Context')
      expect(result.contextPrompt).toContain('teaching_style')
      expect(result.contextPrompt).toContain('subjects')
      expect(result.appliedMemories).toEqual(mockMemories)
    })

    it('should return original messages when no memories exist', async () => {
      mockServerDb.query.mockResolvedValue({
        teacher_memory: []
      })

      const result = await applyMemoryContext(mockMessages, mockTeacherId)

      expect(result.enhancedMessages).toEqual(mockMessages)
      expect(result.contextPrompt).toBe('')
      expect(result.appliedMemories).toHaveLength(0)
    })

    it('should handle errors gracefully', async () => {
      mockServerDb.query.mockRejectedValue(new Error('Database error'))

      const result = await applyMemoryContext(mockMessages, mockTeacherId)

      expect(result.enhancedMessages).toEqual(mockMessages)
      expect(result.contextPrompt).toBe('')
      expect(result.appliedMemories).toHaveLength(0)
    })
  })

  describe('cleanupMemories', () => {
    const mockTeacherId = 'teacher-123'

    it('should identify and cleanup expired and low confidence memories', async () => {
      const now = Date.now()
      const oldDate = now - (MEMORY_CONFIG.AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000)

      const mockMemories = [
        {
          id: '1',
          expires_at: now - 1000, // Already expired
          confidence_score: 0.8,
          created_at: oldDate - 1000
        },
        {
          id: '2',
          expires_at: null,
          confidence_score: 0.3, // Low confidence
          created_at: oldDate - 1000,
          is_verified: false
        },
        {
          id: '3',
          expires_at: null,
          confidence_score: 0.9, // Good confidence
          created_at: oldDate - 1000
        }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await cleanupMemories(mockTeacherId)

      expect(result.expiredRemoved).toBe(1)
      expect(result.lowConfidenceRemoved).toBe(1)
      expect(mockServerDb.transact).toHaveBeenCalled()
    })

    it('should handle cleanup errors gracefully', async () => {
      mockServerDb.query.mockRejectedValue(new Error('Database error'))

      const result = await cleanupMemories(mockTeacherId)

      expect(result.expiredRemoved).toBe(0)
      expect(result.lowConfidenceRemoved).toBe(0)
    })
  })

  describe('getMemoryStatistics', () => {
    const mockTeacherId = 'teacher-123'

    it('should calculate correct statistics', async () => {
      const now = Date.now()
      const mockMemories = [
        {
          id: '1',
          memory_type: 'preference',
          confidence_score: 0.8,
          is_verified: true,
          expires_at: null
        },
        {
          id: '2',
          memory_type: 'preference',
          confidence_score: 0.6,
          is_verified: false,
          expires_at: null
        },
        {
          id: '3',
          memory_type: 'context',
          confidence_score: 0.9,
          is_verified: true,
          expires_at: now - 1000 // Expired
        }
      ]

      mockServerDb.query.mockResolvedValue({
        teacher_memory: mockMemories
      })

      const result = await getMemoryStatistics(mockTeacherId)

      expect(result.totalMemories).toBe(3)
      expect(result.memoriesByType).toEqual({
        preference: 2,
        context: 1
      })
      expect(result.averageConfidence).toBeCloseTo(0.77, 2)
      expect(result.verifiedMemories).toBe(2)
      expect(result.expiredMemories).toBe(1)
    })

    it('should handle empty memories', async () => {
      mockServerDb.query.mockResolvedValue({
        teacher_memory: []
      })

      const result = await getMemoryStatistics(mockTeacherId)

      expect(result.totalMemories).toBe(0)
      expect(result.averageConfidence).toBe(0)
    })
  })

  describe('updateMemory', () => {
    it('should update memory with timestamp', async () => {
      const memoryId = 'memory-123'
      const updates = { value: 'new-value', confidence_score: 0.9 }

      await updateMemory(memoryId, updates)

      expect(mockServerDb.transact).toHaveBeenCalledWith([
        expect.objectContaining({})
      ])
    })

    it('should handle update errors', async () => {
      mockServerDb.transact.mockRejectedValue(new Error('Update failed'))

      await expect(
        updateMemory('memory-123', { value: 'new-value' })
      ).rejects.toThrow(DatabaseError)
    })
  })

  describe('deleteMemory', () => {
    it('should mark memory as expired instead of deleting', async () => {
      const memoryId = 'memory-123'

      await deleteMemory(memoryId)

      expect(mockServerDb.transact).toHaveBeenCalled()
    })

    it('should handle delete errors', async () => {
      mockServerDb.transact.mockRejectedValue(new Error('Delete failed'))

      await expect(
        deleteMemory('memory-123')
      ).rejects.toThrow(DatabaseError)
    })
  })
})