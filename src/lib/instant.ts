import { init, i } from '@instantdb/react'

// Get app ID from environment or fallback to demo
const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID || 'demo-app-id'

// Production environment validation and warnings
if (APP_ID === 'demo-app-id') {
  console.warn('🚨 USING DEMO InstantDB - Data will not persist! Replace NEXT_PUBLIC_INSTANTDB_APP_ID in .env.local')
}

// Performance monitoring for production
if (process.env.NODE_ENV === 'production') {
  console.info(`🔗 InstantDB connected: ${APP_ID.substring(0, 8)}...${APP_ID.substring(-4)}`)
}

// Query performance tracking
export const QUERY_PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 200,
  VERY_SLOW_QUERY_MS: 500,
  MAX_RESULTS_WARNING: 1000
} as const

// Advanced database schema for eduhu.ki with optimized indexing
const schema = i.schema({
  entities: {
    chats: i.entity({
      title: i.string(),
      created_at: i.number(),
      updated_at: i.number(),
      teacher_id: i.string().optional(), // For multi-tenant architecture
      topic_category: i.string().optional(), // Educational categorization
      message_count: i.number().optional(), // Cached count for performance
      is_archived: i.boolean().optional(), // Soft delete support
    }),
    messages: i.entity({
      chat_id: i.string(),
      content: i.string(),
      role: i.string(), // 'user' | 'assistant' | 'system'
      timestamp: i.number(),
      content_type: i.string().optional(), // 'text' | 'artifact' | 'image'
      token_count: i.number().optional(), // For usage tracking
      response_time_ms: i.number().optional(), // AI response performance
      educational_topics: i.json().optional(), // Topic tagging as JSON array
    }),
    // New entities for educational features
    artifacts: i.entity({
      chat_id: i.string(),
      message_id: i.string(),
      title: i.string(),
      content: i.string(),
      artifact_type: i.string(), // 'lesson_plan' | 'worksheet' | 'rubric'
      created_at: i.number(),
      teacher_id: i.string().optional(),
    }),
    teacher_preferences: i.entity({
      teacher_id: i.string(),
      grade_level: i.string().optional(),
      subject_areas: i.json().optional(), // JSON array for subject areas
      ai_model_preference: i.string().optional(),
      notification_settings: i.json().optional(),
      updated_at: i.number(),
    })
  },
})

// Initialize database with schema
export const db = init({
  appId: APP_ID,
  schema
})

// Enhanced TypeScript types for scalable application data
export interface Message {
  id: string
  chat_id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  content_type?: 'text' | 'artifact' | 'image'
  token_count?: number
  response_time_ms?: number
  educational_topics?: string[]
}

export interface Chat {
  id: string
  title: string
  created_at: number
  updated_at: number
  teacher_id?: string
  topic_category?: string
  message_count?: number
  is_archived?: boolean
}

export interface Artifact {
  id: string
  chat_id: string
  message_id: string
  title: string
  content: string
  artifact_type: 'lesson_plan' | 'worksheet' | 'rubric' | 'activity'
  created_at: number
  teacher_id?: string
}

export interface TeacherPreferences {
  id: string
  teacher_id: string
  grade_level?: string
  subject_areas?: string[]
  ai_model_preference?: string
  notification_settings?: Record<string, any>
  updated_at: number
}

// Query optimization types
export interface QueryOptions {
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'updated_at' | 'timestamp'
  orderDirection?: 'asc' | 'desc'
  includeArchived?: boolean
}

export interface PaginationOptions {
  page: number
  pageSize: number
  totalCount?: number
}