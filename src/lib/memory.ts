// PRIORITY 2 - MEMORY MANAGEMENT SYSTEM
// Advanced teacher memory and context persistence for eduhu.ki

import { db, type TeacherMemory, type Message, MEMORY_CONFIG } from './instant'
import { id } from '@instantdb/react'
import { DatabaseError, withRetry } from './database'

// CORE MEMORY OPERATIONS

/**
 * Saves or updates a memory item for a teacher
 */
export const saveMemory = async (
  teacherId: string,
  key: string,
  value: any,
  memoryType: 'preference' | 'pattern' | 'context' | 'skill',
  options?: {
    confidenceScore?: number
    sourceSessionId?: string
    expiresAt?: number
    isVerified?: boolean
  }
): Promise<string> => {
  try {
    // Check if memory already exists
    const existing = await getMemory(teacherId, key, memoryType)

    if (existing) {
      // Update existing memory
      await updateMemory(existing.id, {
        value,
        confidence_score: options?.confidenceScore,
        updated_at: Date.now(),
        last_accessed: Date.now(),
        source_session_id: options?.sourceSessionId,
        expires_at: options?.expiresAt,
        is_verified: options?.isVerified
      })

      console.log(`Updated memory ${existing.id} for teacher ${teacherId}: ${key}`)
      return existing.id
    } else {
      // Create new memory
      const memoryId = id()
      const now = Date.now()

      await withRetry(async () => {
        return db.transact([
          db.tx.teacher_memory[memoryId].update({
            teacher_id: teacherId,
            memory_type: memoryType,
            key,
            value,
            confidence_score: options?.confidenceScore || 0.8,
            created_at: now,
            updated_at: now,
            last_accessed: now,
            source_session_id: options?.sourceSessionId,
            expires_at: options?.expiresAt,
            is_verified: options?.isVerified || false
          })
        ])
      })

      console.log(`Created memory ${memoryId} for teacher ${teacherId}: ${key}`)
      return memoryId
    }
  } catch (error) {
    console.error('Failed to save memory:', error)
    throw new DatabaseError('Failed to save memory. Please try again.', error)
  }
}

/**
 * Retrieves memories for a teacher, optionally filtered by type
 */
export const getMemories = async (
  teacherId: string,
  memoryType?: 'preference' | 'pattern' | 'context' | 'skill',
  options?: {
    includeExpired?: boolean
    minConfidence?: number
    limit?: number
  }
): Promise<TeacherMemory[]> => {
  try {
    const whereClause: any = {
      teacher_id: teacherId
    }

    if (memoryType) {
      whereClause.memory_type = memoryType
    }

    const result = await db.query({
      teacher_memory: {
        $: {
          where: whereClause,
          order: {
            updated_at: 'desc'
          },
          limit: options?.limit || 1000
        }
      }
    })

    let memories = result.teacher_memory || []
    const now = Date.now()

    // Filter out expired memories unless explicitly requested
    if (!options?.includeExpired) {
      memories = memories.filter(m => !m.expires_at || m.expires_at > now)
    }

    // Filter by confidence score
    if (options?.minConfidence) {
      memories = memories.filter(m =>
        (m.confidence_score || 0) >= options.minConfidence!
      )
    }

    // Update last_accessed for retrieved memories
    if (memories.length > 0) {
      updateMemoryAccess(memories.map(m => m.id))
    }

    return memories
  } catch (error) {
    console.error('Failed to get memories:', error)
    throw new DatabaseError('Failed to retrieve memories. Please try again.', error)
  }
}

/**
 * Gets a specific memory by key and type
 */
export const getMemory = async (
  teacherId: string,
  key: string,
  memoryType: 'preference' | 'pattern' | 'context' | 'skill'
): Promise<TeacherMemory | null> => {
  try {
    const result = await db.query({
      teacher_memory: {
        $: {
          where: {
            teacher_id: teacherId,
            key: key,
            memory_type: memoryType
          }
        }
      }
    })

    const memory = result.teacher_memory?.[0] || null

    // Check if memory is expired
    if (memory && memory.expires_at && memory.expires_at < Date.now()) {
      return null
    }

    if (memory) {
      updateMemoryAccess([memory.id])
    }

    return memory
  } catch (error) {
    console.error('Failed to get memory:', error)
    throw new DatabaseError('Failed to retrieve memory. Please try again.', error)
  }
}

/**
 * Updates an existing memory
 */
export const updateMemory = async (
  memoryId: string,
  updates: Partial<TeacherMemory>
): Promise<void> => {
  try {
    const updateData = {
      ...updates,
      updated_at: Date.now()
    }

    await withRetry(async () => {
      return db.transact([
        db.tx.teacher_memory[memoryId].update(updateData)
      ])
    })

    console.log(`Updated memory ${memoryId}`)
  } catch (error) {
    console.error('Failed to update memory:', error)
    throw new DatabaseError('Failed to update memory. Please try again.', error)
  }
}

/**
 * Deletes a memory (or marks it as expired)
 */
export const deleteMemory = async (memoryId: string): Promise<void> => {
  try {
    // Instead of deleting, mark as expired for audit trail
    await updateMemory(memoryId, {
      expires_at: Date.now()
    })

    console.log(`Marked memory ${memoryId} as expired`)
  } catch (error) {
    console.error('Failed to delete memory:', error)
    throw new DatabaseError('Failed to delete memory. Please try again.', error)
  }
}

// MEMORY EXTRACTION AND ANALYSIS

/**
 * Extracts memories from a conversation message using AI analysis
 */
export const extractMemoriesFromMessage = async (
  message: Message,
  teacherId: string
): Promise<{
  extracted: Array<{
    key: string
    value: any
    type: 'preference' | 'pattern' | 'context' | 'skill'
    confidence: number
  }>
  sourceSessionId: string
}> => {
  try {
    const extracted: Array<{
      key: string
      value: any
      type: 'preference' | 'pattern' | 'context' | 'skill'
      confidence: number
    }> = []

    // Rule-based extraction for common patterns
    const content = message.content.toLowerCase()

    // Extract teaching preferences
    if (content.includes('i prefer') || content.includes('i like to')) {
      const preferenceMatch = content.match(/i (?:prefer|like to) (.+?)(?:\.|$|,)/i)
      if (preferenceMatch) {
        extracted.push({
          key: 'teaching_preference',
          value: preferenceMatch[1].trim(),
          type: 'preference',
          confidence: 0.7
        })
      }
    }

    // Extract grade level mentions
    const gradeMatches = content.match(/(\d+)(?:st|nd|rd|th)?\s*grade|grade\s*(\d+)/gi)
    if (gradeMatches) {
      const grades = gradeMatches.map(match => {
        const num = match.match(/\d+/)
        return num ? parseInt(num[0]) : null
      }).filter(Boolean)

      if (grades.length > 0) {
        extracted.push({
          key: 'grade_levels',
          value: grades,
          type: 'context',
          confidence: 0.9
        })
      }
    }

    // Extract subject mentions
    const subjects = [
      'math', 'mathematics', 'science', 'english', 'literature', 'reading',
      'history', 'social studies', 'art', 'music', 'physical education',
      'pe', 'spanish', 'french', 'biology', 'chemistry', 'physics'
    ]

    const foundSubjects = subjects.filter(subject => content.includes(subject))
    if (foundSubjects.length > 0) {
      extracted.push({
        key: 'subjects',
        value: foundSubjects,
        type: 'context',
        confidence: 0.8
      })
    }

    // Extract teaching style indicators
    const teachingStyles = {
      'structured': ['structured', 'organized', 'systematic', 'step by step'],
      'collaborative': ['collaborative', 'group work', 'teamwork', 'peer'],
      'flexible': ['flexible', 'adaptable', 'different approaches', 'varied']
    }

    for (const [style, keywords] of Object.entries(teachingStyles)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        extracted.push({
          key: 'teaching_style',
          value: style,
          type: 'preference',
          confidence: 0.6
        })
        break
      }
    }

    // Extract years of experience
    const experienceMatch = content.match(/(\d+)\s*years?\s*(?:of\s*)?(?:experience|teaching)/i)
    if (experienceMatch) {
      extracted.push({
        key: 'years_experience',
        value: parseInt(experienceMatch[1]),
        type: 'context',
        confidence: 0.9
      })
    }

    return {
      extracted,
      sourceSessionId: message.session_id
    }
  } catch (error) {
    console.error('Failed to extract memories from message:', error)
    return {
      extracted: [],
      sourceSessionId: message.session_id
    }
  }
}

/**
 * Applies memory context to a conversation for AI prompts
 */
export const applyMemoryContext = async (
  messages: Message[],
  teacherId: string
): Promise<{
  enhancedMessages: Message[]
  contextPrompt: string
  appliedMemories: TeacherMemory[]
}> => {
  try {
    // Get relevant memories
    const memories = await getMemories(teacherId, undefined, {
      minConfidence: MEMORY_CONFIG.CONFIDENCE_THRESHOLD
    })

    if (memories.length === 0) {
      return {
        enhancedMessages: messages,
        contextPrompt: '',
        appliedMemories: []
      }
    }

    // Build context prompt from memories
    const contextSections: string[] = []

    // Teaching preferences
    const preferences = memories.filter(m => m.memory_type === 'preference')
    if (preferences.length > 0) {
      const prefText = preferences
        .map(p => `${p.key}: ${JSON.stringify(p.value)}`)
        .join(', ')
      contextSections.push(`Teaching preferences: ${prefText}`)
    }

    // Educational context
    const context = memories.filter(m => m.memory_type === 'context')
    if (context.length > 0) {
      const contextText = context
        .map(c => `${c.key}: ${JSON.stringify(c.value)}`)
        .join(', ')
      contextSections.push(`Teaching context: ${contextText}`)
    }

    // Skills and patterns
    const skills = memories.filter(m => m.memory_type === 'skill' || m.memory_type === 'pattern')
    if (skills.length > 0) {
      const skillsText = skills
        .map(s => `${s.key}: ${JSON.stringify(s.value)}`)
        .join(', ')
      contextSections.push(`Teaching skills/patterns: ${skillsText}`)
    }

    const contextPrompt = contextSections.length > 0
      ? `Teacher Context (use to personalize responses): ${contextSections.join('. ')}.`
      : ''

    // Add system message with context if we have context to add
    let enhancedMessages = messages
    if (contextPrompt) {
      const systemMessage: Message = {
        id: id(),
        session_id: messages[0]?.session_id || '',
        teacher_id: teacherId,
        content: contextPrompt,
        role: 'system',
        timestamp: Date.now(),
        content_type: 'text'
      }

      enhancedMessages = [systemMessage, ...messages]
    }

    return {
      enhancedMessages,
      contextPrompt,
      appliedMemories: memories
    }
  } catch (error) {
    console.error('Failed to apply memory context:', error)
    // Return original messages if memory application fails
    return {
      enhancedMessages: messages,
      contextPrompt: '',
      appliedMemories: []
    }
  }
}

// MEMORY MAINTENANCE AND CLEANUP

/**
 * Updates last_accessed timestamp for memories
 */
const updateMemoryAccess = async (memoryIds: string[]): Promise<void> => {
  try {
    const now = Date.now()
    const transactions = memoryIds.map(id =>
      db.tx.teacher_memory[id].update({ last_accessed: now })
    )

    await withRetry(async () => {
      return db.transact(transactions)
    })
  } catch (error) {
    // Non-critical operation, log but don't throw
    console.warn('Failed to update memory access timestamps:', error)
  }
}

/**
 * Cleans up expired memories and low-confidence memories
 */
export const cleanupMemories = async (teacherId: string): Promise<{
  expiredRemoved: number
  lowConfidenceRemoved: number
}> => {
  try {
    const now = Date.now()
    const allMemories = await getMemories(teacherId, undefined, {
      includeExpired: true,
      minConfidence: 0 // Get all memories
    })

    // Find expired memories
    const expiredMemories = allMemories.filter(m =>
      m.expires_at && m.expires_at < now
    )

    // Find low confidence, old memories
    const oldDate = now - (MEMORY_CONFIG.AUTO_EXPIRE_DAYS * 24 * 60 * 60 * 1000)
    const lowConfidenceMemories = allMemories.filter(m =>
      !m.is_verified &&
      (m.confidence_score || 0) < MEMORY_CONFIG.CONFIDENCE_THRESHOLD &&
      m.created_at < oldDate &&
      (!m.expires_at || m.expires_at > now) // Not already expired
    )

    // Mark low confidence memories as expired
    const cleanupTransactions = lowConfidenceMemories.map(m =>
      db.tx.teacher_memory[m.id].update({ expires_at: now })
    )

    if (cleanupTransactions.length > 0) {
      await withRetry(async () => {
        return db.transact(cleanupTransactions)
      })
    }

    console.log(`Memory cleanup for teacher ${teacherId}: ${expiredMemories.length} expired, ${lowConfidenceMemories.length} low confidence removed`)

    return {
      expiredRemoved: expiredMemories.length,
      lowConfidenceRemoved: lowConfidenceMemories.length
    }
  } catch (error) {
    console.error('Failed to cleanup memories:', error)
    return {
      expiredRemoved: 0,
      lowConfidenceRemoved: 0
    }
  }
}

/**
 * Gets memory statistics for a teacher
 */
export const getMemoryStatistics = async (teacherId: string): Promise<{
  totalMemories: number
  memoriesByType: Record<string, number>
  averageConfidence: number
  verifiedMemories: number
  expiredMemories: number
}> => {
  try {
    const allMemories = await getMemories(teacherId, undefined, {
      includeExpired: true,
      minConfidence: 0
    })

    const now = Date.now()
    const memoriesByType: Record<string, number> = {}
    let totalConfidence = 0
    let verifiedCount = 0
    let expiredCount = 0

    allMemories.forEach(memory => {
      // Count by type
      memoriesByType[memory.memory_type] = (memoriesByType[memory.memory_type] || 0) + 1

      // Sum confidence scores
      totalConfidence += memory.confidence_score || 0

      // Count verified memories
      if (memory.is_verified) verifiedCount++

      // Count expired memories
      if (memory.expires_at && memory.expires_at < now) expiredCount++
    })

    const averageConfidence = allMemories.length > 0
      ? totalConfidence / allMemories.length
      : 0

    return {
      totalMemories: allMemories.length,
      memoriesByType,
      averageConfidence,
      verifiedMemories: verifiedCount,
      expiredMemories: expiredCount
    }
  } catch (error) {
    console.error('Failed to get memory statistics:', error)
    return {
      totalMemories: 0,
      memoriesByType: {},
      averageConfidence: 0,
      verifiedMemories: 0,
      expiredMemories: 0
    }
  }
}

// REACT HOOKS FOR MEMORY MANAGEMENT

/**
 * React hook for getting teacher memories
 */
export const useTeacherMemories = (
  teacherId?: string,
  memoryType?: 'preference' | 'pattern' | 'context' | 'skill'
) => {
  if (!teacherId) {
    return { data: null, isLoading: false, error: null }
  }

  const whereClause: any = {
    teacher_id: teacherId
  }

  if (memoryType) {
    whereClause.memory_type = memoryType
  }

  return db.useQuery({
    teacher_memory: {
      $: {
        where: whereClause,
        order: {
          updated_at: 'desc'
        },
        limit: 100
      }
    }
  })
}

// Export types
export type {
  TeacherMemory
}

export { MEMORY_CONFIG }