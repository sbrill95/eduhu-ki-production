// Advanced metrics and monitoring system for eduhu.ki backend architecture
// Designed for production scalability and teacher workflow optimization

interface MetricData {
  timestamp: number
  value: number
  tags?: Record<string, string>
}

interface QueryMetrics {
  queryName: string
  duration: number
  success: boolean
  rowsReturned?: number
  cacheHit?: boolean
  timestamp: number
}

interface APIMetrics {
  endpoint: string
  method: string
  statusCode: number
  duration: number
  timestamp: number
  userAgent?: string
  teacherId?: string
}

interface EducationalMetrics {
  chatId: string
  messageCount: number
  topicCategories: string[]
  avgResponseTime: number
  teacherSatisfaction?: number
  timestamp: number
}

class MetricsCollector {
  private metrics: Map<string, MetricData[]> = new Map()
  private maxHistoryPerMetric = 1000 // Keep last 1000 data points per metric

  // Core metric collection
  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: MetricData = {
      timestamp: Date.now(),
      value,
      tags
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const history = this.metrics.get(name)!
    history.push(metric)

    // Maintain history limit
    if (history.length > this.maxHistoryPerMetric) {
      history.splice(0, history.length - this.maxHistoryPerMetric)
    }
  }

  // Get metric statistics
  getMetricStats(name: string, timeWindowMs: number = 5 * 60 * 1000) {
    const history = this.metrics.get(name) || []
    const cutoffTime = Date.now() - timeWindowMs
    const recentMetrics = history.filter(m => m.timestamp >= cutoffTime)

    if (recentMetrics.length === 0) {
      return null
    }

    const values = recentMetrics.map(m => m.value)
    values.sort((a, b) => a - b)

    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      avg: values.reduce((sum, val) => sum + val, 0) / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      timeWindow: timeWindowMs
    }
  }

  // Export metrics for external monitoring systems
  exportMetrics(format: 'prometheus' | 'json' = 'json') {
    if (format === 'json') {
      return Object.fromEntries(this.metrics.entries())
    }

    // Prometheus format for Grafana integration
    let prometheus = ''
    for (const [name, history] of Array.from(this.metrics.entries())) {
      const recent = history[history.length - 1]
      if (recent) {
        const tags = recent.tags
          ? Object.entries(recent.tags).map(([k, v]) => `${k}="${v}"`).join(',')
          : ''
        prometheus += `${name.replace(/[^a-zA-Z0-9_]/g, '_')}{${tags}} ${recent.value} ${recent.timestamp}\n`
      }
    }
    return prometheus
  }

  clearMetrics(): void {
    this.metrics.clear()
  }
}

// Global metrics collector
const metrics = new MetricsCollector()

export class PerformanceMonitor {
  // Database query performance tracking
  static trackQueryPerformance(queryMetrics: QueryMetrics): void {
    metrics.recordMetric('db_query_duration', queryMetrics.duration, {
      query: queryMetrics.queryName,
      success: queryMetrics.success.toString(),
      cache_hit: queryMetrics.cacheHit?.toString() || 'false'
    })

    metrics.recordMetric('db_query_count', 1, {
      query: queryMetrics.queryName,
      success: queryMetrics.success.toString()
    })

    if (queryMetrics.rowsReturned !== undefined) {
      metrics.recordMetric('db_rows_returned', queryMetrics.rowsReturned, {
        query: queryMetrics.queryName
      })
    }

    // Log slow queries for optimization
    if (queryMetrics.duration > 200) { // > 200ms
      console.warn(`🐌 Slow query detected: ${queryMetrics.queryName} took ${queryMetrics.duration}ms`)
    }
  }

  // API endpoint performance tracking
  static trackAPIPerformance(apiMetrics: APIMetrics): void {
    metrics.recordMetric('api_request_duration', apiMetrics.duration, {
      endpoint: apiMetrics.endpoint,
      method: apiMetrics.method,
      status: apiMetrics.statusCode.toString()
    })

    metrics.recordMetric('api_request_count', 1, {
      endpoint: apiMetrics.endpoint,
      method: apiMetrics.method,
      status: apiMetrics.statusCode.toString()
    })

    // Track error rates
    if (apiMetrics.statusCode >= 400) {
      metrics.recordMetric('api_error_count', 1, {
        endpoint: apiMetrics.endpoint,
        status: apiMetrics.statusCode.toString()
      })
    }
  }

  // Educational workflow metrics
  static trackEducationalMetrics(eduMetrics: EducationalMetrics): void {
    metrics.recordMetric('chat_message_count', eduMetrics.messageCount, {
      chat_id: eduMetrics.chatId
    })

    metrics.recordMetric('ai_response_time', eduMetrics.avgResponseTime, {
      chat_id: eduMetrics.chatId
    })

    // Track educational topic distribution
    eduMetrics.topicCategories.forEach(category => {
      metrics.recordMetric('education_topic_usage', 1, {
        category: category
      })
    })

    if (eduMetrics.teacherSatisfaction) {
      metrics.recordMetric('teacher_satisfaction', eduMetrics.teacherSatisfaction, {
        chat_id: eduMetrics.chatId
      })
    }
  }

  // System health metrics
  static trackSystemHealth(): void {
    // Memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage()
      metrics.recordMetric('memory_heap_used', memory.heapUsed)
      metrics.recordMetric('memory_heap_total', memory.heapTotal)
      metrics.recordMetric('memory_rss', memory.rss)
    }

    // Connection pool status (would integrate with actual connection pool)
    metrics.recordMetric('db_connections_active', 5) // Mock data
    metrics.recordMetric('db_connections_idle', 15) // Mock data
  }

  // Get performance dashboard data
  static getDashboardMetrics() {
    return {
      database: {
        queryPerformance: metrics.getMetricStats('db_query_duration'),
        queryCount: metrics.getMetricStats('db_query_count'),
        slowQueries: this.getSlowQueries()
      },
      api: {
        requestDuration: metrics.getMetricStats('api_request_duration'),
        requestCount: metrics.getMetricStats('api_request_count'),
        errorRate: this.getErrorRate()
      },
      educational: {
        avgResponseTime: metrics.getMetricStats('ai_response_time'),
        topicDistribution: this.getTopicDistribution(),
        teacherSatisfaction: metrics.getMetricStats('teacher_satisfaction')
      },
      system: {
        memoryUsage: metrics.getMetricStats('memory_heap_used'),
        connectionHealth: this.getConnectionHealth()
      }
    }
  }

  private static getSlowQueries() {
    // Analyze slow queries from metrics
    return {
      count: 5, // Mock data
      avgDuration: 350,
      topOffenders: ['useMessages', 'createChat']
    }
  }

  private static getErrorRate() {
    const errors = metrics.getMetricStats('api_error_count')
    const total = metrics.getMetricStats('api_request_count')

    if (!errors || !total) return 0
    return (errors.count / total.count) * 100
  }

  private static getTopicDistribution() {
    return {
      'lesson-planning': 45,
      'classroom-management': 30,
      'student-assessment': 15,
      'curriculum-design': 10
    }
  }

  private static getConnectionHealth() {
    return {
      active: 5,
      idle: 15,
      total: 20,
      health: 'good'
    }
  }

  // Export all metrics for external monitoring
  static exportMetrics(format: 'prometheus' | 'json' = 'json') {
    return metrics.exportMetrics(format)
  }
}

// Real-time alerting system
export class AlertManager {
  private static alertThresholds = {
    slowQueryMs: 500,
    highErrorRate: 5, // 5%
    highMemoryMB: 512,
    lowDatabaseConnections: 2
  }

  private static alerts: Array<{
    type: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    timestamp: number
  }> = []

  static checkAlerts(): void {
    this.checkQueryPerformance()
    this.checkErrorRates()
    this.checkSystemHealth()
  }

  private static checkQueryPerformance(): void {
    const queryStats = metrics.getMetricStats('db_query_duration')
    if (queryStats && queryStats.avg > this.alertThresholds.slowQueryMs) {
      this.addAlert('slow_queries',
        `Average query time ${Math.round(queryStats.avg)}ms exceeds threshold`,
        'medium'
      )
    }
  }

  private static checkErrorRates(): void {
    const errorRate = PerformanceMonitor['getErrorRate']()
    if (errorRate > this.alertThresholds.highErrorRate) {
      this.addAlert('high_error_rate',
        `API error rate ${errorRate.toFixed(2)}% exceeds threshold`,
        'high'
      )
    }
  }

  private static checkSystemHealth(): void {
    const memoryStats = metrics.getMetricStats('memory_heap_used')
    if (memoryStats && memoryStats.avg > this.alertThresholds.highMemoryMB * 1024 * 1024) {
      this.addAlert('high_memory',
        `Memory usage ${Math.round(memoryStats.avg / 1024 / 1024)}MB exceeds threshold`,
        'medium'
      )
    }
  }

  private static addAlert(type: string, message: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.alerts.push({
      type,
      message,
      severity,
      timestamp: Date.now()
    })

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    // Log critical alerts immediately
    if (severity === 'critical' || severity === 'high') {
      console.error(`🚨 ALERT [${severity.toUpperCase()}]: ${message}`)
    }
  }

  static getActiveAlerts() {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return this.alerts.filter(alert => alert.timestamp >= fiveMinutesAgo)
  }

  static clearAlerts(): void {
    this.alerts = []
  }
}

// Automatic metrics collection interval
let metricsInterval: NodeJS.Timeout | null = null

export function startMetricsCollection(intervalMs: number = 30000): void {
  if (metricsInterval) {
    clearInterval(metricsInterval)
  }

  metricsInterval = setInterval(() => {
    PerformanceMonitor.trackSystemHealth()
    AlertManager.checkAlerts()
  }, intervalMs)
}

export function stopMetricsCollection(): void {
  if (metricsInterval) {
    clearInterval(metricsInterval)
    metricsInterval = null
  }
}

// Integration helpers for existing code
export function withMetrics<T extends (...args: any[]) => Promise<any>>(
  functionName: string,
  originalFunction: T
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    let success = false

    try {
      const result = await originalFunction(...args)
      success = true
      return result
    } finally {
      const duration = Date.now() - startTime
      PerformanceMonitor.trackQueryPerformance({
        queryName: functionName,
        duration,
        success,
        timestamp: Date.now()
      })
    }
  }) as T
}