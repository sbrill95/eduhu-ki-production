import { db } from './instant'

// Monitoring configuration
export const MONITORING_CONFIG = {
  ENABLED: process.env.STORAGE_MONITORING_ENABLED === 'true',
  ANALYTICS_ENABLED: process.env.STORAGE_ANALYTICS_ENABLED === 'true',
  ALERT_EMAIL: process.env.STORAGE_ALERT_EMAIL,
  ALERT_WEBHOOK: process.env.STORAGE_ALERT_WEBHOOK,

  // Thresholds
  ERROR_RATE_THRESHOLD: 0.05, // 5% error rate triggers alert
  RESPONSE_TIME_THRESHOLD: 5000, // 5 seconds
  STORAGE_USAGE_THRESHOLD: 0.8, // 80% of quota

  // Batch settings
  BATCH_SIZE: 100,
  FLUSH_INTERVAL_MS: 30000, // 30 seconds
} as const

// Types for monitoring data
export interface StorageMetrics {
  timestamp: number
  operation: string
  success: boolean
  responseTime: number
  fileSize?: number
  storageProvider: string
  teacherId?: string
  sessionId?: string
  errorMessage?: string
  metadata?: Record<string, any>
}

export interface StorageAlert {
  id: string
  type: 'error_rate' | 'response_time' | 'storage_quota' | 'system_error'
  severity: 'warning' | 'critical'
  message: string
  timestamp: number
  teacherId?: string
  metadata?: Record<string, any>
}

export interface StorageUsageStats {
  totalFiles: number
  totalSize: number
  byTeacher: Record<string, { files: number; size: number }>
  byProvider: Record<string, { files: number; size: number; errors: number }>
  timeRange: { start: number; end: number }
}

/**
 * Storage Monitoring Service
 * Collects metrics, logs events, and triggers alerts
 */
export class StorageMonitoringService {
  private metrics: StorageMetrics[] = []
  private flushTimer: NodeJS.Timeout | null = null

  constructor() {
    if (MONITORING_CONFIG.ENABLED) {
      this.startBatchFlush()
      console.log('Storage monitoring enabled')
    }
  }

  /**
   * Record a storage operation metric
   */
  recordMetric(metric: Omit<StorageMetrics, 'timestamp'>): void {
    if (!MONITORING_CONFIG.ENABLED) return

    const fullMetric: StorageMetrics = {
      ...metric,
      timestamp: Date.now()
    }

    this.metrics.push(fullMetric)

    // Check for immediate alerts
    this.checkAlerts(fullMetric)

    // Flush if batch is full
    if (this.metrics.length >= MONITORING_CONFIG.BATCH_SIZE) {
      this.flushMetrics()
    }
  }

  /**
   * Record file upload operation
   */
  recordFileUpload(params: {
    success: boolean
    responseTime: number
    fileSize: number
    storageProvider: string
    teacherId: string
    sessionId?: string
    errorMessage?: string
  }): void {
    this.recordMetric({
      operation: 'upload',
      ...params
    })
  }

  /**
   * Record file download operation
   */
  recordFileDownload(params: {
    success: boolean
    responseTime: number
    fileSize?: number
    storageProvider: string
    teacherId?: string
    sessionId?: string
    errorMessage?: string
  }): void {
    this.recordMetric({
      operation: 'download',
      ...params
    })
  }

  /**
   * Record file deletion operation
   */
  recordFileDelete(params: {
    success: boolean
    responseTime: number
    storageProvider: string
    teacherId: string
    sessionId?: string
    errorMessage?: string
  }): void {
    this.recordMetric({
      operation: 'delete',
      ...params
    })
  }

  /**
   * Record storage adapter initialization
   */
  recordAdapterInit(params: {
    success: boolean
    storageProvider: string
    responseTime: number
    errorMessage?: string
  }): void {
    this.recordMetric({
      operation: 'adapter_init',
      ...params
    })
  }

  /**
   * Get storage usage statistics
   */
  async getUsageStats(timeRangeHours = 24): Promise<StorageUsageStats> {
    if (!MONITORING_CONFIG.ANALYTICS_ENABLED) {
      throw new Error('Storage analytics not enabled')
    }

    const endTime = Date.now()
    const startTime = endTime - (timeRangeHours * 60 * 60 * 1000)

    try {
      // Query analytics from InstantDB
      const analyticsData = await db.query({
        usage_analytics: {
          $: {
            where: {
              timestamp: { $gte: startTime, $lte: endTime },
              event_type: { $in: ['file_upload', 'file_access', 'file_delete'] }
            }
          }
        }
      })

      const stats: StorageUsageStats = {
        totalFiles: 0,
        totalSize: 0,
        byTeacher: {},
        byProvider: {},
        timeRange: { start: startTime, end: endTime }
      }

      // Process analytics data
      if (analyticsData.usage_analytics) {
        for (const record of analyticsData.usage_analytics) {
          const teacherId = record.teacher_id || 'unknown'
          const metadata = record.metadata || {}
          const fileSize = metadata.file_size || 0
          const provider = metadata.served_from || 'unknown'

          // Update totals
          if (record.event_type === 'file_upload') {
            stats.totalFiles++
            stats.totalSize += fileSize
          }

          // Update per-teacher stats
          if (!stats.byTeacher[teacherId]) {
            stats.byTeacher[teacherId] = { files: 0, size: 0 }
          }
          if (record.event_type === 'file_upload') {
            stats.byTeacher[teacherId].files++
            stats.byTeacher[teacherId].size += fileSize
          }

          // Update per-provider stats
          if (!stats.byProvider[provider]) {
            stats.byProvider[provider] = { files: 0, size: 0, errors: 0 }
          }
          if (record.event_type === 'file_upload') {
            stats.byProvider[provider].files++
            stats.byProvider[provider].size += fileSize
          }
          if (record.event_type.includes('error')) {
            stats.byProvider[provider].errors++
          }
        }
      }

      return stats
    } catch (error) {
      console.error('Error getting usage stats:', error)
      throw new Error('Failed to retrieve storage usage statistics')
    }
  }

  /**
   * Generate storage health report
   */
  async getHealthReport(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
    metrics: {
      errorRate: number
      avgResponseTime: number
      totalOperations: number
    }
  }> {
    const issues: string[] = []
    const recommendations: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    // Calculate metrics from recent data
    const recentMetrics = this.getRecentMetrics(30 * 60 * 1000) // Last 30 minutes
    const totalOps = recentMetrics.length
    const errors = recentMetrics.filter(m => !m.success).length
    const errorRate = totalOps > 0 ? errors / totalOps : 0
    const avgResponseTime = totalOps > 0 ?
      recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / totalOps : 0

    // Check error rate
    if (errorRate > MONITORING_CONFIG.ERROR_RATE_THRESHOLD) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`)
      recommendations.push('Check storage provider connectivity and credentials')
      status = 'warning'
    }

    // Check response time
    if (avgResponseTime > MONITORING_CONFIG.RESPONSE_TIME_THRESHOLD) {
      issues.push(`Slow response times: ${Math.round(avgResponseTime)}ms average`)
      recommendations.push('Monitor storage provider performance and network latency')
      if (status === 'healthy') status = 'warning'
    }

    // Check for recent critical errors
    const criticalErrors = recentMetrics.filter(m =>
      !m.success && m.errorMessage?.includes('access denied')
    ).length

    if (criticalErrors > 0) {
      issues.push(`${criticalErrors} access denied errors`)
      recommendations.push('Verify storage provider credentials and permissions')
      status = 'critical'
    }

    return {
      status,
      issues,
      recommendations,
      metrics: {
        errorRate,
        avgResponseTime: Math.round(avgResponseTime),
        totalOperations: totalOps
      }
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: StorageAlert): Promise<void> {
    console.warn('Storage Alert:', alert)

    try {
      // Store alert in database
      if (MONITORING_CONFIG.ANALYTICS_ENABLED) {
        await db.transact([
          db.tx.storage_alerts[alert.id].update({
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp,
            teacher_id: alert.teacherId,
            metadata: alert.metadata
          })
        ])
      }

      // Send email alert if configured
      if (MONITORING_CONFIG.ALERT_EMAIL) {
        // In a real implementation, integrate with email service
        console.log(`Email alert would be sent to: ${MONITORING_CONFIG.ALERT_EMAIL}`)
      }

      // Send webhook alert if configured
      if (MONITORING_CONFIG.ALERT_WEBHOOK) {
        try {
          const response = await fetch(MONITORING_CONFIG.ALERT_WEBHOOK, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: `🚨 Storage Alert: ${alert.message}`,
              attachments: [{
                color: alert.severity === 'critical' ? 'danger' : 'warning',
                fields: [
                  { title: 'Type', value: alert.type, short: true },
                  { title: 'Severity', value: alert.severity, short: true },
                  { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: false }
                ]
              }]
            })
          })

          if (!response.ok) {
            console.error('Failed to send webhook alert:', response.statusText)
          }
        } catch (error) {
          console.error('Error sending webhook alert:', error)
        }
      }
    } catch (error) {
      console.error('Error sending alert:', error)
    }
  }

  /**
   * Check metrics for alert conditions
   */
  private checkAlerts(metric: StorageMetrics): void {
    // Check for high response time
    if (metric.responseTime > MONITORING_CONFIG.RESPONSE_TIME_THRESHOLD) {
      const alert: StorageAlert = {
        id: `response_time_${Date.now()}`,
        type: 'response_time',
        severity: 'warning',
        message: `Slow storage operation: ${metric.operation} took ${metric.responseTime}ms`,
        timestamp: Date.now(),
        teacherId: metric.teacherId,
        metadata: { metric }
      }
      this.sendAlert(alert)
    }

    // Check for errors
    if (!metric.success && metric.errorMessage) {
      const alert: StorageAlert = {
        id: `error_${Date.now()}`,
        type: 'system_error',
        severity: metric.errorMessage.includes('access denied') ? 'critical' : 'warning',
        message: `Storage operation failed: ${metric.errorMessage}`,
        timestamp: Date.now(),
        teacherId: metric.teacherId,
        metadata: { metric }
      }
      this.sendAlert(alert)
    }
  }

  /**
   * Start batch flushing timer
   */
  private startBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.metrics.length > 0) {
        this.flushMetrics()
      }
    }, MONITORING_CONFIG.FLUSH_INTERVAL_MS)
  }

  /**
   * Flush accumulated metrics to storage
   */
  private async flushMetrics(): Promise<void> {
    if (this.metrics.length === 0) return

    const metricsToFlush = [...this.metrics]
    this.metrics = []

    if (!MONITORING_CONFIG.ANALYTICS_ENABLED) {
      // Just log if analytics not enabled
      console.log(`Flushing ${metricsToFlush.length} storage metrics (analytics disabled)`)
      return
    }

    try {
      // Store metrics in InstantDB
      const transactions = metricsToFlush.map(metric => {
        const id = `metric_${metric.timestamp}_${Math.random().toString(36).substr(2, 9)}`
        return db.tx.storage_metrics[id].update({
          timestamp: metric.timestamp,
          operation: metric.operation,
          success: metric.success,
          response_time: metric.responseTime,
          file_size: metric.fileSize,
          storage_provider: metric.storageProvider,
          teacher_id: metric.teacherId,
          session_id: metric.sessionId,
          error_message: metric.errorMessage,
          metadata: metric.metadata
        })
      })

      await db.transact(transactions)
      console.log(`Flushed ${metricsToFlush.length} storage metrics to database`)
    } catch (error) {
      console.error('Error flushing metrics:', error)
      // Put metrics back for retry
      this.metrics.unshift(...metricsToFlush)
    }
  }

  /**
   * Get recent metrics for analysis
   */
  private getRecentMetrics(windowMs: number): StorageMetrics[] {
    const cutoff = Date.now() - windowMs
    return this.metrics.filter(m => m.timestamp >= cutoff)
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Flush any remaining metrics
    if (this.metrics.length > 0) {
      this.flushMetrics()
    }
  }
}

// Global monitoring service instance
export const storageMonitoring = new StorageMonitoringService()

// Cleanup on process exit
process.on('SIGTERM', () => {
  storageMonitoring.destroy()
})

process.on('SIGINT', () => {
  storageMonitoring.destroy()
})

/**
 * Decorator function to add monitoring to storage operations
 */
export function monitorStorageOperation<T extends (...args: any[]) => Promise<any>>(
  operation: string,
  storageProvider: string
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (this: any, ...args: any[]) {
      const startTime = Date.now()
      let success = false
      let errorMessage: string | undefined

      try {
        const result = await originalMethod.apply(this, args)
        success = true
        return result
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error'
        throw error
      } finally {
        const responseTime = Date.now() - startTime

        storageMonitoring.recordMetric({
          operation,
          success,
          responseTime,
          storageProvider,
          errorMessage,
          metadata: {
            method: propertyKey,
            argsCount: args.length
          }
        })
      }
    }

    return descriptor
  }
}

/**
 * Utility function to create storage operation wrapper
 */
export async function withStorageMonitoring<T>(
  operation: string,
  storageProvider: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const startTime = Date.now()
  let success = false
  let errorMessage: string | undefined

  try {
    const result = await fn()
    success = true
    return result
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw error
  } finally {
    const responseTime = Date.now() - startTime

    storageMonitoring.recordMetric({
      operation,
      success,
      responseTime,
      storageProvider,
      errorMessage,
      metadata
    })
  }
}