import { NextRequest, NextResponse } from 'next/server'

// Health check endpoint for monitoring and deployment validation
export async function GET(request: NextRequest) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'development',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: await checkInstantDB(),
      ai: checkOpenAI(),
      memory: getMemoryUsage(),
    },
    uptime: process.uptime(),
    deployment: {
      region: process.env.VERCEL_REGION || 'local',
      url: process.env.VERCEL_URL || 'localhost'
    }
  }

  // Return appropriate status code based on service health
  const statusCode = health.services.database.status === 'healthy' &&
                     health.services.ai.status === 'healthy' ? 200 : 503

  return NextResponse.json(health, { status: statusCode })
}

async function checkInstantDB() {
  try {
    // Check if InstantDB app ID is configured
    const appId = process.env.NEXT_PUBLIC_INSTANTDB_APP_ID
    if (!appId || appId === 'your-instantdb-app-id-here') {
      return {
        status: 'unhealthy',
        error: 'InstantDB app ID not configured'
      }
    }

    // Basic connectivity check - just validate the app ID format
    const appIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!appIdRegex.test(appId)) {
      return {
        status: 'unhealthy',
        error: 'Invalid InstantDB app ID format'
      }
    }

    return {
      status: 'healthy',
      appId: appId.substring(0, 8) + '...' // Partial ID for security
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function checkOpenAI() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      return {
        status: 'unhealthy',
        error: 'OpenAI API key not configured'
      }
    }

    return {
      status: 'healthy',
      model: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-4o-mini',
      keyPrefix: apiKey.substring(0, 7) + '...' // First 7 chars for verification
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage()
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024), // MB
  }
}