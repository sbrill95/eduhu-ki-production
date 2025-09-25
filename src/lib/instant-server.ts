// Server-side InstantDB client for Edge Runtime compatibility
// This uses InstantDB Core (non-React) for server-side operations
import { init, id } from '@instantdb/core'

// Get app ID from environment or fallback to demo
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || 'demo-app-id'

// Production environment validation
if (APP_ID === 'demo-app-id') {
  console.warn('🚨 USING DEMO InstantDB - Data will not persist! Replace NEXT_PUBLIC_INSTANTDB_APP_ID in .env.local')
}

// Enhanced production monitoring and validation
if (process.env.NODE_ENV === 'production') {
  console.info(`🔗 InstantDB Server connected: ${APP_ID.substring(0, 8)}...${APP_ID.slice(-4)}`)
}

// Enhanced performance monitoring configuration
export const QUERY_PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 200,
  VERY_SLOW_QUERY_MS: 500,
  MAX_RESULTS_WARNING: 1000,
  MEMORY_CACHE_TTL_MS: 300000, // 5 minutes
  SESSION_CACHE_TTL_MS: 600000, // 10 minutes
  FILE_PROCESSING_TIMEOUT_MS: 30000, // 30 seconds
  BATCH_OPERATION_SIZE: 100,
  MAX_CONCURRENT_REQUESTS: 10
} as const

// Memory management configuration
export const MEMORY_CONFIG = {
  MAX_MEMORIES_PER_TEACHER: 1000,
  CONFIDENCE_THRESHOLD: 0.7,
  AUTO_EXPIRE_DAYS: 90,
  VERIFICATION_REQUIRED_TYPES: ['preference', 'skill'],
  CLEANUP_INTERVAL_HOURS: 24
} as const

// File upload configuration
export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  ALLOWED_TYPES: ['image/*', 'application/pdf', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  THUMBNAIL_SIZE: { width: 200, height: 200 },
  PROCESSING_QUEUE_SIZE: 50
} as const

// Enhanced scalable database schema for eduhu.ki with comprehensive features
// Using the same schema as the client-side version for consistency
const schema = {
  entities: {
    // User management and authentication
    teachers: {
      email: { type: 'string' },
      display_name: { type: 'string', optional: true },
      avatar_url: { type: 'string', optional: true },
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      last_active: { type: 'number', optional: true },
      subscription_tier: { type: 'string', optional: true }, // 'free' | 'premium' | 'school'
      school_id: { type: 'string', optional: true }, // For institutional accounts
      onboarding_completed: { type: 'boolean', optional: true },
    },

    // Chat session management with unique sessions
    chat_sessions: {
      teacher_id: { type: 'string' },
      title: { type: 'string' },
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      last_message_at: { type: 'number', optional: true },
      message_count: { type: 'number', optional: true }, // Cached for performance
      topic_category: { type: 'string', optional: true }, // Educational categorization
      session_type: { type: 'string', optional: true }, // 'lesson_planning' | 'general' | 'assessment'
      is_archived: { type: 'boolean', optional: true },
      is_pinned: { type: 'boolean', optional: true },
      tags: { type: 'json', optional: true }, // Array of tags for organization
      context_summary: { type: 'string', optional: true }, // AI-generated summary for context
    },

    // Enhanced message system with rich metadata
    messages: {
      session_id: { type: 'string' }, // Links to chat_sessions
      teacher_id: { type: 'string' }, // For direct teacher queries and security
      content: { type: 'string' },
      role: { type: 'string' }, // 'user' | 'assistant' | 'system'
      timestamp: { type: 'number' },
      content_type: { type: 'string', optional: true }, // 'text' | 'artifact' | 'image' | 'file_attachment'
      token_count: { type: 'number', optional: true },
      response_time_ms: { type: 'number', optional: true },
      educational_topics: { type: 'json', optional: true }, // Topic tagging as JSON array
      intent_classification: { type: 'string', optional: true }, // AI-detected intent
      quality_score: { type: 'number', optional: true }, // Message quality for analytics
      parent_message_id: { type: 'string', optional: true }, // For threading/branching
      edit_history: { type: 'json', optional: true }, // Track message edits
    },

    // Enhanced artifacts with versioning and collaboration
    artifacts: {
      session_id: { type: 'string' },
      message_id: { type: 'string' },
      teacher_id: { type: 'string' },
      title: { type: 'string' },
      content: { type: 'string' },
      artifact_type: { type: 'string' }, // 'lesson_plan' | 'worksheet' | 'rubric' | 'activity' | 'assessment'
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      version: { type: 'number', optional: true }, // Version tracking
      status: { type: 'string', optional: true }, // 'draft' | 'published' | 'archived'
      metadata: { type: 'json', optional: true }, // Flexible metadata storage
      grade_level: { type: 'string', optional: true },
      subject: { type: 'string', optional: true },
      duration_minutes: { type: 'number', optional: true },
      difficulty_level: { type: 'string', optional: true },
      tags: { type: 'json', optional: true },
      is_public: { type: 'boolean', optional: true }, // For community sharing
      usage_count: { type: 'number', optional: true }, // Track popularity
    },

    // Sophisticated teacher memory and context system
    teacher_memory: {
      teacher_id: { type: 'string' },
      memory_type: { type: 'string' }, // 'preference' | 'pattern' | 'context' | 'skill'
      key: { type: 'string' }, // Memory key (e.g., 'preferred_teaching_style')
      value: { type: 'json' }, // Flexible JSON storage for any data structure
      confidence_score: { type: 'number', optional: true }, // How confident we are in this memory
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      last_accessed: { type: 'number', optional: true },
      source_session_id: { type: 'string', optional: true }, // Where this memory originated
      expires_at: { type: 'number', optional: true }, // For temporary memories
      is_verified: { type: 'boolean', optional: true }, // Teacher-confirmed memories
    },

    // File storage and management system
    file_uploads: {
      teacher_id: { type: 'string' },
      session_id: { type: 'string', optional: true }, // Optional session linkage
      message_id: { type: 'string', optional: true }, // Optional message linkage
      filename: { type: 'string' },
      original_filename: { type: 'string' },
      file_type: { type: 'string' }, // MIME type
      file_size: { type: 'number' }, // Size in bytes
      file_url: { type: 'string' }, // URL to file storage (S3, CloudFlare, etc.)
      thumbnail_url: { type: 'string', optional: true }, // For images/PDFs
      created_at: { type: 'number' },
      processed_at: { type: 'number', optional: true }, // When AI processing completed
      processing_status: { type: 'string', optional: true }, // 'pending' | 'completed' | 'failed'
      extracted_text: { type: 'string', optional: true }, // OCR or PDF text extraction
      metadata: { type: 'json', optional: true }, // File-specific metadata
      tags: { type: 'json', optional: true },
      is_archived: { type: 'boolean', optional: true },
    },

    // Enhanced teacher preferences with detailed context
    teacher_preferences: {
      teacher_id: { type: 'string' },
      grade_levels: { type: 'json', optional: true }, // Array of grade levels
      subjects: { type: 'json', optional: true }, // Array of subject areas
      teaching_style: { type: 'string', optional: true }, // 'structured' | 'flexible' | 'collaborative'
      ai_model_preference: { type: 'string', optional: true },
      response_length: { type: 'string', optional: true }, // 'brief' | 'detailed' | 'comprehensive'
      notification_settings: { type: 'json', optional: true },
      privacy_settings: { type: 'json', optional: true },
      language: { type: 'string', optional: true },
      timezone: { type: 'string', optional: true },
      school_type: { type: 'string', optional: true }, // 'public' | 'private' | 'charter' | 'homeschool'
      years_experience: { type: 'number', optional: true },
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
    },

    // Analytics and usage tracking
    usage_analytics: {
      teacher_id: { type: 'string' },
      event_type: { type: 'string' }, // 'session_start' | 'message_sent' | 'artifact_created'
      timestamp: { type: 'number' },
      session_id: { type: 'string', optional: true },
      metadata: { type: 'json', optional: true }, // Event-specific data
      duration_ms: { type: 'number', optional: true }, // For session/interaction duration
      feature_used: { type: 'string', optional: true }, // Specific feature interaction
    },

    // Future LangGraph agent state management
    agent_states: {
      teacher_id: { type: 'string' },
      session_id: { type: 'string' },
      agent_type: { type: 'string' }, // 'lesson_planner' | 'assessment_creator' | 'curriculum_advisor'
      state_data: { type: 'json' }, // Agent-specific state information
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      is_active: { type: 'boolean', optional: true },
      checkpoint_id: { type: 'string', optional: true }, // For state recovery
    },

    // Community and collaboration features (future)
    shared_resources: {
      creator_id: { type: 'string' }, // Teacher who created/shared
      artifact_id: { type: 'string', optional: true },
      title: { type: 'string' },
      description: { type: 'string', optional: true },
      resource_type: { type: 'string' }, // 'lesson_plan' | 'activity' | 'template'
      tags: { type: 'json', optional: true },
      grade_levels: { type: 'json', optional: true },
      subjects: { type: 'json', optional: true },
      created_at: { type: 'number' },
      updated_at: { type: 'number' },
      download_count: { type: 'number', optional: true },
      rating: { type: 'number', optional: true }, // Average rating
      is_featured: { type: 'boolean', optional: true },
    },
  },
} as const

// Initialize server-side database client
export const dbServer = init({
  appId: APP_ID,
  // Note: InstantDB Core doesn't use schema in the same way as React client
  // We'll handle schema validation in our helper functions
})

// Generate unique IDs compatible with InstantDB
export const generateId = () => id()

// Enhanced TypeScript types for comprehensive data architecture
export interface Teacher {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  created_at: number
  updated_at: number
  last_active?: number
  subscription_tier?: 'free' | 'premium' | 'school'
  school_id?: string
  onboarding_completed?: boolean
}

export interface ChatSession {
  id: string
  teacher_id: string
  title: string
  created_at: number
  updated_at: number
  last_message_at?: number
  message_count?: number
  topic_category?: string
  session_type?: 'lesson_planning' | 'general' | 'assessment' | 'curriculum'
  is_archived?: boolean
  is_pinned?: boolean
  tags?: string[]
  context_summary?: string
}

export interface Message {
  id: string
  session_id: string
  teacher_id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  content_type?: 'text' | 'artifact' | 'image' | 'file_attachment'
  token_count?: number
  response_time_ms?: number
  educational_topics?: string[]
  intent_classification?: string
  quality_score?: number
  parent_message_id?: string
  edit_history?: Array<{ content: string; timestamp: number }>
}

export interface FileUpload {
  id: string
  teacher_id: string
  session_id?: string
  message_id?: string
  filename: string
  original_filename: string
  file_type: string
  file_size: number
  file_url: string
  thumbnail_url?: string
  created_at: number
  processed_at?: number
  processing_status?: 'pending' | 'completed' | 'failed'
  extracted_text?: string
  metadata?: Record<string, any>
  tags?: string[]
  is_archived?: boolean
}

export interface TeacherMemory {
  id: string
  teacher_id: string
  memory_type: 'preference' | 'pattern' | 'context' | 'skill'
  key: string
  value: any // JSON-serializable data
  confidence_score?: number
  created_at: number
  updated_at: number
  last_accessed?: number
  source_session_id?: string
  expires_at?: number
  is_verified?: boolean
}

// Server-side database operations
export class InstantDBServerClient {
  private db = dbServer

  // Connection recovery with retry logic
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt === maxRetries) {
          throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`)
        }

        // Exponential backoff
        const backoffDelay = delay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
      }
    }

    throw lastError!
  }

  // Query operations
  async query(queryConfig: any): Promise<any> {
    return this.withRetry(async () => {
      return await this.db.queryOnce(queryConfig)
    })
  }

  // Transaction operations
  async transact(transactions: any[]): Promise<any> {
    return this.withRetry(async () => {
      return await this.db.transact(transactions)
    })
  }

  // Helper method to create transaction objects (InstantDB Core syntax)
  // Based on InstantDB Core documentation, transactions use db.tx[entity][id].update/delete pattern
  createTransaction(entity: string, id: string, data: any) {
    return this.db.tx[entity][id].update(data)
  }

  createDeleteTransaction(entity: string, id: string) {
    return this.db.tx[entity][id].delete()
  }

  // Get chat session
  async getChatSession(sessionId: string): Promise<ChatSession | null> {
    const result = await this.query({
      chat_sessions: {
        $: {
          where: {
            id: sessionId
          }
        }
      }
    })

    return result.chat_sessions?.[0] || null
  }

  // Validate session access
  async validateSessionAccess(sessionId: string, teacherId: string): Promise<boolean> {
    try {
      const session = await this.getChatSession(sessionId)
      return session?.teacher_id === teacherId
    } catch (error) {
      console.error('Failed to validate session access:', error)
      return false
    }
  }

  // Add message to session
  async addMessageToSession(
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
  ): Promise<string> {
    const messageId = generateId()
    const timestamp = Date.now()

    // Get session to verify it exists and get teacher_id
    const session = await this.getChatSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const teacherId = metadata?.teacherId || session.teacher_id

    // Add message to session
    await this.transact([
      this.createTransaction('messages', messageId, {
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

    // Update session metadata
    await this.transact([
      this.createTransaction('chat_sessions', sessionId, {
        updated_at: timestamp,
        last_message_at: timestamp,
        message_count: (session.message_count || 0) + 1
      })
    ])

    console.log(`Added message ${messageId} to session ${sessionId}`)
    return messageId
  }

  // Query file uploads
  async queryFileUploads(query: any): Promise<any> {
    return this.query({
      file_uploads: query
    })
  }
}

// Export singleton instance
export const dbServerClient = new InstantDBServerClient()

// Helper functions for server-side operations
export const serverDb = {
  query: (config: any) => dbServerClient.query(config),
  transact: (transactions: any[]) => dbServerClient.transact(transactions),
  tx: {
    chat_sessions: (id: string) => ({
      update: (data: any) => dbServerClient.createTransaction('chat_sessions', id, data)
    }),
    messages: (id: string) => ({
      update: (data: any) => dbServerClient.createTransaction('messages', id, data)
    }),
    file_uploads: (id: string) => ({
      update: (data: any) => dbServerClient.createTransaction('file_uploads', id, data)
    }),
    teacher_memory: (id: string) => ({
      update: (data: any) => dbServerClient.createTransaction('teacher_memory', id, data)
    })
  },
  getChatSession: (sessionId: string) => dbServerClient.getChatSession(sessionId),
  validateSessionAccess: (sessionId: string, teacherId: string) =>
    dbServerClient.validateSessionAccess(sessionId, teacherId),
  addMessageToSession: (
    sessionId: string,
    content: string,
    role: 'user' | 'assistant' | 'system',
    metadata?: any
  ) => dbServerClient.addMessageToSession(sessionId, content, role, metadata),
  queryFileUploads: (query: any) => dbServerClient.queryFileUploads(query)
}

// Database health check
export const testServerDatabaseConnection = async (): Promise<boolean> => {
  try {
    // Test with a lightweight query
    await dbServerClient.query({})
    return true
  } catch (error) {
    console.error('Server database connection test failed:', error)
    return false
  }
}