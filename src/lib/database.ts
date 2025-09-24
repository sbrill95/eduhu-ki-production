// Database utility functions for eduhu.ki chat application
// Performance optimized with error handling and connection recovery
import { db, type Chat, type Message } from './instant'
import { id } from '@instantdb/react'

// Chat operations
export const createChat = async (title: string): Promise<string> => {
  const chatId = id()
  const now = Date.now()

  try {
    await withRetry(async () => {
      return db.transact([
        db.tx.chats[chatId].update({
          title,
          created_at: now,
          updated_at: now,
        })
      ])
    })

    return chatId
  } catch (error) {
    console.error('Failed to create chat:', error)
    throw new DatabaseError('Failed to create new chat. Please try again.', error)
  }
}

export const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
  try {
    await withRetry(async () => {
      return db.transact([
        db.tx.chats[chatId].update({
          title,
          updated_at: Date.now(),
        })
      ])
    })
  } catch (error) {
    console.error('Failed to update chat title:', error)
    throw new DatabaseError('Failed to update chat title. Please try again.', error)
  }
}

// Enhanced message operations with advanced tracking and caching
export const addMessage = async (
  chatId: string,
  content: string,
  role: 'user' | 'assistant' | 'system',
  options?: {
    contentType?: 'text' | 'artifact' | 'image'
    tokenCount?: number
    responseTimeMs?: number
    educationalTopics?: string[]
  }
): Promise<string> => {
  const messageId = id()
  const timestamp = Date.now()

  try {
    // Add message
    await withRetry(async () => {
      return db.transact([
        db.tx.messages[messageId].update({
          chat_id: chatId,
          content,
          role,
          timestamp,
          content_type: options?.contentType || 'text',
          token_count: options?.tokenCount,
          response_time_ms: options?.responseTimeMs,
          educational_topics: options?.educationalTopics
        })
      ])
    })

    // Update chat metadata
    await withRetry(async () => {
      return db.transact([
        db.tx.chats[chatId].update({
          updated_at: timestamp
        })
      ])
    })

    return messageId
  } catch (error) {
    console.error('Failed to add message:', error)
    throw new DatabaseError('Failed to save message. Please check your connection.', error)
  }
}

// Advanced query functions optimized for scale
export const useChats = (limit: number = 50) => {
  // Optimized query with sorting and limiting for performance
  return db.useQuery({
    chats: {
      $: {
        order: {
          serverCreatedAt: 'desc'
        },
        limit: limit
      }
    }
  })
}

export const useMessages = (chatId?: string, limit: number = 100) => {
  if (!chatId) {
    return { data: null, isLoading: false, error: null }
  }

  // Production-optimized query with ordering and limiting
  return db.useQuery({
    messages: {
      $: {
        where: {
          chat_id: chatId
        },
        order: {
          serverCreatedAt: 'asc'
        },
        limit: limit
      }
    }
  })
}

export const useChatWithMessages = (chatId?: string) => {
  if (!chatId) {
    return { data: null, isLoading: false, error: null }
  }

  return db.useQuery({
    chats: {
      $: {
        where: {
          id: chatId
        }
      }
    },
    messages: {
      $: {
        where: {
          chat_id: chatId
        }
      }
    }
  })
}

// Utility functions
// Helper function for generating IDs (using InstantDB's id())
export const generateId = () => id()

export const formatChatTitle = (firstMessage: string, maxLength: number = 50): string => {
  const cleaned = firstMessage.trim().replace(/\n/g, ' ')
  return cleaned.length > maxLength
    ? cleaned.substring(0, maxLength) + '...'
    : cleaned
}

export const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => a.timestamp - b.timestamp)
}

export const sortChatsByUpdatedAt = (chats: Chat[]): Chat[] => {
  return [...chats].sort((a, b) => b.updated_at - a.updated_at)
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
      const testId = id()
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
  chatId?: string,
  pageSize: number = 50,
  page: number = 0
) => {
  if (!chatId) {
    return { data: null, isLoading: false, error: null }
  }

  return db.useQuery({
    messages: {
      $: {
        where: {
          chat_id: chatId
        },
        order: {
          serverCreatedAt: 'desc' // Latest first for chat pagination
        },
        limit: pageSize,
        offset: page * pageSize
      }
    }
  })
}

// Efficient chat summary queries for dashboards
export const useChatSummary = (chatId: string) => {
  // Simplified query without aggregates for now
  return db.useQuery({
    chats: {
      $: {
        where: {
          id: chatId
        }
      }
    }
  })
}