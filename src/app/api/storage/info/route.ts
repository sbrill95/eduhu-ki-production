import { NextRequest, NextResponse } from 'next/server'
import { getStorageInfo } from '@/lib/file-storage'
import { MONITORING_CONFIG } from '@/lib/storage-monitoring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/storage/info
 * Returns comprehensive information about the current storage configuration
 */
export async function GET(request: NextRequest) {
  try {
    const storageInfo = getStorageInfo()

    // Additional runtime information
    const runtimeInfo = {
      nodeEnv: process.env.NODE_ENV,
      storageProvider: process.env.STORAGE_PROVIDER || 'auto-detect',
      monitoringEnabled: MONITORING_CONFIG.ENABLED,
      analyticsEnabled: MONITORING_CONFIG.ANALYTICS_ENABLED,
    }

    // Combine information
    const info = {
      success: true,
      timestamp: new Date().toISOString(),
      provider: storageInfo.type,
      configured: storageInfo.configured,
      details: storageInfo.details,
      runtime: runtimeInfo,
      capabilities: {
        upload: true,
        download: true,
        delete: true,
        signedUrls: storageInfo.type !== 'local',
        thumbnails: true,
        monitoring: MONITORING_CONFIG.ENABLED,
        analytics: MONITORING_CONFIG.ANALYTICS_ENABLED,
      },
      limits: {
        maxFileSize: process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10MB',
        maxFilesPerTeacher: process.env.NEXT_PUBLIC_MAX_FILES_PER_TEACHER || '100',
        maxStoragePerTeacher: process.env.MAX_STORAGE_PER_TEACHER_GB || '2GB',
      },
      // Legacy format for backward compatibility
      storage: storageInfo,
      environment: process.env.NODE_ENV,
    }

    return NextResponse.json(info, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })

  } catch (error) {
    console.error('Storage info API error:', error)

    return NextResponse.json(
      {
        error: 'Failed to get storage information',
        code: 'STORAGE_INFO_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/storage/info
 * Test storage connection and configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { test } = body

    if (test) {
      // Perform basic storage configuration test
      const storageInfo = getStorageInfo()

      const testResult = {
        timestamp: new Date().toISOString(),
        success: storageInfo.configured,
        provider: storageInfo.type,
        message: storageInfo.configured ?
          `${storageInfo.type} storage adapter is configured and ready` :
          `${storageInfo.type} storage adapter configuration incomplete`,
        details: storageInfo.details
      }

      return NextResponse.json(testResult, {
        status: testResult.success ? 200 : 500
      })
    }

    return NextResponse.json(
      { error: 'Invalid test request' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Storage connection test error:', error)

    return NextResponse.json(
      {
        success: false,
        message: `Storage test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}