/**
 * API Contracts and Interface Definitions for eduhu.ki
 * Comprehensive type-safe API layer for client-server communication
 */

import type {
  ChatSession,
  Message,
  Artifact,
  TeacherMemory,
  FileUpload,
  TeacherPreferences,
  UsageAnalytics,
  Teacher
} from './instant'

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    timestamp: number
    version: string
    requestId: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

// ============================================================================
// SESSION MANAGEMENT API
// ============================================================================

export interface CreateSessionRequest {
  title?: string
  sessionType?: 'lesson_planning' | 'general' | 'assessment' | 'curriculum'
  tags?: string[]
  context?: string
}

export interface CreateSessionResponse extends ApiResponse<{
  sessionId: string
  session: ChatSession
}> {}

export interface UpdateSessionRequest {
  title?: string
  tags?: string[]
  isPinned?: boolean
  isArchived?: boolean
}

export interface UpdateSessionResponse extends ApiResponse<{
  session: ChatSession
}> {}

export interface GetSessionsRequest {
  page?: number
  pageSize?: number
  sessionType?: string
  includeArchived?: boolean
  tags?: string[]
  search?: string
  sortBy?: 'created_at' | 'updated_at' | 'last_message_at'
  sortOrder?: 'asc' | 'desc'
}

export interface GetSessionsResponse extends PaginatedResponse<ChatSession> {}

export interface SessionStatsResponse extends ApiResponse<{
  totalSessions: number
  activeSessions: number
  archivedSessions: number
  pinnedSessions: number
  sessionsByType: Record<string, number>
  recentActivity: Array<{
    sessionId: string
    title: string
    lastActivity: number
  }>
}> {}

// ============================================================================
// MESSAGE API
// ============================================================================

export interface SendMessageRequest {
  sessionId: string
  content: string
  role?: 'user' | 'assistant' | 'system'
  contentType?: 'text' | 'artifact' | 'image' | 'file_attachment'
  parentMessageId?: string
  metadata?: {
    intentClassification?: string
    educationalTopics?: string[]
    attachments?: string[] // File IDs
  }
}

export interface SendMessageResponse extends ApiResponse<{
  messageId: string
  message: Message
  suggestedActions?: Array<{
    type: 'create_artifact' | 'follow_up_question' | 'related_topic'
    label: string
    data: any
  }>
}> {}

export interface StreamingMessageChunk {
  type: 'content' | 'done' | 'error' | 'metadata'
  content?: string
  metadata?: {
    tokenCount?: number
    responseTime?: number
    educationalTopics?: string[]
    suggestedActions?: any[]
  }
  error?: string
  finishReason?: 'stop' | 'length' | 'content_filter'
}

export interface GetMessagesRequest {
  sessionId: string
  page?: number
  pageSize?: number
  includeFiles?: boolean
  parentMessageId?: string // For threaded conversations
}

export interface GetMessagesResponse extends PaginatedResponse<Message> {
  data: Array<Message & {
    files?: FileUpload[]
    children?: Message[] // For threading
  }>
}

// ============================================================================
// MEMORY SYSTEM API
// ============================================================================

export interface CreateMemoryRequest {
  key: string
  value: any
  memoryType: 'preference' | 'pattern' | 'context' | 'skill'
  confidenceScore?: number
  sessionId?: string
  expiresAt?: number
  isVerified?: boolean
}

export interface CreateMemoryResponse extends ApiResponse<{
  memoryId: string
  memory: TeacherMemory
}> {}

export interface UpdateMemoryRequest {
  value?: any
  confidenceScore?: number
  isVerified?: boolean
  expiresAt?: number
}

export interface UpdateMemoryResponse extends ApiResponse<{
  memory: TeacherMemory
}> {}

export interface GetMemoriesRequest {
  memoryType?: string
  verified?: boolean
  search?: string
  page?: number
  pageSize?: number
}

export interface GetMemoriesResponse extends PaginatedResponse<TeacherMemory> {}

export interface MemorySuggestionsResponse extends ApiResponse<{
  suggestions: Array<{
    key: string
    value: any
    memoryType: string
    confidence: number
    source: 'conversation' | 'pattern' | 'inference'
    context?: string
  }>
}> {}

// ============================================================================
// FILE MANAGEMENT API
// ============================================================================

export interface UploadFileRequest {
  file: File
  sessionId?: string
  messageId?: string
  tags?: string[]
  description?: string
}

export interface UploadFileResponse extends ApiResponse<{
  fileId: string
  file: FileUpload
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
}> {}

export interface FileProcessingStatus extends ApiResponse<{
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  extractedText?: string
  metadata?: Record<string, any>
  thumbnailUrl?: string
  errors?: string[]
}> {}

export interface GetFilesRequest {
  sessionId?: string
  fileType?: string
  tags?: string[]
  page?: number
  pageSize?: number
  includeArchived?: boolean
}

export interface GetFilesResponse extends PaginatedResponse<FileUpload> {}

// ============================================================================
// ARTIFACT SYSTEM API
// ============================================================================

export interface CreateArtifactRequest {
  sessionId: string
  messageId: string
  title: string
  content: string
  artifactType: 'lesson_plan' | 'worksheet' | 'rubric' | 'activity' | 'assessment'
  metadata?: {
    gradeLevel?: string
    subject?: string
    duration?: number
    difficulty?: string
    standards?: string[]
  }
  tags?: string[]
  isPublic?: boolean
}

export interface CreateArtifactResponse extends ApiResponse<{
  artifactId: string
  artifact: Artifact
}> {}

export interface UpdateArtifactRequest {
  title?: string
  content?: string
  status?: 'draft' | 'published' | 'archived'
  metadata?: Record<string, any>
  tags?: string[]
  isPublic?: boolean
}

export interface UpdateArtifactResponse extends ApiResponse<{
  artifact: Artifact
  version: number
}> {}

export interface GetArtifactsRequest {
  sessionId?: string
  artifactType?: string
  status?: 'draft' | 'published' | 'archived'
  tags?: string[]
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'created_at' | 'updated_at' | 'usage_count'
  sortOrder?: 'asc' | 'desc'
}

export interface GetArtifactsResponse extends PaginatedResponse<Artifact> {}

export interface DuplicateArtifactRequest {
  newTitle?: string
  newSessionId?: string
}

export interface DuplicateArtifactResponse extends ApiResponse<{
  artifactId: string
  artifact: Artifact
}> {}

// ============================================================================
// PREFERENCES API
// ============================================================================

export interface UpdatePreferencesRequest {
  gradeLevels?: string[]
  subjects?: string[]
  teachingStyle?: 'structured' | 'flexible' | 'collaborative'
  aiModelPreference?: string
  responseLength?: 'brief' | 'detailed' | 'comprehensive'
  notificationSettings?: Record<string, any>
  privacySettings?: Record<string, any>
  language?: string
  timezone?: string
  schoolType?: 'public' | 'private' | 'charter' | 'homeschool'
  yearsExperience?: number
}

export interface UpdatePreferencesResponse extends ApiResponse<{
  preferences: TeacherPreferences
}> {}

export interface GetPreferencesResponse extends ApiResponse<{
  preferences: TeacherPreferences
}> {}

// ============================================================================
// ANALYTICS API
// ============================================================================

export interface AnalyticsEventRequest {
  eventType: string
  sessionId?: string
  metadata?: Record<string, any>
  duration?: number
  featureUsed?: string
}

export interface AnalyticsEventResponse extends ApiResponse<{
  eventId: string
  tracked: boolean
}> {}

export interface GetAnalyticsRequest {
  dateRange: {
    start: number
    end: number
  }
  eventTypes?: string[]
  groupBy?: 'day' | 'week' | 'month'
  metrics?: string[]
}

export interface GetAnalyticsResponse extends ApiResponse<{
  summary: {
    totalSessions: number
    totalMessages: number
    totalArtifacts: number
    averageSessionDuration: number
    mostUsedFeatures: Array<{ feature: string; count: number }>
  }
  timeline: Array<{
    date: string
    sessions: number
    messages: number
    artifacts: number
  }>
  breakdown: {
    bySessionType: Record<string, number>
    bySubject: Record<string, number>
    byGradeLevel: Record<string, number>
  }
}> {}

// ============================================================================
// SEARCH API
// ============================================================================

export interface SearchRequest {
  query: string
  filters?: {
    type?: 'sessions' | 'messages' | 'artifacts' | 'all'
    sessionId?: string
    dateRange?: { start: number; end: number }
    tags?: string[]
    artifactType?: string
  }
  page?: number
  pageSize?: number
  sortBy?: 'relevance' | 'date' | 'usage'
  sortOrder?: 'asc' | 'desc'
}

export interface SearchResponse extends PaginatedResponse<{
  type: 'session' | 'message' | 'artifact'
  id: string
  title: string
  content: string
  snippet: string
  relevanceScore: number
  metadata: Record<string, any>
  highlightedFields: Record<string, string>
}> {}

export interface SearchSuggestionsResponse extends ApiResponse<{
  suggestions: Array<{
    text: string
    type: 'recent' | 'popular' | 'contextual'
    count?: number
  }>
}> {}

// ============================================================================
// COLLABORATION API (Future)
// ============================================================================

export interface ShareResourceRequest {
  artifactId: string
  title?: string
  description?: string
  tags?: string[]
  gradeLevels?: string[]
  subjects?: string[]
  isPublic?: boolean
}

export interface ShareResourceResponse extends ApiResponse<{
  resourceId: string
  shareUrl: string
}> {}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ValidationError {
  field: string
  code: 'required' | 'invalid' | 'too_long' | 'too_short' | 'format_error'
  message: string
  value?: any
}

export interface ApiError {
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'RATE_LIMIT_EXCEEDED'
    | 'VALIDATION_ERROR'
    | 'INTERNAL_ERROR'
    | 'DATABASE_ERROR'
    | 'AI_SERVICE_ERROR'
    | 'FILE_PROCESSING_ERROR'
  message: string
  details?: any
  validationErrors?: ValidationError[]
  retryAfter?: number // For rate limiting
}

// ============================================================================
// WEBHOOK TYPES (for real-time updates)
// ============================================================================

export interface WebhookEvent {
  type:
    | 'session.created'
    | 'session.updated'
    | 'message.created'
    | 'artifact.created'
    | 'artifact.updated'
    | 'file.processed'
    | 'memory.created'
  data: any
  timestamp: number
  sessionId?: string
  teacherId: string
}

// ============================================================================
// EXPORT UTILITIES
// ============================================================================

// Type guards for runtime type checking
export const isApiResponse = <T>(obj: any): obj is ApiResponse<T> => {
  return obj && typeof obj === 'object' && typeof obj.success === 'boolean'
}

export const isPaginatedResponse = <T>(obj: any): obj is PaginatedResponse<T> => {
  return isApiResponse(obj) && obj.pagination && typeof obj.pagination === 'object'
}

export const isApiError = (obj: any): obj is ApiError => {
  return obj && typeof obj === 'object' && typeof obj.code === 'string' && typeof obj.message === 'string'
}

// API client configuration
export interface ApiClientConfig {
  baseUrl: string
  apiKey?: string
  timeout: number
  retryAttempts: number
  retryDelay: number
  enableLogging: boolean
}

export const DEFAULT_API_CONFIG: ApiClientConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableLogging: process.env.NODE_ENV === 'development'
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

// Request context for authentication and tracing
export interface RequestContext {
  teacherId: string
  sessionId?: string
  requestId: string
  userAgent?: string
  ipAddress?: string
  timestamp: number
}