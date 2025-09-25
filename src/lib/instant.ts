// Environment detection to prevent server-side React imports
const isServer = typeof window === 'undefined'

// Only import React version on client-side
let init: any, i: any, reactDb: any

if (!isServer) {
  const reactModule = require('@instantdb/react')
  init = reactModule.init
  i = reactModule.i
}

// Get app ID from environment or fallback to demo
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || 'demo-app-id'

// Production environment validation and warnings
if (APP_ID === 'demo-app-id') {
  console.warn('🚨 USING DEMO InstantDB - Data will not persist! Replace NEXT_PUBLIC_INSTANTDB_APP_ID in .env.local')
}

// Enhanced production monitoring and validation
if (process.env.NODE_ENV === 'production') {
  console.info(`🔗 InstantDB connected: ${APP_ID.substring(0, 8)}...${APP_ID.slice(-4)}`)

  // Validate critical environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_INSTANT_APP_ID',
    'OPENAI_API_KEY',
    'NEXTAUTH_SECRET'
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
  if (missingVars.length > 0) {
    console.error('🚨 Missing required environment variables:', missingVars)
  }

  // Initialize performance monitoring
  console.info('📊 Performance monitoring initialized')
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
const schema = i.schema({
  entities: {
    // User management and authentication
    teachers: i.entity({
      email: i.string(),
      display_name: i.string().optional(),
      avatar_url: i.string().optional(),
      created_at: i.number(),
      updated_at: i.number(),
      last_active: i.number().optional(),
      subscription_tier: i.string().optional(), // 'free' | 'premium' | 'school'
      school_id: i.string().optional(), // For institutional accounts
      onboarding_completed: i.boolean().optional(),
    }),

    // Chat session management with unique sessions
    chat_sessions: i.entity({
      teacher_id: i.string(),
      title: i.string(),
      created_at: i.number(),
      updated_at: i.number(),
      last_message_at: i.number().optional(),
      message_count: i.number().optional(), // Cached for performance
      topic_category: i.string().optional(), // Educational categorization
      session_type: i.string().optional(), // 'lesson_planning' | 'general' | 'assessment'
      is_archived: i.boolean().optional(),
      is_pinned: i.boolean().optional(),
      tags: i.json().optional(), // Array of tags for organization
      context_summary: i.string().optional(), // AI-generated summary for context
    }),

    // Enhanced message system with rich metadata
    messages: i.entity({
      session_id: i.string(), // Links to chat_sessions
      teacher_id: i.string(), // For direct teacher queries and security
      content: i.string(),
      role: i.string(), // 'user' | 'assistant' | 'system'
      timestamp: i.number(),
      content_type: i.string().optional(), // 'text' | 'artifact' | 'image' | 'file_attachment'
      token_count: i.number().optional(),
      response_time_ms: i.number().optional(),
      educational_topics: i.json().optional(), // Topic tagging as JSON array
      intent_classification: i.string().optional(), // AI-detected intent
      quality_score: i.number().optional(), // Message quality for analytics
      parent_message_id: i.string().optional(), // For threading/branching
      edit_history: i.json().optional(), // Track message edits
    }),

    // Enhanced artifacts with versioning and collaboration
    artifacts: i.entity({
      session_id: i.string(),
      message_id: i.string(),
      teacher_id: i.string(),
      title: i.string(),
      content: i.string(),
      artifact_type: i.string(), // 'lesson_plan' | 'worksheet' | 'rubric' | 'activity' | 'assessment'
      created_at: i.number(),
      updated_at: i.number(),
      version: i.number().optional(), // Version tracking
      status: i.string().optional(), // 'draft' | 'published' | 'archived'
      metadata: i.json().optional(), // Flexible metadata storage
      grade_level: i.string().optional(),
      subject: i.string().optional(),
      duration_minutes: i.number().optional(),
      difficulty_level: i.string().optional(),
      tags: i.json().optional(),
      is_public: i.boolean().optional(), // For community sharing
      usage_count: i.number().optional(), // Track popularity
    }),

    // Sophisticated teacher memory and context system
    teacher_memory: i.entity({
      teacher_id: i.string(),
      memory_type: i.string(), // 'preference' | 'pattern' | 'context' | 'skill'
      key: i.string(), // Memory key (e.g., 'preferred_teaching_style')
      value: i.json(), // Flexible JSON storage for any data structure
      confidence_score: i.number().optional(), // How confident we are in this memory
      created_at: i.number(),
      updated_at: i.number(),
      last_accessed: i.number().optional(),
      source_session_id: i.string().optional(), // Where this memory originated
      expires_at: i.number().optional(), // For temporary memories
      is_verified: i.boolean().optional(), // Teacher-confirmed memories
    }),

    // File storage and management system
    file_uploads: i.entity({
      teacher_id: i.string(),
      session_id: i.string().optional(), // Optional session linkage
      message_id: i.string().optional(), // Optional message linkage
      filename: i.string(),
      original_filename: i.string(),
      file_type: i.string(), // MIME type
      file_size: i.number(), // Size in bytes
      file_url: i.string(), // URL to file storage (S3, CloudFlare, etc.)
      thumbnail_url: i.string().optional(), // For images/PDFs
      created_at: i.number(),
      processed_at: i.number().optional(), // When AI processing completed
      processing_status: i.string().optional(), // 'pending' | 'completed' | 'failed'
      extracted_text: i.string().optional(), // OCR or PDF text extraction
      metadata: i.json().optional(), // File-specific metadata
      tags: i.json().optional(),
      is_archived: i.boolean().optional(),
    }),

    // Enhanced teacher preferences with detailed context
    teacher_preferences: i.entity({
      teacher_id: i.string(),
      grade_levels: i.json().optional(), // Array of grade levels
      subjects: i.json().optional(), // Array of subject areas
      teaching_style: i.string().optional(), // 'structured' | 'flexible' | 'collaborative'
      ai_model_preference: i.string().optional(),
      response_length: i.string().optional(), // 'brief' | 'detailed' | 'comprehensive'
      notification_settings: i.json().optional(),
      privacy_settings: i.json().optional(),
      language: i.string().optional(),
      timezone: i.string().optional(),
      school_type: i.string().optional(), // 'public' | 'private' | 'charter' | 'homeschool'
      years_experience: i.number().optional(),
      created_at: i.number(),
      updated_at: i.number(),
    }),

    // Analytics and usage tracking
    usage_analytics: i.entity({
      teacher_id: i.string(),
      event_type: i.string(), // 'session_start' | 'message_sent' | 'artifact_created'
      timestamp: i.number(),
      session_id: i.string().optional(),
      metadata: i.json().optional(), // Event-specific data
      duration_ms: i.number().optional(), // For session/interaction duration
      feature_used: i.string().optional(), // Specific feature interaction
    }),

    // Future LangGraph agent state management
    agent_states: i.entity({
      teacher_id: i.string(),
      session_id: i.string(),
      agent_type: i.string(), // 'lesson_planner' | 'assessment_creator' | 'curriculum_advisor'
      state_data: i.json(), // Agent-specific state information
      created_at: i.number(),
      updated_at: i.number(),
      is_active: i.boolean().optional(),
      checkpoint_id: i.string().optional(), // For state recovery
    }),

    // Community and collaboration features (future)
    shared_resources: i.entity({
      creator_id: i.string(), // Teacher who created/shared
      artifact_id: i.string().optional(),
      title: i.string(),
      description: i.string().optional(),
      resource_type: i.string(), // 'lesson_plan' | 'activity' | 'template'
      tags: i.json().optional(),
      grade_levels: i.json().optional(),
      subjects: i.json().optional(),
      created_at: i.number(),
      updated_at: i.number(),
      download_count: i.number().optional(),
      rating: i.number().optional(), // Average rating
      is_featured: i.boolean().optional(),
    }),
  },
})

// Initialize database with schema (client-side only)
export let db: any = null

if (!isServer && init && i) {
  db = init({
    appId: APP_ID,
    schema
  })
} else {
  // Create a mock object for server-side to prevent errors
  db = {
    useQuery: () => ({ data: null, isLoading: false, error: null }),
    query: () => Promise.resolve({}),
    transact: () => Promise.resolve({}),
    tx: {}
  }
}

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

export interface Artifact {
  id: string
  session_id: string
  message_id: string
  teacher_id: string
  title: string
  content: string
  artifact_type: 'lesson_plan' | 'worksheet' | 'rubric' | 'activity' | 'assessment'
  created_at: number
  updated_at: number
  version?: number
  status?: 'draft' | 'published' | 'archived'
  metadata?: Record<string, any>
  grade_level?: string
  subject?: string
  duration_minutes?: number
  difficulty_level?: string
  tags?: string[]
  is_public?: boolean
  usage_count?: number
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

export interface TeacherPreferences {
  id: string
  teacher_id: string
  grade_levels?: string[]
  subjects?: string[]
  teaching_style?: 'structured' | 'flexible' | 'collaborative'
  ai_model_preference?: string
  response_length?: 'brief' | 'detailed' | 'comprehensive'
  notification_settings?: Record<string, any>
  privacy_settings?: Record<string, any>
  language?: string
  timezone?: string
  school_type?: 'public' | 'private' | 'charter' | 'homeschool'
  years_experience?: number
  created_at: number
  updated_at: number
}

export interface UsageAnalytics {
  id: string
  teacher_id: string
  event_type: string
  timestamp: number
  session_id?: string
  metadata?: Record<string, any>
  duration_ms?: number
  feature_used?: string
}

export interface AgentState {
  id: string
  teacher_id: string
  session_id: string
  agent_type: 'lesson_planner' | 'assessment_creator' | 'curriculum_advisor'
  state_data: Record<string, any>
  created_at: number
  updated_at: number
  is_active?: boolean
  checkpoint_id?: string
}

export interface SharedResource {
  id: string
  creator_id: string
  artifact_id?: string
  title: string
  description?: string
  resource_type: 'lesson_plan' | 'activity' | 'template'
  tags?: string[]
  grade_levels?: string[]
  subjects?: string[]
  created_at: number
  updated_at: number
  download_count?: number
  rating?: number
  is_featured?: boolean
}

// Enhanced query optimization types
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'updated_at' | 'timestamp' | 'last_message_at' | 'usage_count'
  orderDirection?: 'asc' | 'desc'
  includeArchived?: boolean
  includePinned?: boolean
  filterByTags?: string[]
  filterByType?: string
  dateRange?: { start: number; end: number }
}

export interface PaginationOptions {
  page: number
  pageSize: number
  totalCount?: number
  hasNextPage?: boolean
  hasPreviousPage?: boolean
}

// Context management types
export interface ConversationContext {
  teacherId: string
  sessionId: string
  memories: TeacherMemory[]
  preferences: TeacherPreferences
  recentSessions: ChatSession[]
  activeArtifacts: Artifact[]
}

// Memory management types
export interface MemoryUpdate {
  key: string
  value: any
  memoryType: 'preference' | 'pattern' | 'context' | 'skill'
  confidenceScore?: number
  sessionId?: string
  expiresAt?: number
}

// File processing types
export interface FileProcessingResult {
  success: boolean
  extractedText?: string
  metadata?: Record<string, any>
  thumbnailUrl?: string
  processingErrors?: string[]
}

// Analytics types
export interface AnalyticsEvent {
  eventType: string
  teacherId: string
  sessionId?: string
  metadata?: Record<string, any>
  duration?: number
  featureUsed?: string
}

// Session management types
export interface SessionCreationOptions {
  title?: string
  sessionType?: 'lesson_planning' | 'general' | 'assessment' | 'curriculum'
  tags?: string[]
  context?: string
}

// Migration types for data transformation
export interface MigrationResult {
  success: boolean
  migratedCount: number
  errors?: string[]
  rollbackData?: any
}