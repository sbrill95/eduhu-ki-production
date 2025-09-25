import { NextRequest, NextResponse } from 'next/server'
import { db, FILE_UPLOAD_CONFIG, type FileUpload } from '@/lib/instant'
import { processFile } from '@/lib/file-processing'
import { saveFileToCloudStorage, getStorageInfo } from '@/lib/file-storage'
import crypto from 'crypto'

export const runtime = 'nodejs' // Required for file processing
export const dynamic = 'force-dynamic'

// Maximum file size validation
const MAX_FILE_SIZE = FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024 // Convert to bytes

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const teacherId = formData.get('teacherId') as string
    const sessionId = formData.get('sessionId') as string | null
    const messageId = formData.get('messageId') as string | null

    // Validate required parameters
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', code: 'NO_FILE' },
        { status: 400 }
      )
    }

    if (!teacherId) {
      return NextResponse.json(
        { error: 'Teacher ID required', code: 'NO_TEACHER_ID' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum allowed size of ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB`,
          code: 'FILE_TOO_LARGE',
          maxSize: FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB
        },
        { status: 413 }
      )
    }

    // Validate file type
    const isValidType = FILE_UPLOAD_CONFIG.ALLOWED_TYPES.some(allowedType => {
      if (allowedType.endsWith('/*')) {
        const baseType = allowedType.slice(0, -2)
        return file.type.startsWith(baseType)
      }
      return file.type === allowedType
    })

    if (!isValidType) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          code: 'INVALID_FILE_TYPE',
          allowedTypes: FILE_UPLOAD_CONFIG.ALLOWED_TYPES
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || ''
    const timestamp = Date.now()
    const randomId = crypto.randomBytes(16).toString('hex')
    const uniqueFilename = `${timestamp}-${randomId}.${fileExtension}`

    try {
      // Get storage info for logging
      const storageInfo = getStorageInfo()
      console.log(`Using ${storageInfo.type} storage for file upload: ${uniqueFilename}`)

      // Save file to storage (cloud-first with local fallback)
      const fileUrl = await saveFileToCloudStorage(file, uniqueFilename)

      // Create file upload record in database
      const fileUploadData = {
        teacher_id: teacherId,
        session_id: sessionId || undefined,
        message_id: messageId || undefined,
        filename: uniqueFilename,
        original_filename: file.name,
        file_type: file.type,
        file_size: file.size,
        file_url: fileUrl,
        created_at: timestamp,
        processing_status: 'pending',
        metadata: {
          uploadTime: Date.now() - startTime,
          userAgent: request.headers.get('user-agent') || undefined
        }
      }

      // Generate unique file upload ID
      const fileUploadId = crypto.randomUUID()

      // Insert to database using InstantDB
      const result = await db.transact([
        db.tx.file_uploads[fileUploadId].update(fileUploadData)
      ])

      // Check if transaction succeeded (InstantDB 0.21+ doesn't return {data, error})
      if (!result) {
        console.error('Database transaction failed for file upload')
        throw new Error('Failed to save file metadata to database')
      }

      // Start file processing asynchronously (don't await)
      processFileAsync(fileUploadId, file, fileUrl, teacherId)
        .catch(error => {
          console.error('Async file processing failed:', error)
        })

      // Return success response
      const response: FileUploadResponse = {
        success: true,
        fileId: fileUploadId,
        filename: uniqueFilename,
        originalFilename: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: fileUrl,
        processingStatus: 'pending',
        uploadTime: Date.now() - startTime
      }

      return NextResponse.json(response, { status: 201 })

    } catch (storageError) {
      console.error('File storage error:', storageError)
      return NextResponse.json(
        {
          error: 'Failed to store file',
          code: 'STORAGE_ERROR'
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Upload API error:', error)

    // Handle specific errors
    if (error instanceof Error) {
      if (error.message.includes('FormData')) {
        return NextResponse.json(
          { error: 'Invalid form data', code: 'INVALID_FORM_DATA' },
          { status: 400 }
        )
      }

      if (error.message.includes('size')) {
        return NextResponse.json(
          { error: 'File size validation error', code: 'SIZE_ERROR' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Upload failed',
        code: 'UPLOAD_ERROR'
      },
      { status: 500 }
    )
  }
}

// Async function to process file without blocking response
async function processFileAsync(
  fileId: string,
  file: File,
  fileUrl: string,
  teacherId: string
): Promise<void> {
  try {
    console.log(`Starting async processing for file ${fileId}`)

    // Process the file (extract text, generate thumbnails, etc.)
    const processingResult = await processFile(file, fileUrl)

    // Update database with processing results
    const updateData: Partial<FileUpload> = {
      processed_at: Date.now(),
      processing_status: processingResult.success ? 'completed' : 'failed',
      extracted_text: processingResult.extractedText,
      thumbnail_url: processingResult.thumbnailUrl,
      metadata: {
        ...processingResult.metadata,
        processingErrors: processingResult.processingErrors
      }
    }

    const result = await db.transact([
      db.tx.file_uploads[fileId].update(updateData)
    ])

    if (result) {
      console.log(`File processing completed for ${fileId}:`, {
        success: processingResult.success,
        hasExtractedText: !!processingResult.extractedText,
        hasThumbnail: !!processingResult.thumbnailUrl
      })
    } else {
      console.error('Failed to update file processing status for:', fileId)
    }

  } catch (processingError) {
    console.error('File processing error:', processingError)

    // Update database to mark processing as failed
    try {
      await db.transact([
        db.tx.file_uploads[fileId].update({
          processed_at: Date.now(),
          processing_status: 'failed',
          metadata: {
            processingErrors: [processingError instanceof Error ? processingError.message : 'Unknown error']
          }
        })
      ])
    } catch (updateError) {
      console.error('Failed to update failed processing status:', updateError)
    }
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

// Type definitions
export interface FileUploadResponse {
  success: boolean
  fileId: string
  filename: string
  originalFilename: string
  fileType: string
  fileSize: number
  fileUrl: string
  processingStatus: 'pending' | 'completed' | 'failed'
  uploadTime: number
  thumbnailUrl?: string
  extractedText?: string
}

export interface FileUploadError {
  error: string
  code: string
  maxSize?: number
  allowedTypes?: string[]
}