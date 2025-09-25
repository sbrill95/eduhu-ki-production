// Database utility functions for eduhu.ki chat application
// Performance optimized with error handling and connection recovery
import {
  db,
  type ChatSession,
  type Message,
  type Teacher,
  type TeacherMemory,
  type ConversationContext,
  type MemoryUpdate,
  type SessionCreationOptions
} from './instant'
import { serverDb, generateId as serverGenerateId, type ChatSession as ServerChatSession, type Message as ServerMessage } from './instant-server'

// PRIORITY 1 - SESSION MANAGEMENT OPERATIONS

// Creates new chat session for a teacher
export const createChatSession = async (
  teacherId: string,
  title?: string,
  sessionType: 'lesson_planning' | 'general' | 'assessment' | 'curriculum' = 'general'
): Promise<string> => {
  const sessionId = typeof window === 'undefined' ? serverGenerateId() : crypto.randomUUID()
  const now = Date.now()
  const defaultTitle = title || `${sessionType.replace('_', ' ')} session`

  try {
    // Use Edge Runtime compatible server client when available
    const dbClient = typeof window === 'undefined' ? serverDb : db

    await withRetry(async () => {
      if (typeof window === 'undefined') {
        // Server-side Edge Runtime compatible transaction
        return serverDb.transact([
          serverDb.tx.chat_sessions(sessionId).update({
            teacher_id: teacherId,
            title: defaultTitle,
            created_at: now,
            updated_at: now,
            last_message_at: now,
            message_count: 0,
            session_type: sessionType,
            is_archived: false,
            is_pinned: false,
          })
        ])
      } else {
        // Client-side React-based transaction
        return db.transact([
          db.tx.chat_sessions[sessionId].update({
            teacher_id: teacherId,
            title: defaultTitle,
            created_at: now,
            updated_at: now,
            last_message_at: now,
            message_count: 0,
            session_type: sessionType,
            is_archived: false,
            is_pinned: false,
          })
        ])
      }
    })

    console.log(`Created chat session ${sessionId} for teacher ${teacherId}`)
    return sessionId
  } catch (error) {
    console.error('Failed to create chat session:', error)
    throw new DatabaseError('Failed to create new chat session. Please try again.', error)
  }
}

// Gets all chat sessions for a teacher with filtering options
export const getChatSessions = async (
  teacherId: string,
  options?: {
    limit?: number
    offset?: number
    includeArchived?: boolean
    sessionType?: string
    orderBy?: 'created_at' | 'updated_at' | 'last_message_at'
    orderDirection?: 'asc' | 'desc'
  }
): Promise<ChatSession[]> => {
  const limit = options?.limit || 50
  const offset = options?.offset || 0
  const includeArchived = options?.includeArchived || false
  const orderBy = options?.orderBy || 'last_message_at'
  const orderDirection = options?.orderDirection || 'desc'

  try {
    const whereClause: any = {
      teacher_id: teacherId
    }

    if (!includeArchived) {
      whereClause.is_archived = false
    }

    if (options?.sessionType) {
      whereClause.session_type = options.sessionType
    }

    const result = await db.query({
      chat_sessions: {
        $: {
          where: whereClause,
          order: {
            [orderBy]: orderDirection
          },
          limit,
          offset
        }
      }
    })

    return result.chat_sessions || []
  } catch (error) {
    console.error('Failed to get chat sessions:', error)
    throw new DatabaseError('Failed to load chat sessions. Please try again.', error)
  }
}

// Gets single chat session by ID
export const getChatSession = async (sessionId: string): Promise<ChatSession | null> => {
  try {
    // Use Edge Runtime compatible server client when available
    if (typeof window === 'undefined') {
      return await serverDb.getChatSession(sessionId)
    }

    const result = await db.query({
      chat_sessions: {
        $: {
          where: {
            id: sessionId
          }
        }
      }
    })

    return result.chat_sessions?.[0] || null
  } catch (error) {
    console.error('Failed to get chat session:', error)
    throw new DatabaseError('Failed to load chat session. Please try again.', error)
  }
}

// Updates chat session metadata
export const updateChatSession = async (
  sessionId: string,
  updates: {
    title?: string
    topic_category?: string
    session_type?: 'lesson_planning' | 'general' | 'assessment' | 'curriculum'
    is_archived?: boolean
    is_pinned?: boolean
    tags?: string[]
    context_summary?: string
  }
): Promise<void> => {
  try {
    const updateData: any = {
      ...updates,
      updated_at: Date.now()
    }

    await withRetry(async () => {
      return db.transact([
        db.tx.chat_sessions[sessionId].update(updateData)
      ])
    })

    console.log(`Updated chat session ${sessionId}`, updates)
  } catch (error) {
    console.error('Failed to update chat session:', error)
    throw new DatabaseError('Failed to update chat session. Please try again.', error)
  }
}

// Gets messages for a specific session with pagination
export const getMessagesForSession = async (
  sessionId: string,
  limit: number = 100,
  offset: number = 0
): Promise<Message[]> => {
  try {
    const result = await db.query({
      messages: {
        $: {
          where: {
            session_id: sessionId
          },
          order: {
            timestamp: 'asc'
          },
          limit,
          offset
        }
      }
    })

    return result.messages || []
  } catch (error) {
    console.error('Failed to get messages for session:', error)
    throw new DatabaseError('Failed to load messages. Please try again.', error)
  }
}

// Adds message to specific session
export const addMessageToSession = async (
  sessionId: string,
  content: string,
  role: 'user' | 'assistant' | 'system',
  metadata?: {
    teacherId?: string
    contentType?: 'text' | 'artifact' | 'image' | 'file_attachment'
    tokenCount?: number
    responseTimeMs?: number
    educationalTopics?: string[]
    intentClassification?: string
  }
): Promise<string> => {
  const messageId = typeof window === 'undefined' ? serverGenerateId() : crypto.randomUUID()
  const timestamp = Date.now()

  try {
    // Use Edge Runtime compatible server client when available
    if (typeof window === 'undefined') {
      return await serverDb.addMessageToSession(sessionId, content, role, {
        teacherId: metadata?.teacherId,
        contentType: metadata?.contentType,
        tokenCount: metadata?.tokenCount,
        responseTimeMs: metadata?.responseTimeMs,
        educationalTopics: metadata?.educationalTopics,
        intentClassification: metadata?.intentClassification
      })
    }

    // Get session to verify it exists and get teacher_id
    const session = await getChatSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const teacherId = metadata?.teacherId || session.teacher_id

    // Add message to session
    await withRetry(async () => {
      return db.transact([
        db.tx.messages[messageId].update({
          session_id: sessionId,
          teacher_id: teacherId,
          content,
          role,
          timestamp,
          content_type: metadata?.contentType || 'text',
          token_count: metadata?.tokenCount,
          response_time_ms: metadata?.responseTimeMs,
          educational_topics: metadata?.educationalTopics,
          intent_classification: metadata?.intentClassification
        })
      ])
    })

    // Update session metadata
    await withRetry(async () => {
      return db.transact([
        db.tx.chat_sessions[sessionId].update({
          updated_at: timestamp,
          last_message_at: timestamp,
          message_count: (session.message_count || 0) + 1
        })
      ])
    })

    console.log(`Added message ${messageId} to session ${sessionId}`)
    return messageId
  } catch (error) {
    console.error('Failed to add message to session:', error)
    throw new DatabaseError('Failed to save message. Please check your connection.', error)
  }
}

// Legacy function - updated to use new session system
export const updateChatTitle = async (sessionId: string, title: string): Promise<void> => {
  return updateChatSession(sessionId, { title })
}

// Legacy function - redirects to new session-based system
export const addMessage = async (
  sessionId: string,
  content: string,
  role: 'user' | 'assistant' | 'system',
  options?: {
    contentType?: 'text' | 'artifact' | 'image'
    tokenCount?: number
    responseTimeMs?: number
    educationalTopics?: string[]
  }
): Promise<string> => {
  return addMessageToSession(sessionId, content, role, {
    contentType: options?.contentType,
    tokenCount: options?.tokenCount,
    responseTimeMs: options?.responseTimeMs,
    educationalTopics: options?.educationalTopics
  })
}

// REACT HOOKS FOR SESSION QUERIES

// Hook for getting chat sessions (replaces useChats)
export const useChatSessions = (teacherId?: string, limit: number = 50) => {
  if (!teacherId) {
    return { data: null, isLoading: false, error: null }
  }

  return db.useQuery({
    chat_sessions: {
      $: {
        where: {
          teacher_id: teacherId,
          is_archived: false
        },
        order: {
          last_message_at: 'desc'
        },
        limit
      }
    }
  })
}

// Legacy function for backward compatibility
export const useChats = (teacherId?: string, limit: number = 50) => {
  return useChatSessions(teacherId, limit)
}

export const useMessages = (sessionId?: string, limit: number = 100) => {
  if (!sessionId) {
    return { data: null, isLoading: false, error: null }
  }

  // Production-optimized query with ordering and limiting
  return db.useQuery({
    messages: {
      $: {
        where: {
          session_id: sessionId
        },
        order: {
          timestamp: 'asc'
        },
        limit
      }
    }
  })
}

export const useSessionWithMessages = (sessionId?: string) => {
  if (!sessionId) {
    return { data: null, isLoading: false, error: null }
  }

  return db.useQuery({
    chat_sessions: {
      $: {
        where: {
          id: sessionId
        }
      }
    },
    messages: {
      $: {
        where: {
          session_id: sessionId
        }
      }
    }
  })
}

// Legacy function for backward compatibility
export const useChatWithMessages = (sessionId?: string) => {
  return useSessionWithMessages(sessionId)
}

// Utility functions
// Helper function for generating IDs (using crypto.randomUUID)
export const generateId = () => crypto.randomUUID()

export const formatChatTitle = (firstMessage: string, maxLength: number = 50): string => {
  const cleaned = firstMessage.trim().replace(/\n/g, ' ')
  return cleaned.length > maxLength
    ? `${cleaned.substring(0, maxLength)  }...`
    : cleaned
}

export const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}

export const sortSessionsByUpdatedAt = (sessions: ChatSession[]): ChatSession[] => {
  return [...sessions].sort((a, b) => (b.last_message_at || b.updated_at) - (a.last_message_at || a.updated_at))
}

// Legacy function for backward compatibility
export const sortChatsByUpdatedAt = (sessions: ChatSession[]): ChatSession[] => {
  return sortSessionsByUpdatedAt(sessions)
}

// Enhanced database error handling and connection recovery
export class DatabaseError extends Error {
  public readonly originalError?: unknown

  constructor(message: string, originalError?: unknown) {
    super(message)
    this.name = 'DatabaseError'
    this.originalError = originalError
  }
}

// ADVANCED UTILITY FUNCTIONS

// Generate context-aware session titles
export const generateContextualTitle = async (
  firstMessage: string,
  sessionType?: string,
  teacherMemories?: TeacherMemory[]
): Promise<string> => {
  // This would integrate with AI service for intelligent title generation
  // For now, use rule-based approach

  const maxLength = 50
  let title = firstMessage.trim().replace(/\n/g, ' ')

  // Extract key educational concepts
  const educationalKeywords = [
    'lesson plan', 'assessment', 'rubric', 'worksheet', 'activity',
    'curriculum', 'standards', 'objective', 'evaluation', 'project'
  ]

  const foundKeyword = educationalKeywords.find(keyword =>
    title.toLowerCase().includes(keyword)
  )

  if (foundKeyword) {
    const keywordIndex = title.toLowerCase().indexOf(foundKeyword)
    const start = Math.max(0, keywordIndex - 10)
    const end = Math.min(title.length, keywordIndex + foundKeyword.length + 10)
    title = title.substring(start, end).trim()
  }

  if (title.length > maxLength) {
    title = `${title.substring(0, maxLength - 3)  }...`
  }

  return title || `${sessionType || 'Chat'} - ${new Date().toLocaleTimeString()}`
}

// Get session statistics for analytics
export const getSessionStatistics = async (
  teacherId: string,
  timeRange?: { start: number; end: number }
): Promise<{
  totalSessions: number
  activeSessions: number
  totalMessages: number
  averageMessagesPerSession: number
  sessionsByType: Record<string, number>
}> => {
  try {
    const sessions = await getChatSessions(teacherId, {
      limit: 1000,
      includeArchived: true
    })

    let filteredSessions = sessions
    if (timeRange) {
      filteredSessions = sessions.filter(s =>
        s.created_at >= timeRange.start && s.created_at <= timeRange.end
      )
    }

    const activeSessions = filteredSessions.filter(s => !s.is_archived)
    const totalMessages = filteredSessions.reduce((sum, s) => sum + (s.message_count || 0), 0)
    const averageMessages = filteredSessions.length > 0 ? totalMessages / filteredSessions.length : 0

    const sessionsByType: Record<string, number> = {}
    filteredSessions.forEach(s => {
      const type = s.session_type || 'general'
      sessionsByType[type] = (sessionsByType[type] || 0) + 1
    })

    return {
      totalSessions: filteredSessions.length,
      activeSessions: activeSessions.length,
      totalMessages,
      averageMessagesPerSession: Math.round(averageMessages),
      sessionsByType
    }
  } catch (error) {
    console.error('Failed to get session statistics:', error)
    throw new DatabaseError('Failed to calculate session statistics.', error)
  }
}

// UTILITY FUNCTIONS FOR SESSION MANAGEMENT

// Validate session access permissions
export const validateSessionAccess = async (
  sessionId: string,
  teacherId: string
): Promise<boolean> => {
  try {
    // Use Edge Runtime compatible server client when available
    if (typeof window === 'undefined') {
      return await serverDb.validateSessionAccess(sessionId, teacherId)
    }

    const session = await getChatSession(sessionId)
    return session?.teacher_id === teacherId
  } catch (error) {
    console.error('Failed to validate session access:', error)
    return false
  }
}

// Calculate session statistics
export const calculateSessionStats = (messages: Message[]): {
  totalMessages: number
  userMessages: number
  assistantMessages: number
  totalTokens: number
  averageResponseTime: number
  educationalTopics: string[]
} => {
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')
  const totalTokens = messages.reduce((sum, m) => sum + (m.token_count || 0), 0)
  const responseTimes = assistantMessages
    .map(m => m.response_time_ms)
    .filter(rt => rt !== undefined) as number[]
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length
    : 0

  const allTopics = messages
    .flatMap(m => m.educational_topics || [])
    .filter(topic => topic)
  const uniqueTopics = [...new Set(allTopics)]

  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    totalTokens,
    averageResponseTime,
    educationalTopics: uniqueTopics
  }
}

// Export enhanced types for external use
export type {
  ConversationContext,
  MemoryUpdate,
  SessionCreationOptions,
  ChatSession,
  Message,
  Teacher,
  TeacherMemory
}

// Connection recovery with retry logic
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxRetries) {
        throw new DatabaseError(`Operation failed after ${maxRetries} attempts`, lastError)
      }

      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt - 1)
      await new Promise(resolve => setTimeout(resolve, backoffDelay))
    }
  }

  throw lastError!
}

// Database health check with proper error handling
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    // Test with a lightweight query
    await withRetry(async () => {
      const testId = crypto.randomUUID()
      // Just test the transaction syntax without actually creating data
      return db.transact([])
    })
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

// Advanced performance monitoring and caching utilities
export const monitorQueryPerformance = <T>(
  queryName: string,
  queryResult: T & { isLoading?: boolean; error?: any }
): T => {
  // Enhanced performance monitoring with metrics collection
  if (process.env.NODE_ENV === 'development') {
    if (queryResult.isLoading === false && !queryResult.error) {
      console.debug(`📊 Query '${queryName}' completed successfully`)
      // In production, send this to your analytics service
      trackQueryPerformance(queryName, 'success')
    } else if (queryResult.error) {
      console.warn(`⚠️ Query '${queryName}' failed:`, queryResult.error)
      trackQueryPerformance(queryName, 'error', queryResult.error)
    }
  }

  return queryResult
}

// Query performance tracking for production metrics
function trackQueryPerformance(queryName: string, status: 'success' | 'error', error?: any) {
  // In production, integrate with your monitoring service (DataDog, New Relic, etc.)
  if (process.env.NODE_ENV === 'production') {
    // Example: analytics.track('query_performance', { queryName, status, error })
    console.info(`Query Performance: ${queryName} - ${status}`, error ? { error } : {})
  }
}

// Advanced pagination utility for large datasets
export const usePaginatedMessages = (
  sessionId?: string,
  pageSize: number = 50,
  page: number = 0
) => {
  if (!sessionId) {
    return { data: null, isLoading: false, error: null }
  }

  return db.useQuery({
    messages: {
      $: {
        where: {
          session_id: sessionId
        },
        order: {
          timestamp: 'desc' // Latest first for chat pagination
        },
        limit: pageSize,
        offset: page * pageSize
      }
    }
  })
}

// Efficient session summary queries for dashboards
export const useSessionSummary = (sessionId: string) => {
  return db.useQuery({
    chat_sessions: {
      $: {
        where: {
          id: sessionId
        }
      }
    }
  })
}

// Legacy function for backward compatibility
export const useChatSummary = (sessionId: string) => {
  return useSessionSummary(sessionId)
}