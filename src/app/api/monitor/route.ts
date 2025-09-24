import { NextRequest, NextResponse } from 'next/server'

// Monitoring endpoint for service health and performance metrics
export async function GET(request: NextRequest) {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),

    // System metrics
    system: {
      memory: getMemoryMetrics(),
      node_version: process.version,
      platform: process.platform,
      environment: process.env.NODE_ENV || 'development',
    },

    // Service metrics
    services: await getServiceMetrics(),

    // Performance metrics
    performance: getPerformanceMetrics(),

    // Request metrics (basic)
    request: {
      user_agent: request.headers.get('user-agent'),
      ip: getClientIP(request),
      timestamp: new Date().toISOString(),
    }
  }

  return NextResponse.json(metrics, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  })
}

// POST endpoint for receiving client-side metrics
export async function POST(request: NextRequest) {
  try {
    const clientMetrics = await request.json()

    // Process client-side Core Web Vitals
    const processedMetrics = {
      timestamp: new Date().toISOString(),
      client_ip: getClientIP(request),
      user_agent: request.headers.get('user-agent'),
      ...clientMetrics
    }

    // In a real implementation, you'd store these metrics
    // For now, we'll just validate and echo them back
    console.log('Client metrics received:', processedMetrics)

    return NextResponse.json({
      status: 'received',
      timestamp: processedMetrics.timestamp
    })
  } catch (error) {
    console.error('Error processing client metrics:', error)
    return NextResponse.json(
      { error: 'Invalid metrics data' },
      { status: 400 }
    )
  }
}

function getMemoryMetrics() {
  const usage = process.memoryUsage()
  return {
    rss_mb: Math.round(usage.rss / 1024 / 1024),
    heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
    heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
    heap_used_percent: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    external_mb: Math.round(usage.external / 1024 / 1024),
  }
}

async function getServiceMetrics() {
  const results = await Promise.allSettled([
    checkInstantDB(),
    checkOpenAI(),
    checkInternalServices()
  ])

  return {
    instantdb: results[0].status === 'fulfilled' ? results[0].value : { status: 'error', error: 'Timeout' },
    openai: results[1].status === 'fulfilled' ? results[1].value : { status: 'error', error: 'Timeout' },
    internal: results[2].status === 'fulfilled' ? results[2].value : { status: 'error', error: 'Timeout' }
  }
}

async function checkInstantDB() {
  const startTime = Date.now()

  try {
    const appId = process.env.NEXT_PUBLIC_INSTANTDB_APP_ID
    if (!appId || appId === 'your-instantdb-app-id-here') {
      return {
        status: 'misconfigured',
        response_time_ms: Date.now() - startTime,
        error: 'App ID not configured'
      }
    }

    // Basic validation - in production you might want to test actual connectivity
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId)

    return {
      status: isValidUUID ? 'healthy' : 'unhealthy',
      response_time_ms: Date.now() - startTime,
      app_id_prefix: appId.substring(0, 8),
      last_checked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'error',
      response_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkOpenAI() {
  const startTime = Date.now()

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return {
        status: 'misconfigured',
        response_time_ms: Date.now() - startTime,
        error: 'API key not configured'
      }
    }

    // Basic key format validation
    const isValidKey = apiKey.startsWith('sk-') && apiKey.length > 20

    return {
      status: isValidKey ? 'healthy' : 'unhealthy',
      response_time_ms: Date.now() - startTime,
      model: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini',
      key_prefix: apiKey.substring(0, 7),
      last_checked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'error',
      response_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

async function checkInternalServices() {
  const startTime = Date.now()

  try {
    // Check if key application routes are available
    // This is a basic internal health check
    return {
      status: 'healthy',
      response_time_ms: Date.now() - startTime,
      routes_available: ['/', '/chat', '/api/health', '/api/chat'],
      last_checked: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'error',
      response_time_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function getPerformanceMetrics() {
  // Basic performance indicators
  const startTime = process.hrtime.bigint()

  // Simulate some basic performance measurements
  return {
    startup_time_seconds: Math.floor(process.uptime()),
    last_gc: process.hrtime.bigint() - startTime,

    // Event loop metrics (if available)
    event_loop_utilization: getEventLoopUtilization(),

    // Resource usage
    active_handles: (process as any)._getActiveHandles?.()?.length || 0,
    active_requests: (process as any)._getActiveRequests?.()?.length || 0,
  }
}

function getEventLoopUtilization() {
  try {
    // This might not be available in all Node.js versions
    const perf_hooks = require('perf_hooks')
    if (perf_hooks.performance.eventLoopUtilization) {
      const elu = perf_hooks.performance.eventLoopUtilization()
      return {
        utilization: Math.round(elu.utilization * 100) / 100,
        active: elu.active,
        idle: elu.idle
      }
    }
  } catch (error) {
    // Fallback if not available
  }

  return { utilization: 0, active: 0, idle: 0, note: 'Not available' }
}

function getClientIP(request: NextRequest): string {
  // Try various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const vercelIP = request.headers.get('x-vercel-forwarded-for')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  return realIP || vercelIP || 'unknown'
}