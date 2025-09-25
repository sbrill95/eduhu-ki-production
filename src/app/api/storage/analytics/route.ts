import { NextRequest, NextResponse } from 'next/server'
import { storageMonitoring, MONITORING_CONFIG } from '@/lib/storage-monitoring'
import { getStorageInfo } from '@/lib/file-storage'

export async function GET(request: NextRequest) {
  try {
    // Check if monitoring is enabled
    if (!MONITORING_CONFIG.ENABLED) {
      return NextResponse.json(
        { error: 'Storage monitoring not enabled' },
        { status: 503 }
      )
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const timeRange = searchParams.get('timeRange') || '24' // hours
    const format = searchParams.get('format') || 'json'

    // Basic authentication check (in production, use proper auth)
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader?.startsWith('Bearer ') ||
                           searchParams.get('token') === process.env.ANALYTICS_ACCESS_TOKEN

    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const timeRangeHours = parseInt(timeRange)
    if (isNaN(timeRangeHours) || timeRangeHours < 1 || timeRangeHours > 168) {
      return NextResponse.json(
        { error: 'Invalid time range. Must be between 1 and 168 hours.' },
        { status: 400 }
      )
    }

    // Get analytics data
    const [usageStats, healthReport, storageInfo] = await Promise.all([
      storageMonitoring.getUsageStats(timeRangeHours).catch(() => null),
      storageMonitoring.getHealthReport().catch(() => null),
      Promise.resolve(getStorageInfo())
    ])

    const analytics = {
      timestamp: new Date().toISOString(),
      timeRange: {
        hours: timeRangeHours,
        start: new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      storage: {
        provider: storageInfo.type,
        configured: storageInfo.configured,
        details: storageInfo.details
      },
      usage: usageStats || {
        totalFiles: 0,
        totalSize: 0,
        byTeacher: {},
        byProvider: {},
        timeRange: {
          start: Date.now() - timeRangeHours * 60 * 60 * 1000,
          end: Date.now()
        }
      },
      health: healthReport || {
        status: 'unknown',
        issues: ['Health monitoring unavailable'],
        recommendations: [],
        metrics: {
          errorRate: 0,
          avgResponseTime: 0,
          totalOperations: 0
        }
      },
      monitoring: {
        enabled: MONITORING_CONFIG.ENABLED,
        analyticsEnabled: MONITORING_CONFIG.ANALYTICS_ENABLED,
        alertsEnabled: !!(MONITORING_CONFIG.ALERT_EMAIL || MONITORING_CONFIG.ALERT_WEBHOOK)
      }
    }

    // Format response
    if (format === 'csv') {
      // Generate CSV format for usage stats
      const csvLines = ['Teacher,Files,Size (bytes)']

      Object.entries(analytics.usage.byTeacher).forEach(([teacherId, stats]) => {
        csvLines.push(`${teacherId},${stats.files},${stats.size}`)
      })

      return new NextResponse(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="storage-analytics-${Date.now()}.csv"`
        }
      })
    }

    // Return JSON format
    return NextResponse.json(analytics, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Storage analytics error:', error)

    return NextResponse.json(
      {
        error: 'Failed to retrieve storage analytics',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if monitoring is enabled
    if (!MONITORING_CONFIG.ENABLED) {
      return NextResponse.json(
        { error: 'Storage monitoring not enabled' },
        { status: 503 }
      )
    }

    // Basic authentication check
    const authHeader = request.headers.get('authorization')
    const isAuthenticated = authHeader?.startsWith('Bearer ') ||
                           request.nextUrl.searchParams.get('token') === process.env.ANALYTICS_ACCESS_TOKEN

    if (!isAuthenticated && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'record_metric':
        // Manual metric recording
        if (!params.operation || !params.storageProvider) {
          return NextResponse.json(
            { error: 'Missing required fields: operation, storageProvider' },
            { status: 400 }
          )
        }

        storageMonitoring.recordMetric({
          operation: params.operation,
          success: params.success ?? true,
          responseTime: params.responseTime ?? 0,
          storageProvider: params.storageProvider,
          teacherId: params.teacherId,
          sessionId: params.sessionId,
          fileSize: params.fileSize,
          errorMessage: params.errorMessage,
          metadata: params.metadata
        })

        return NextResponse.json({ success: true, message: 'Metric recorded' })

      case 'health_check':
        // Trigger manual health check
        const healthReport = await storageMonitoring.getHealthReport()
        return NextResponse.json({
          success: true,
          health: healthReport
        })

      case 'reset_metrics':
        // Reset/clear metrics (admin function)
        // This would need proper admin authentication in production
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json(
            { error: 'Operation not allowed in production' },
            { status: 403 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Metrics reset (development only)'
        })

      default:
        return NextResponse.json(
          { error: 'Unknown action', availableActions: ['record_metric', 'health_check', 'reset_metrics'] },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Storage analytics POST error:', error)

    return NextResponse.json(
      {
        error: 'Failed to process analytics request',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}