// PRIORITY 3 - SESSION CONTEXT MANAGEMENT
// Advanced session context, summarization, and context transfer for eduhu.ki

import {
  getChatSession,
  getMessagesForSession,
  updateChatSession,
  type ChatSession,
  type Message,
  DatabaseError,
  withRetry
} from './database'
import { getMemories, applyMemoryContext, type TeacherMemory } from './memory'
import { db } from './instant'
import { id } from '@instantdb/react'

// SESSION CONTEXT TYPES

export interface SessionContext {
  session: ChatSession
  messages: Message[]
  memories: TeacherMemory[]
  summary?: string
  totalTokens: number
  averageResponseTime: number
  educationalTopics: string[]
  lastActivity: number
}

export interface ContextTransferResult {
  success: boolean
  transferredContext: string
  transferredMemories: number
  errors?: string[]
}

export interface SessionSummary {
  id: string
  sessionId: string
  summary: string
  keyTopics: string[]
  importantPoints: string[]
  createdAt: number
  tokenCount: number
}

// CORE SESSION CONTEXT OPERATIONS

/**
 * Gets complete context for a session including messages, memories, and metadata
 */
export const getSessionContext = async (sessionId: string): Promise<SessionContext | null> => {
  try {
    // Get session details
    const session = await getChatSession(sessionId)
    if (!session) {
      return null
    }

    // Get messages for the session
    const messages = await getMessagesForSession(sessionId, 1000) // Get more for context

    // Get teacher memories
    const memories = await getMemories(session.teacher_id)

    // Calculate statistics
    const totalTokens = messages.reduce((sum, m) => sum + (m.token_count || 0), 0)
    const responseTimes = messages
      .filter(m => m.role === 'assistant' && m.response_time_ms)
      .map(m => m.response_time_ms!)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    // Extract educational topics
    const allTopics = messages
      .flatMap(m => m.educational_topics || [])
      .filter(topic => topic)
    const educationalTopics = [...new Set(allTopics)]

    // Get last activity time
    const lastActivity = Math.max(
      session.last_message_at || session.updated_at,
      ...messages.map(m => m.timestamp)
    )

    return {
      session,
      messages,
      memories,
      summary: session.context_summary,
      totalTokens,
      averageResponseTime,
      educationalTopics,
      lastActivity
    }
  } catch (error) {
    console.error('Failed to get session context:', error)
    throw new DatabaseError('Failed to load session context. Please try again.', error)
  }
}

/**
 * Creates an AI-powered summary of a session
 */
export const summarizeSession = async (
  sessionId: string,
  options?: {
    maxLength?: number
    includeTopics?: boolean
    includeKeyPoints?: boolean
  }
): Promise<SessionSummary> => {
  try {
    const context = await getSessionContext(sessionId)
    if (!context) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const maxLength = options?.maxLength || 500
    const includeTopics = options?.includeTopics !== false
    const includeKeyPoints = options?.includeKeyPoints !== false

    // Rule-based summarization (in production, this would use AI)
    const userMessages = context.messages.filter(m => m.role === 'user')
    const assistantMessages = context.messages.filter(m => m.role === 'assistant')

    // Extract key topics from messages
    const keyTopics: string[] = []
    if (includeTopics && context.educationalTopics.length > 0) {
      keyTopics.push(...context.educationalTopics.slice(0, 5)) // Top 5 topics
    }

    // Extract important points (simplified approach)
    const importantPoints: string[] = []
    if (includeKeyPoints) {
      // Look for messages with educational keywords
      const educationalKeywords = [
        'lesson plan', 'assessment', 'rubric', 'worksheet', 'activity',
        'objective', 'standard', 'curriculum', 'evaluation'
      ]

      const importantMessages = context.messages.filter(m =>
        educationalKeywords.some(keyword =>
          m.content.toLowerCase().includes(keyword)
        )
      )

      importantPoints.push(
        ...importantMessages
          .slice(0, 3) // Top 3 important messages
          .map(m => m.content.slice(0, 100) + (m.content.length > 100 ? '...' : ''))
      )
    }

    // Generate summary text
    let summary = ''
    if (userMessages.length > 0 && assistantMessages.length > 0) {
      const firstMessage = userMessages[0].content
      const sessionType = context.session.session_type || 'general'

      summary = `${sessionType.replace('_', ' ')} session with ${context.messages.length} messages. `

      if (firstMessage) {
        const preview = firstMessage.slice(0, 100)
        summary += `Started with: "${preview}${firstMessage.length > 100 ? '...' : ''}". `
      }

      if (keyTopics.length > 0) {
        summary += `Topics covered: ${keyTopics.join(', ')}. `
      }

      if (context.totalTokens > 0) {
        summary += `Total tokens: ${context.totalTokens}. `
      }

      // Trim to max length
      if (summary.length > maxLength) {
        summary = `${summary.slice(0, maxLength - 3)  }...`
      }
    }

    const sessionSummary: SessionSummary = {
      id: id(),
      sessionId,
      summary: summary || 'No summary available',
      keyTopics,
      importantPoints,
      createdAt: Date.now(),
      tokenCount: context.totalTokens
    }

    // Update session with summary
    await updateChatSession(sessionId, {
      context_summary: sessionSummary.summary
    })

    console.log(`Generated summary for session ${sessionId}`)
    return sessionSummary

  } catch (error) {
    console.error('Failed to summarize session:', error)
    throw new DatabaseError('Failed to generate session summary. Please try again.', error)
  }
}

/**
 * Transfers context from one session to another
 */
export const transferContext = async (
  fromSessionId: string,
  toSessionId: string,
  options?: {
    includeMessages?: boolean
    includeMemories?: boolean
    includeSummary?: boolean
    maxMessages?: number
  }
): Promise<ContextTransferResult> => {
  try {
    const includeMessages = options?.includeMessages !== false
    const includeMemories = options?.includeMemories !== false
    const includeSummary = options?.includeSummary !== false
    const maxMessages = options?.maxMessages || 10

    // Get source session context
    const sourceContext = await getSessionContext(fromSessionId)
    if (!sourceContext) {
      return {
        success: false,
        transferredContext: '',
        transferredMemories: 0,
        errors: [`Source session ${fromSessionId} not found`]
      }
    }

    // Get target session
    const targetSession = await getChatSession(toSessionId)
    if (!targetSession) {
      return {
        success: false,
        transferredContext: '',
        transferredMemories: 0,
        errors: [`Target session ${toSessionId} not found`]
      }
    }

    // Verify both sessions belong to same teacher
    if (sourceContext.session.teacher_id !== targetSession.teacher_id) {
      return {
        success: false,
        transferredContext: '',
        transferredMemories: 0,
        errors: ['Cannot transfer context between different teachers']
      }
    }

    let transferredContext = ''
    let transferredMemories = 0
    const errors: string[] = []

    try {
      // Transfer summary
      if (includeSummary && sourceContext.summary) {
        transferredContext += `Previous session context: ${sourceContext.summary}\n\n`
      }

      // Transfer recent messages as context
      if (includeMessages && sourceContext.messages.length > 0) {
        const recentMessages = sourceContext.messages
          .slice(-maxMessages) // Get last N messages
          .filter(m => m.role !== 'system') // Exclude system messages

        if (recentMessages.length > 0) {
          transferredContext += 'Recent conversation context:\n'
          recentMessages.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'Teacher' : 'Assistant'
            const content = msg.content.slice(0, 200) // Limit content length
            transferredContext += `${role}: ${content}${msg.content.length > 200 ? '...' : ''}\n`
          })
          transferredContext += '\n'
        }
      }

      // Update target session with transferred context
      if (transferredContext) {
        await updateChatSession(toSessionId, {
          context_summary: transferredContext.slice(0, 1000) // Limit summary length
        })
      }

      // Memory transfer happens automatically since memories are per-teacher
      if (includeMemories) {
        transferredMemories = sourceContext.memories.length
      }

      console.log(`Transferred context from session ${fromSessionId} to ${toSessionId}`)

      return {
        success: true,
        transferredContext,
        transferredMemories,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error) {
      errors.push(`Context transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        success: false,
        transferredContext,
        transferredMemories,
        errors
      }
    }

  } catch (error) {
    console.error('Failed to transfer context:', error)
    return {
      success: false,
      transferredContext: '',
      transferredMemories: 0,
      errors: [`Context transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
    }
  }
}

// SESSION CONTEXT UTILITIES

/**
 * Gets context-aware conversation history for AI prompts
 */
export const getContextualConversation = async (
  sessionId: string,
  options?: {
    includeMemories?: boolean
    maxMessages?: number
    includeSystemPrompts?: boolean
  }
): Promise<{
  messages: Message[]
  systemPrompt?: string
  contextMetadata: {
    sessionType: string
    totalMessages: number
    hasMemories: boolean
  }
}> => {
  try {
    const includeMemories = options?.includeMemories !== false
    const maxMessages = options?.maxMessages || 50
    const includeSystemPrompts = options?.includeSystemPrompts !== false

    const context = await getSessionContext(sessionId)
    if (!context) {
      throw new Error(`Session ${sessionId} not found`)
    }

    // Get recent messages
    let messages = context.messages.slice(-maxMessages)

    // Apply memory context if requested
    let systemPrompt: string | undefined
    if (includeMemories && context.memories.length > 0) {
      const enhancedContext = await applyMemoryContext(messages, context.session.teacher_id)
      messages = enhancedContext.enhancedMessages
      systemPrompt = enhancedContext.contextPrompt
    }

    // Filter out system messages if not requested
    if (!includeSystemPrompts) {
      messages = messages.filter(m => m.role !== 'system')
    }

    return {
      messages,
      systemPrompt,
      contextMetadata: {
        sessionType: context.session.session_type || 'general',
        totalMessages: context.messages.length,
        hasMemories: context.memories.length > 0
      }
    }

  } catch (error) {
    console.error('Failed to get contextual conversation:', error)
    throw new DatabaseError('Failed to load contextual conversation. Please try again.', error)
  }
}

/**
 * Archives old sessions to maintain performance
 */
export const archiveOldSessions = async (
  teacherId: string,
  options?: {
    olderThanDays?: number
    maxSessions?: number
    preservePinned?: boolean
  }
): Promise<{
  archivedCount: number
  errors?: string[]
}> => {
  try {
    const olderThanDays = options?.olderThanDays || 90
    const maxSessions = options?.maxSessions || 1000
    const preservePinned = options?.preservePinned !== false

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000)

    // Get old sessions
    const result = await db.query({
      chat_sessions: {
        $: {
          where: {
            teacher_id: teacherId,
            is_archived: false
          },
          order: {
            last_message_at: 'asc'
          },
          limit: maxSessions
        }
      }
    })

    const sessions = result.chat_sessions || []
    let candidatesForArchive = sessions.filter(s =>
      (s.last_message_at || s.updated_at) < cutoffTime
    )

    // Preserve pinned sessions if requested
    if (preservePinned) {
      candidatesForArchive = candidatesForArchive.filter(s => !s.is_pinned)
    }

    if (candidatesForArchive.length === 0) {
      return { archivedCount: 0 }
    }

    // Archive sessions
    const archiveTransactions = candidatesForArchive.map(s =>
      db.tx.chat_sessions[s.id].update({
        is_archived: true,
        updated_at: Date.now()
      })
    )

    await withRetry(async () => {
      return db.transact(archiveTransactions)
    })

    console.log(`Archived ${candidatesForArchive.length} old sessions for teacher ${teacherId}`)

    return {
      archivedCount: candidatesForArchive.length
    }

  } catch (error) {
    console.error('Failed to archive old sessions:', error)
    return {
      archivedCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Gets session activity patterns for analytics
 */
export const getSessionActivityPatterns = async (
  teacherId: string,
  timeRange?: { start: number; end: number }
): Promise<{
  dailyActivity: Record<string, number>
  hourlyActivity: Record<number, number>
  sessionTypeDistribution: Record<string, number>
  averageSessionLength: number
  totalSessions: number
}> => {
  try {
    // This would be more efficiently done with aggregation queries in production
    const result = await db.query({
      chat_sessions: {
        $: {
          where: {
            teacher_id: teacherId
          },
          limit: 1000
        }
      }
    })

    let sessions = result.chat_sessions || []

    // Filter by time range if provided
    if (timeRange) {
      sessions = sessions.filter(s =>
        s.created_at >= timeRange.start && s.created_at <= timeRange.end
      )
    }

    // Calculate patterns
    const dailyActivity: Record<string, number> = {}
    const hourlyActivity: Record<number, number> = {}
    const sessionTypeDistribution: Record<string, number> = {}
    let totalDuration = 0

    sessions.forEach(session => {
      // Daily activity
      const date = new Date(session.created_at).toISOString().split('T')[0]
      dailyActivity[date] = (dailyActivity[date] || 0) + 1

      // Hourly activity
      const hour = new Date(session.created_at).getHours()
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1

      // Session type distribution
      const type = session.session_type || 'general'
      sessionTypeDistribution[type] = (sessionTypeDistribution[type] || 0) + 1

      // Calculate session duration (rough estimate)
      const duration = (session.last_message_at || session.updated_at) - session.created_at
      totalDuration += duration
    })

    const averageSessionLength = sessions.length > 0
      ? totalDuration / sessions.length
      : 0

    return {
      dailyActivity,
      hourlyActivity,
      sessionTypeDistribution,
      averageSessionLength,
      totalSessions: sessions.length
    }

  } catch (error) {
    console.error('Failed to get session activity patterns:', error)
    return {
      dailyActivity: {},
      hourlyActivity: {},
      sessionTypeDistribution: {},
      averageSessionLength: 0,
      totalSessions: 0
    }
  }
}

// REACT HOOKS FOR SESSION CONTEXT

/**
 * React hook for getting session context
 */
export const useSessionContext = (sessionId?: string) => {
  // This would need to be implemented as a custom hook in a React environment
  // For now, returning a basic structure
  return {
    context: null,
    isLoading: true,
    error: null,
    refresh: async () => {
      if (sessionId) {
        return await getSessionContext(sessionId)
      }
      return null
    }
  }
}

// Export types and utilities
export type {
  SessionContext,
  ContextTransferResult,
  SessionSummary
}