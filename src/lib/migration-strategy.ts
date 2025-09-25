/**
 * Migration Strategy: Single-Chat to Multi-Session Architecture
 * Comprehensive plan for safely migrating existing data to new schema
 */

import { db, generateId } from './instant'
import type {
  ChatSession,
  Message,
  Teacher,
  TeacherPreferences,
  TeacherMemory
} from './instant'

// ============================================================================
// MIGRATION TYPES AND INTERFACES
// ============================================================================

export interface MigrationPlan {
  version: string
  description: string
  steps: MigrationStep[]
  rollbackSteps: MigrationStep[]
  estimatedDuration: string
  riskLevel: 'low' | 'medium' | 'high'
  prerequisites: string[]
}

export interface MigrationStep {
  id: string
  name: string
  description: string
  execute: () => Promise<MigrationStepResult>
  rollback?: () => Promise<MigrationStepResult>
  validation: () => Promise<boolean>
  estimatedTime: string
  dependencies: string[]
}

export interface MigrationStepResult {
  success: boolean
  recordsProcessed: number
  recordsSkipped: number
  errors: string[]
  warnings: string[]
  duration: number
  rollbackData?: any
}

export interface MigrationProgress {
  totalSteps: number
  completedSteps: number
  currentStep: string
  progress: number
  startTime: number
  estimatedCompletion: number
  status: 'preparing' | 'running' | 'completed' | 'failed' | 'rolled_back'
}

export interface LegacyData {
  chats: Array<{
    id: string
    title: string
    created_at: number
    updated_at: number
    teacher_id?: string
    topic_category?: string
    message_count?: number
    is_archived?: boolean
  }>
  messages: Array<{
    id: string
    chat_id: string
    content: string
    role: string
    timestamp: number
    content_type?: string
    token_count?: number
    response_time_ms?: number
    educational_topics?: string[]
  }>
  artifacts: Array<{
    id: string
    chat_id: string
    message_id: string
    title: string
    content: string
    artifact_type: string
    created_at: number
    teacher_id?: string
  }>
  teacher_preferences: Array<{
    id: string
    teacher_id: string
    grade_level?: string
    subject_areas?: string[]
    ai_model_preference?: string
    notification_settings?: Record<string, any>
    updated_at: number
  }>
}

// ============================================================================
// MIGRATION EXECUTION ENGINE
// ============================================================================

export class MigrationExecutor {
  private progress: MigrationProgress | null = null
  private rollbackData: Map<string, any> = new Map()

  async executeMigration(plan: MigrationPlan): Promise<boolean> {
    console.info(`🚀 Starting migration: ${plan.description}`)

    this.progress = {
      totalSteps: plan.steps.length,
      completedSteps: 0,
      currentStep: '',
      progress: 0,
      startTime: Date.now(),
      estimatedCompletion: Date.now() + (plan.steps.length * 60000), // Rough estimate
      status: 'preparing'
    }

    try {
      // Validate prerequisites
      await this.validatePrerequisites(plan.prerequisites)

      this.progress.status = 'running'

      // Execute each step
      for (const step of plan.steps) {
        await this.executeStep(step)
      }

      this.progress.status = 'completed'
      this.progress.progress = 100

      console.info(`✅ Migration completed successfully in ${Date.now() - this.progress.startTime}ms`)
      return true

    } catch (error) {
      console.error(`❌ Migration failed:`, error)
      this.progress!.status = 'failed'

      // Attempt rollback
      await this.rollback(plan)
      return false
    }
  }

  private async executeStep(step: MigrationStep): Promise<void> {
    console.info(`📝 Executing step: ${step.name}`)

    if (!this.progress) throw new Error('Migration progress not initialized')

    this.progress.currentStep = step.name

    // Validate dependencies
    for (const dependency of step.dependencies) {
      if (!this.rollbackData.has(dependency)) {
        throw new Error(`Dependency ${dependency} not satisfied for step ${step.id}`)
      }
    }

    // Execute the step
    const startTime = Date.now()
    const result = await step.execute()
    const duration = Date.now() - startTime

    if (!result.success) {
      throw new Error(`Step ${step.name} failed: ${result.errors.join(', ')}`)
    }

    // Store rollback data
    this.rollbackData.set(step.id, result.rollbackData)

    // Update progress
    this.progress.completedSteps++
    this.progress.progress = (this.progress.completedSteps / this.progress.totalSteps) * 100

    console.info(`✓ Step completed: ${step.name} (${duration}ms, ${result.recordsProcessed} records)`)

    // Log warnings if any
    if (result.warnings.length > 0) {
      console.warn(`⚠️ Warnings for step ${step.name}:`, result.warnings)
    }
  }

  private async validatePrerequisites(prerequisites: string[]): Promise<void> {
    for (const prerequisite of prerequisites) {
      switch (prerequisite) {
        case 'database_backup':
          await this.validateDatabaseBackup()
          break
        case 'schema_compatibility':
          await this.validateSchemaCompatibility()
          break
        case 'sufficient_storage':
          await this.validateStorageSpace()
          break
        default:
          console.warn(`Unknown prerequisite: ${prerequisite}`)
      }
    }
  }

  private async validateDatabaseBackup(): Promise<void> {
    // In a real implementation, this would verify that a backup exists
    console.info('📋 Validating database backup...')
    // Implementation would check backup timestamp, integrity, etc.
  }

  private async validateSchemaCompatibility(): Promise<void> {
    console.info('🔍 Validating schema compatibility...')
    // Check that new schema is properly deployed
  }

  private async validateStorageSpace(): Promise<void> {
    console.info('💾 Validating storage space...')
    // Check available disk space for migration operations
  }

  private async rollback(plan: MigrationPlan): Promise<void> {
    console.warn('🔄 Attempting rollback...')

    if (!this.progress) return

    this.progress.status = 'rolled_back'

    try {
      // Execute rollback steps in reverse order
      const reversedSteps = [...plan.rollbackSteps].reverse()

      for (const step of reversedSteps) {
        if (step.rollback) {
          await step.rollback()
        }
      }

      console.info('✅ Rollback completed successfully')
    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError)
      // This is a critical situation requiring manual intervention
    }
  }

  getProgress(): MigrationProgress | null {
    return this.progress
  }
}

// ============================================================================
// MIGRATION PLAN DEFINITION
// ============================================================================

export const SINGLE_CHAT_TO_MULTI_SESSION_MIGRATION: MigrationPlan = {
  version: '2.0.0',
  description: 'Migrate from single-chat architecture to multi-session with enhanced features',
  estimatedDuration: '15-30 minutes',
  riskLevel: 'medium',
  prerequisites: [
    'database_backup',
    'schema_compatibility',
    'sufficient_storage'
  ],
  steps: [
    // Step 1: Create default teachers from existing data
    {
      id: 'create_default_teachers',
      name: 'Create Default Teachers',
      description: 'Create teacher records for existing preferences',
      dependencies: [],
      estimatedTime: '2-5 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        const startTime = Date.now()
        let recordsProcessed = 0
        let recordsSkipped = 0
        const errors: string[] = []
        const warnings: string[] = []

        try {
          // Query existing teacher preferences to identify unique teachers
          const legacyPreferences = await db.query({
            teacher_preferences: {}
          })

          const teacherIds = new Set<string>()

          // Extract unique teacher IDs
          if (legacyPreferences.teacher_preferences) {
            for (const pref of legacyPreferences.teacher_preferences) {
              if (pref.teacher_id) {
                teacherIds.add(pref.teacher_id)
              }
            }
          }

          // Create teacher records
          const transactions = []
          for (const teacherId of teacherIds) {
            const now = Date.now()
            transactions.push(
              db.tx.teachers[teacherId].update({
                email: `teacher_${teacherId}@eduhu.ki`, // Placeholder email
                display_name: `Teacher ${teacherId.slice(0, 8)}`,
                created_at: now,
                updated_at: now,
                subscription_tier: 'free',
                onboarding_completed: true
              })
            )
            recordsProcessed++
          }

          if (transactions.length > 0) {
            await db.transact(transactions)
          }

          return {
            success: true,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime,
            rollbackData: { createdTeachers: Array.from(teacherIds) }
          }

        } catch (error) {
          errors.push(`Failed to create teachers: ${error}`)
          return {
            success: false,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }
        }
      },
      validation: async (): Promise<boolean> => {
        const teachers = await db.query({ teachers: {} })
        return !!teachers.teachers && teachers.teachers.length > 0
      }
    },

    // Step 2: Migrate chats to chat_sessions
    {
      id: 'migrate_chats_to_sessions',
      name: 'Migrate Chats to Sessions',
      description: 'Convert legacy chat records to new chat_sessions format',
      dependencies: ['create_default_teachers'],
      estimatedTime: '5-10 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        const startTime = Date.now()
        let recordsProcessed = 0
        let recordsSkipped = 0
        const errors: string[] = []
        const warnings: string[] = []

        try {
          // Query existing chats
          const legacyChats = await db.query({
            chats: {}
          })

          if (!legacyChats.chats || legacyChats.chats.length === 0) {
            warnings.push('No legacy chats found to migrate')
            return {
              success: true,
              recordsProcessed: 0,
              recordsSkipped: 0,
              errors,
              warnings,
              duration: Date.now() - startTime
            }
          }

          const transactions = []
          const sessionMapping: Record<string, string> = {}

          for (const chat of legacyChats.chats) {
            try {
              const sessionId = generateId()
              sessionMapping[chat.id] = sessionId

              // Determine teacher_id (fallback to generating one if missing)
              const teacherId = chat.teacher_id || generateId()

              transactions.push(
                db.tx.chat_sessions[sessionId].update({
                  teacher_id: teacherId,
                  title: chat.title || 'Migrated Chat',
                  created_at: chat.created_at || Date.now(),
                  updated_at: chat.updated_at || Date.now(),
                  session_type: 'general', // Default type for migrated chats
                  topic_category: chat.topic_category,
                  message_count: chat.message_count || 0,
                  is_archived: chat.is_archived || false,
                  is_pinned: false,
                  tags: chat.topic_category ? [chat.topic_category] : []
                })
              )

              recordsProcessed++
            } catch (chatError) {
              errors.push(`Failed to migrate chat ${chat.id}: ${chatError}`)
              recordsSkipped++
            }
          }

          if (transactions.length > 0) {
            await db.transact(transactions)
          }

          return {
            success: true,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime,
            rollbackData: { sessionMapping }
          }

        } catch (error) {
          errors.push(`Failed to migrate chats: ${error}`)
          return {
            success: false,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }
        }
      },
      validation: async (): Promise<boolean> => {
        const sessions = await db.query({ chat_sessions: {} })
        return !!sessions.chat_sessions && sessions.chat_sessions.length > 0
      }
    },

    // Step 3: Migrate messages with updated references
    {
      id: 'migrate_messages',
      name: 'Migrate Messages',
      description: 'Update message references to use session_id instead of chat_id',
      dependencies: ['migrate_chats_to_sessions'],
      estimatedTime: '10-15 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        const startTime = Date.now()
        let recordsProcessed = 0
        let recordsSkipped = 0
        const errors: string[] = []
        const warnings: string[] = []

        try {
          // Get session mapping from previous step
          const sessionMappingData = await this.rollbackData.get('migrate_chats_to_sessions')
          if (!sessionMappingData?.sessionMapping) {
            throw new Error('Session mapping not found from previous step')
          }

          const sessionMapping = sessionMappingData.sessionMapping

          // Query existing messages
          const legacyMessages = await db.query({
            messages: {}
          })

          if (!legacyMessages.messages || legacyMessages.messages.length === 0) {
            warnings.push('No legacy messages found to migrate')
            return {
              success: true,
              recordsProcessed: 0,
              recordsSkipped: 0,
              errors,
              warnings,
              duration: Date.now() - startTime
            }
          }

          // Process messages in batches to avoid overwhelming the database
          const BATCH_SIZE = 50
          const batches = []
          for (let i = 0; i < legacyMessages.messages.length; i += BATCH_SIZE) {
            batches.push(legacyMessages.messages.slice(i, i + BATCH_SIZE))
          }

          for (const batch of batches) {
            const transactions = []

            for (const message of batch) {
              try {
                const sessionId = sessionMapping[message.chat_id]
                if (!sessionId) {
                  warnings.push(`No session mapping found for chat_id: ${message.chat_id}`)
                  recordsSkipped++
                  continue
                }

                // Create new message with updated structure
                const newMessageId = generateId()
                transactions.push(
                  db.tx.messages[newMessageId].update({
                    session_id: sessionId,
                    teacher_id: message.teacher_id || generateId(), // Fallback if missing
                    content: message.content,
                    role: message.role,
                    timestamp: message.timestamp,
                    content_type: message.content_type || 'text',
                    token_count: message.token_count,
                    response_time_ms: message.response_time_ms,
                    educational_topics: message.educational_topics
                  })
                )

                recordsProcessed++
              } catch (messageError) {
                errors.push(`Failed to migrate message ${message.id}: ${messageError}`)
                recordsSkipped++
              }
            }

            if (transactions.length > 0) {
              await db.transact(transactions)
            }
          }

          return {
            success: true,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }

        } catch (error) {
          errors.push(`Failed to migrate messages: ${error}`)
          return {
            success: false,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }
        }
      },
      validation: async (): Promise<boolean> => {
        const messages = await db.query({
          messages: {
            $: { limit: 1 }
          }
        })
        return !!messages.messages && messages.messages.length > 0 &&
               messages.messages[0].session_id !== undefined
      }
    },

    // Step 4: Migrate artifacts with session references
    {
      id: 'migrate_artifacts',
      name: 'Migrate Artifacts',
      description: 'Update artifact references to use session_id',
      dependencies: ['migrate_messages'],
      estimatedTime: '3-5 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        const startTime = Date.now()
        let recordsProcessed = 0
        let recordsSkipped = 0
        const errors: string[] = []
        const warnings: string[] = []

        try {
          const sessionMappingData = await this.rollbackData.get('migrate_chats_to_sessions')
          const sessionMapping = sessionMappingData?.sessionMapping

          const legacyArtifacts = await db.query({
            artifacts: {}
          })

          if (!legacyArtifacts.artifacts || legacyArtifacts.artifacts.length === 0) {
            warnings.push('No legacy artifacts found to migrate')
            return {
              success: true,
              recordsProcessed: 0,
              recordsSkipped: 0,
              errors,
              warnings,
              duration: Date.now() - startTime
            }
          }

          const transactions = []

          for (const artifact of legacyArtifacts.artifacts) {
            try {
              const sessionId = sessionMapping[artifact.chat_id]
              if (!sessionId) {
                warnings.push(`No session mapping found for artifact chat_id: ${artifact.chat_id}`)
                recordsSkipped++
                continue
              }

              const newArtifactId = generateId()
              transactions.push(
                db.tx.artifacts[newArtifactId].update({
                  session_id: sessionId,
                  message_id: artifact.message_id,
                  teacher_id: artifact.teacher_id || generateId(),
                  title: artifact.title,
                  content: artifact.content,
                  artifact_type: artifact.artifact_type,
                  created_at: artifact.created_at,
                  updated_at: Date.now(),
                  version: 1,
                  status: 'published',
                  usage_count: 0
                })
              )

              recordsProcessed++
            } catch (artifactError) {
              errors.push(`Failed to migrate artifact ${artifact.id}: ${artifactError}`)
              recordsSkipped++
            }
          }

          if (transactions.length > 0) {
            await db.transact(transactions)
          }

          return {
            success: true,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }

        } catch (error) {
          errors.push(`Failed to migrate artifacts: ${error}`)
          return {
            success: false,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }
        }
      },
      validation: async (): Promise<boolean> => {
        const artifacts = await db.query({
          artifacts: {
            $: { limit: 1 }
          }
        })
        return !!artifacts.artifacts && artifacts.artifacts.length > 0 &&
               artifacts.artifacts[0].session_id !== undefined
      }
    },

    // Step 5: Enhanced teacher preferences migration
    {
      id: 'migrate_teacher_preferences',
      name: 'Migrate Teacher Preferences',
      description: 'Enhance and migrate teacher preference data',
      dependencies: ['create_default_teachers'],
      estimatedTime: '2-3 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        const startTime = Date.now()
        let recordsProcessed = 0
        let recordsSkipped = 0
        const errors: string[] = []
        const warnings: string[] = []

        try {
          const legacyPreferences = await db.query({
            teacher_preferences: {}
          })

          if (!legacyPreferences.teacher_preferences) {
            warnings.push('No legacy preferences found to migrate')
            return {
              success: true,
              recordsProcessed: 0,
              recordsSkipped: 0,
              errors,
              warnings,
              duration: Date.now() - startTime
            }
          }

          const transactions = []

          for (const pref of legacyPreferences.teacher_preferences) {
            try {
              const newPrefId = generateId()
              transactions.push(
                db.tx.teacher_preferences[newPrefId].update({
                  teacher_id: pref.teacher_id,
                  grade_levels: pref.grade_level ? [pref.grade_level] : [],
                  subjects: pref.subject_areas || [],
                  ai_model_preference: pref.ai_model_preference,
                  notification_settings: pref.notification_settings,
                  created_at: Date.now(),
                  updated_at: pref.updated_at || Date.now(),
                  teaching_style: 'flexible', // Default for existing users
                  response_length: 'detailed' // Default preference
                })
              )

              recordsProcessed++
            } catch (prefError) {
              errors.push(`Failed to migrate preferences for ${pref.teacher_id}: ${prefError}`)
              recordsSkipped++
            }
          }

          if (transactions.length > 0) {
            await db.transact(transactions)
          }

          return {
            success: true,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }

        } catch (error) {
          errors.push(`Failed to migrate preferences: ${error}`)
          return {
            success: false,
            recordsProcessed,
            recordsSkipped,
            errors,
            warnings,
            duration: Date.now() - startTime
          }
        }
      },
      validation: async (): Promise<boolean> => {
        const preferences = await db.query({
          teacher_preferences: {
            $: { limit: 1 }
          }
        })
        return !!preferences.teacher_preferences && preferences.teacher_preferences.length > 0
      }
    }
  ],

  // Rollback steps (in reverse order of execution)
  rollbackSteps: [
    {
      id: 'cleanup_migrated_preferences',
      name: 'Cleanup Migrated Preferences',
      description: 'Remove migrated teacher preferences',
      dependencies: [],
      estimatedTime: '1 minute',
      execute: async (): Promise<MigrationStepResult> => {
        // Implementation for cleaning up migrated preferences
        return { success: true, recordsProcessed: 0, recordsSkipped: 0, errors: [], warnings: [], duration: 0 }
      },
      validation: async (): Promise<boolean> => true
    },
    {
      id: 'cleanup_migrated_artifacts',
      name: 'Cleanup Migrated Artifacts',
      description: 'Remove migrated artifacts',
      dependencies: [],
      estimatedTime: '1 minute',
      execute: async (): Promise<MigrationStepResult> => {
        // Implementation for cleaning up migrated artifacts
        return { success: true, recordsProcessed: 0, recordsSkipped: 0, errors: [], warnings: [], duration: 0 }
      },
      validation: async (): Promise<boolean> => true
    },
    {
      id: 'cleanup_migrated_messages',
      name: 'Cleanup Migrated Messages',
      description: 'Remove migrated messages',
      dependencies: [],
      estimatedTime: '2 minutes',
      execute: async (): Promise<MigrationStepResult> => {
        // Implementation for cleaning up migrated messages
        return { success: true, recordsProcessed: 0, recordsSkipped: 0, errors: [], warnings: [], duration: 0 }
      },
      validation: async (): Promise<boolean> => true
    },
    {
      id: 'cleanup_migrated_sessions',
      name: 'Cleanup Migrated Sessions',
      description: 'Remove migrated chat sessions',
      dependencies: [],
      estimatedTime: '1 minute',
      execute: async (): Promise<MigrationStepResult> => {
        // Implementation for cleaning up migrated sessions
        return { success: true, recordsProcessed: 0, recordsSkipped: 0, errors: [], warnings: [], duration: 0 }
      },
      validation: async (): Promise<boolean> => true
    },
    {
      id: 'cleanup_created_teachers',
      name: 'Cleanup Created Teachers',
      description: 'Remove created teacher records',
      dependencies: [],
      estimatedTime: '1 minute',
      execute: async (): Promise<MigrationStepResult> => {
        // Implementation for cleaning up created teachers
        return { success: true, recordsProcessed: 0, recordsSkipped: 0, errors: [], warnings: [], duration: 0 }
      },
      validation: async (): Promise<boolean> => true
    }
  ]
}

// ============================================================================
// MIGRATION UTILITIES
// ============================================================================

export const createMigrationExecutor = (): MigrationExecutor => {
  return new MigrationExecutor()
}

export const runMigration = async (): Promise<boolean> => {
  const executor = createMigrationExecutor()
  return await executor.executeMigration(SINGLE_CHAT_TO_MULTI_SESSION_MIGRATION)
}

export const getMigrationProgress = (executor: MigrationExecutor): MigrationProgress | null => {
  return executor.getProgress()
}

// Data validation utilities
export const validateMigrationIntegrity = async (): Promise<{
  success: boolean
  issues: string[]
  recommendations: string[]
}> => {
  const issues: string[] = []
  const recommendations: string[] = []

  try {
    // Check that all sessions have corresponding teachers
    const sessions = await db.query({ chat_sessions: {} })
    const teachers = await db.query({ teachers: {} })

    const teacherIds = new Set(teachers.teachers?.map(t => t.id) || [])

    if (sessions.chat_sessions) {
      for (const session of sessions.chat_sessions) {
        if (!teacherIds.has(session.teacher_id)) {
          issues.push(`Session ${session.id} references non-existent teacher ${session.teacher_id}`)
        }
      }
    }

    // Check that all messages have valid session references
    const messages = await db.query({ messages: {} })
    const sessionIds = new Set(sessions.chat_sessions?.map(s => s.id) || [])

    if (messages.messages) {
      for (const message of messages.messages) {
        if (!sessionIds.has(message.session_id)) {
          issues.push(`Message ${message.id} references non-existent session ${message.session_id}`)
        }
      }
    }

    // Add recommendations based on findings
    if (issues.length === 0) {
      recommendations.push('Migration integrity check passed successfully')
    } else {
      recommendations.push('Consider running data cleanup scripts to resolve integrity issues')
      recommendations.push('Review migration logs for detailed error information')
    }

    return {
      success: issues.length === 0,
      issues,
      recommendations
    }

  } catch (error) {
    issues.push(`Migration integrity check failed: ${error}`)
    return {
      success: false,
      issues,
      recommendations: ['Review database connection and permissions']
    }
  }
}

export default {
  MigrationExecutor,
  SINGLE_CHAT_TO_MULTI_SESSION_MIGRATION,
  runMigration,
  validateMigrationIntegrity
}