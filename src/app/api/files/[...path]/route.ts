import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import {
  getFileServingHeaders,
  STORAGE_CONFIG,
  createStorageAdapter,
  S3StorageAdapter
} from '@/lib/file-storage'
import { db } from '@/lib/instant'
import { validateSessionAccess } from '@/lib/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = Date.now()
  let teacherId: string | null = null
  let fileRecord: any = null

  try {
    // Await params in Next.js 15
    const resolvedParams = await params
    // Construct file path from URL parameters
    const filePath = resolvedParams.path.join('/')

    if (!filePath) {
      return NextResponse.json(
        { error: 'File path required' },
        { status: 400 }
      )
    }

    // Security: Prevent path traversal attacks
    if (filePath.includes('..') || filePath.includes('~')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      )
    }

    // Extract authentication from request headers or query parameters
    const authHeader = request.headers.get('authorization')
    const teacherIdParam = request.nextUrl.searchParams.get('teacherId')
    const sessionIdParam = request.nextUrl.searchParams.get('sessionId')

    // For now, use teacherId from query param (in production, extract from JWT)
    teacherId = teacherIdParam

    // If session is provided, validate access
    if (sessionIdParam && teacherId) {
      const hasSessionAccess = await validateSessionAccess(sessionIdParam, teacherId)
      if (!hasSessionAccess) {
        console.warn(`Unauthorized session access attempt: ${teacherId} -> ${sessionIdParam}`)
        return NextResponse.json(
          { error: 'Unauthorized access to session' },
          { status: 403 }
        )
      }
    }

    // Try to find file record in database for security validation
    try {
      const fileQuery = await db.query({
        file_uploads: {
          $: {
            where: {
              filename: filePath.split('/').pop() || filePath
            }
          }
        }
      })

      fileRecord = fileQuery.file_uploads?.[0]

      // If file record exists, validate ownership
      if (fileRecord && teacherId && fileRecord.teacher_id !== teacherId) {
        console.warn(`File access denied: ${teacherId} attempted to access file owned by ${fileRecord.teacher_id}`)
        return NextResponse.json(
          { error: 'File access denied' },
          { status: 403 }
        )
      }
    } catch (dbError) {
      console.warn('Could not validate file ownership from database:', dbError)
      // Continue with file serving but log the issue
    }

    // Determine if this is a thumbnail request
    const isThumbnail = filePath.startsWith('thumbnails/')
    const actualPath = isThumbnail
      ? filePath.replace('thumbnails/', '')
      : filePath

    // Initialize storage adapter for S3 fallback
    const storageAdapter = createStorageAdapter()
    let fileBuffer: Buffer
    let fileStats: { size: number; mtime?: Date; birthtime?: Date }
    let mimeType = 'application/octet-stream'
    const filename = path.basename(actualPath)

    // Try local storage first (for development)
    const uploadDir = path.join(
      process.cwd(),
      STORAGE_CONFIG.LOCAL_STORAGE_DIR,
      isThumbnail ? 'thumbnails' : '',
      actualPath
    )

    let servedFromLocal = false
    let servedFromS3 = false

    try {
      // Try local storage first
      try {
        const localFileStats = await stat(uploadDir)

        if (!localFileStats.isFile()) {
          throw new Error('Path is not a file')
        }

        fileBuffer = await readFile(uploadDir)
        fileStats = {
          size: localFileStats.size,
          mtime: localFileStats.mtime,
          birthtime: localFileStats.birthtime
        }
        servedFromLocal = true
        console.log(`File served from local storage: ${filePath}`)

      } catch (localError) {
        // File not found locally, try S3 if configured
        if (storageAdapter && storageAdapter instanceof S3StorageAdapter) {
          console.log(`File not found locally, trying S3: ${filePath}`)

          try {
            // For S3, we need to get the file directly
            const signedUrl = await storageAdapter.generateSignedUrl(actualPath)

            // Fetch file from S3 using signed URL
            const s3Response = await fetch(signedUrl)
            if (!s3Response.ok) {
              throw new Error(`S3 fetch failed: ${s3Response.status}`)
            }

            const arrayBuffer = await s3Response.arrayBuffer()
            fileBuffer = Buffer.from(arrayBuffer)

            // Get file info from S3
            const s3FileInfo = await storageAdapter.getFileInfo(actualPath)
            if (s3FileInfo) {
              fileStats = {
                size: s3FileInfo.size,
                mtime: s3FileInfo.modifiedAt,
                birthtime: s3FileInfo.createdAt
              }
            } else {
              fileStats = { size: fileBuffer.length }
            }

            servedFromS3 = true
            console.log(`File served from S3: ${filePath}`)

          } catch (s3Error) {
            console.error('S3 file access failed:', s3Error)
            throw new Error('File not found in both local storage and S3')
          }
        } else {
          // No S3 configured, re-throw local error
          throw localError
        }
      }

      // Determine MIME type from file extension
      const extension = path.extname(actualPath).toLowerCase()

      switch (extension) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg'
          break
        case '.png':
          mimeType = 'image/png'
          break
        case '.gif':
          mimeType = 'image/gif'
          break
        case '.webp':
          mimeType = 'image/webp'
          break
        case '.pdf':
          mimeType = 'application/pdf'
          break
        case '.doc':
          mimeType = 'application/msword'
          break
        case '.docx':
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          break
        case '.txt':
          mimeType = 'text/plain'
          break
        case '.csv':
          mimeType = 'text/csv'
          break
        case '.md':
          mimeType = 'text/markdown'
          break
      }

      // Get appropriate headers for file type
      const headers = getFileServingHeaders(filename, mimeType) as Record<string, string>

      // Add file size header
      headers['Content-Length'] = fileStats.size.toString()

      // Add metadata headers for debugging
      headers['X-Served-From'] = servedFromLocal ? 'local' : (servedFromS3 ? 's3' : 'unknown')
      headers['X-File-Path'] = filePath

      // Log successful file access for analytics
      if (teacherId && fileRecord) {
        try {
          const analyticsId = crypto.randomUUID ? crypto.randomUUID() : `analytics_${Date.now()}`
          await db.transact([
            db.tx.usage_analytics[analyticsId].update({
              teacher_id: teacherId,
              event_type: 'file_access',
              timestamp: Date.now(),
              session_id: sessionIdParam || undefined,
              metadata: {
                file_id: fileRecord.id,
                filename: fileRecord.filename,
                file_path: filePath,
                served_from: servedFromLocal ? 'local' : (servedFromS3 ? 's3' : 'unknown'),
                file_size: fileStats.size,
                is_thumbnail: isThumbnail,
                response_time_ms: Date.now() - startTime
              },
              duration_ms: Date.now() - startTime,
              feature_used: 'file_serving'
            })
          ])
        } catch (analyticsError) {
          console.warn('Failed to log file access analytics:', analyticsError)
        }
      }

      // Return file with appropriate headers
      return new NextResponse(fileBuffer as unknown as BodyInit, {
        status: 200,
        headers
      })

    } catch (fileError) {
      console.error('File serving error:', fileError)

      // Log failed access attempt for security monitoring
      if (teacherId) {
        try {
          const analyticsId = crypto.randomUUID ? crypto.randomUUID() : `analytics_${Date.now()}`
          await db.transact([
            db.tx.usage_analytics[analyticsId].update({
              teacher_id: teacherId,
              event_type: 'file_access_failed',
              timestamp: Date.now(),
              session_id: sessionIdParam || undefined,
              metadata: {
                file_path: filePath,
                error_message: fileError instanceof Error ? fileError.message : 'Unknown error',
                response_time_ms: Date.now() - startTime
              },
              duration_ms: Date.now() - startTime,
              feature_used: 'file_serving'
            })
          ])
        } catch (analyticsError) {
          console.warn('Failed to log failed file access analytics:', analyticsError)
        }
      }

      // Check specific error types
      if ((fileError as NodeJS.ErrnoException).code === 'ENOENT' ||
          (fileError instanceof Error && fileError.message.includes('not found'))) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        )
      }

      if (fileError instanceof Error && fileError.message.includes('access denied')) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }

      // Generic error without exposing internal details
      return NextResponse.json(
        { error: 'File access failed' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('File serving error:', error)

    // Log system error for monitoring
    if (teacherId) {
      try {
        const analyticsId = crypto.randomUUID ? crypto.randomUUID() : `analytics_${Date.now()}`
        await db.transact([
          db.tx.usage_analytics[analyticsId].update({
            teacher_id: teacherId,
            event_type: 'file_serving_error',
            timestamp: Date.now(),
            metadata: {
              error_message: error instanceof Error ? error.message : 'Unknown system error',
              response_time_ms: Date.now() - startTime
            },
            duration_ms: Date.now() - startTime,
            feature_used: 'file_serving'
          })
        ])
      } catch (analyticsError) {
        console.warn('Failed to log system error analytics:', analyticsError)
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Enhanced HEAD request handler with S3 support
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startTime = Date.now()
  let teacherId: string | null = null

  try {
    // Await params in Next.js 15
    const resolvedParams = await params
    const filePath = resolvedParams.path.join('/')

    if (!filePath) {
      return new NextResponse(null, { status: 400 })
    }

    // Security: Prevent path traversal attacks
    if (filePath.includes('..') || filePath.includes('~')) {
      return new NextResponse(null, { status: 400 })
    }

    // Extract authentication parameters
    const teacherIdParam = request.nextUrl.searchParams.get('teacherId')
    const sessionIdParam = request.nextUrl.searchParams.get('sessionId')
    teacherId = teacherIdParam

    // Validate session access if provided
    if (sessionIdParam && teacherId) {
      const hasSessionAccess = await validateSessionAccess(sessionIdParam, teacherId)
      if (!hasSessionAccess) {
        return new NextResponse(null, { status: 403 })
      }
    }

    const isThumbnail = filePath.startsWith('thumbnails/')
    const actualPath = isThumbnail
      ? filePath.replace('thumbnails/', '')
      : filePath

    // Initialize storage adapter
    const storageAdapter = createStorageAdapter()
    let fileStats: { size: number; mtime?: Date; birthtime?: Date }
    let servedFromLocal = false
    let servedFromS3 = false

    // Try local storage first
    const uploadDir = path.join(
      process.cwd(),
      STORAGE_CONFIG.LOCAL_STORAGE_DIR,
      isThumbnail ? 'thumbnails' : '',
      actualPath
    )

    try {
      try {
        const localFileStats = await stat(uploadDir)

        if (!localFileStats.isFile()) {
          throw new Error('Path is not a file')
        }

        fileStats = {
          size: localFileStats.size,
          mtime: localFileStats.mtime,
          birthtime: localFileStats.birthtime
        }
        servedFromLocal = true

      } catch (localError) {
        // Try S3 if configured
        if (storageAdapter && storageAdapter instanceof S3StorageAdapter) {
          const s3FileInfo = await storageAdapter.getFileInfo(actualPath)
          if (s3FileInfo) {
            fileStats = {
              size: s3FileInfo.size,
              mtime: s3FileInfo.modifiedAt,
              birthtime: s3FileInfo.createdAt
            }
            servedFromS3 = true
          } else {
            throw new Error('File not found in S3')
          }
        } else {
          throw localError
        }
      }

      const filename = path.basename(actualPath)
      const extension = path.extname(actualPath).toLowerCase()

      // Determine MIME type
      let mimeType = 'application/octet-stream'
      switch (extension) {
        case '.jpg':
        case '.jpeg':
          mimeType = 'image/jpeg'
          break
        case '.png':
          mimeType = 'image/png'
          break
        case '.gif':
          mimeType = 'image/gif'
          break
        case '.webp':
          mimeType = 'image/webp'
          break
        case '.pdf':
          mimeType = 'application/pdf'
          break
        case '.doc':
          mimeType = 'application/msword'
          break
        case '.docx':
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          break
        case '.txt':
          mimeType = 'text/plain'
          break
        case '.csv':
          mimeType = 'text/csv'
          break
        case '.md':
          mimeType = 'text/markdown'
          break
      }

      const headers = getFileServingHeaders(filename, mimeType) as Record<string, string>
      headers['Content-Length'] = fileStats.size.toString()
      headers['X-Served-From'] = servedFromLocal ? 'local' : (servedFromS3 ? 's3' : 'unknown')
      headers['X-File-Path'] = filePath

      return new NextResponse(null, {
        status: 200,
        headers
      })

    } catch (fileError) {
      if ((fileError as NodeJS.ErrnoException).code === 'ENOENT' ||
          (fileError instanceof Error && fileError.message.includes('not found'))) {
        return new NextResponse(null, { status: 404 })
      }

      return new NextResponse(null, { status: 500 })
    }

  } catch (error) {
    console.error('HEAD request error:', error)
    return new NextResponse(null, { status: 500 })
  }
}