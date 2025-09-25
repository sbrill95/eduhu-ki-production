import { writeFile, mkdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import { FILE_UPLOAD_CONFIG } from '@/lib/instant'

// Configuration for file storage
export const STORAGE_CONFIG = {
  // Local storage directory (relative to project root)
  LOCAL_STORAGE_DIR: 'uploads',
  // Base URL for serving files (in production, this might be a CDN URL)
  BASE_FILE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
  // Maximum storage per teacher (in bytes)
  MAX_STORAGE_PER_TEACHER: 1024 * 1024 * 1024, // 1GB
  // Cleanup settings
  TEMP_FILE_TTL_HOURS: 24, // Temporary files expire after 24 hours
  CLEANUP_INTERVAL_HOURS: 6, // Run cleanup every 6 hours
} as const

/**
 * Save file to local storage
 * In production, this would be replaced with cloud storage (S3, CloudFlare R2, etc.)
 */
export async function saveFileToStorage(file: File, filename: string): Promise<string> {
  try {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(process.cwd(), STORAGE_CONFIG.LOCAL_STORAGE_DIR)

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Create subdirectories for organization (by date)
    const today = new Date()
    const yearMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(uploadDir, yearMonth)

    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // Full file path
    const filePath = path.join(targetDir, filename)

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Write file to disk
    await writeFile(filePath, buffer)

    // Return URL for accessing the file
    const fileUrl = `${STORAGE_CONFIG.BASE_FILE_URL}/api/files/${yearMonth}/${filename}`

    console.log(`File saved to storage: ${filePath}`)
    return fileUrl

  } catch (error) {
    console.error('Error saving file to storage:', error)
    throw new Error('Failed to save file to storage')
  }
}

/**
 * Delete file from storage
 */
export async function deleteFileFromStorage(filename: string): Promise<boolean> {
  try {
    // Extract path from filename (assumes it includes the date structure)
    const uploadDir = path.join(process.cwd(), STORAGE_CONFIG.LOCAL_STORAGE_DIR)
    const filePath = path.join(uploadDir, filename)

    // Check if file exists
    try {
      await stat(filePath)
    } catch {
      console.warn(`File not found for deletion: ${filePath}`)
      return false
    }

    // Delete the file
    await unlink(filePath)
    console.log(`File deleted from storage: ${filePath}`)
    return true

  } catch (error) {
    console.error('Error deleting file from storage:', error)
    return false
  }
}

/**
 * Get file information from storage
 */
export async function getFileInfo(filename: string): Promise<FileInfo | null> {
  try {
    const uploadDir = path.join(process.cwd(), STORAGE_CONFIG.LOCAL_STORAGE_DIR)
    const filePath = path.join(uploadDir, filename)

    const stats = await stat(filePath)

    return {
      filename,
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      exists: true
    }

  } catch (error) {
    console.error('Error getting file info:', error)
    return null
  }
}

/**
 * Generate secure filename with timestamp and random component
 */
export function generateSecureFilename(originalFilename: string, teacherId?: string): string {
  const timestamp = Date.now()
  const randomBytes = crypto.randomBytes(8).toString('hex')
  const fileExtension = path.extname(originalFilename)

  // Optional teacher prefix for organization
  const prefix = teacherId ? teacherId.substring(0, 8) : 'file'

  return `${prefix}-${timestamp}-${randomBytes}${fileExtension}`
}

/**
 * Validate file before storage
 */
export function validateFileForStorage(file: File): ValidationResult {
  const errors: string[] = []

  // Check file size
  if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
    errors.push(`File size exceeds maximum allowed size of ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE_MB}MB`)
  }

  // Check file type
  const isValidType = FILE_UPLOAD_CONFIG.ALLOWED_TYPES.some(allowedType => {
    if (allowedType.endsWith('/*')) {
      const baseType = allowedType.slice(0, -2)
      return file.type.startsWith(baseType)
    }
    return file.type === allowedType
  })

  if (!isValidType) {
    errors.push(`File type ${file.type} is not allowed`)
  }

  // Check filename length and characters
  if (file.name.length > 255) {
    errors.push('Filename is too long (maximum 255 characters)')
  }

  // Check for dangerous file extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.vbs', '.js', '.jar', '.com', '.pif']
  const fileExtension = path.extname(file.name).toLowerCase()
  if (dangerousExtensions.includes(fileExtension)) {
    errors.push(`File extension ${fileExtension} is not allowed for security reasons`)
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  }
}

/**
 * Calculate storage usage for a teacher
 */
export async function calculateTeacherStorageUsage(teacherId: string): Promise<StorageUsage> {
  // In a real implementation, this would query the database for all files
  // belonging to the teacher and sum their sizes
  // For now, we'll return a placeholder implementation

  try {
    // This would be replaced with actual database queries
    const mockUsage = {
      totalFiles: 0,
      totalSize: 0,
      percentUsed: 0,
      remainingSpace: STORAGE_CONFIG.MAX_STORAGE_PER_TEACHER
    }

    return mockUsage

  } catch (error) {
    console.error('Error calculating storage usage:', error)
    throw new Error('Failed to calculate storage usage')
  }
}

/**
 * Clean up expired temporary files
 */
export async function cleanupExpiredFiles(): Promise<CleanupResult> {
  console.log('Starting file cleanup process...')

  const result: CleanupResult = {
    filesProcessed: 0,
    filesDeleted: 0,
    spaceReclaimed: 0,
    errors: []
  }

  try {
    // In a real implementation, this would:
    // 1. Query database for files marked as temporary or expired
    // 2. Check if files exist on disk
    // 3. Delete expired files from both storage and database
    // 4. Update statistics

    // For now, return a placeholder result
    console.log('File cleanup completed')
    return result

  } catch (error) {
    console.error('Error during file cleanup:', error)
    result.errors.push(error instanceof Error ? error.message : 'Unknown cleanup error')
    return result
  }
}

/**
 * Create thumbnail storage path
 */
export function createThumbnailPath(originalFilename: string): string {
  const extension = path.extname(originalFilename)
  const baseName = path.basename(originalFilename, extension)
  return `${baseName}_thumb.jpg`
}

/**
 * Save thumbnail to storage
 */
export async function saveThumbnailToStorage(
  thumbnailBuffer: Buffer,
  originalFilename: string
): Promise<string> {
  try {
    const thumbnailFilename = createThumbnailPath(originalFilename)

    // Create thumbnails directory
    const uploadDir = path.join(process.cwd(), STORAGE_CONFIG.LOCAL_STORAGE_DIR, 'thumbnails')

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Create date-based subdirectory
    const today = new Date()
    const yearMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    const targetDir = path.join(uploadDir, yearMonth)

    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    const thumbnailPath = path.join(targetDir, thumbnailFilename)

    // Save thumbnail
    await writeFile(thumbnailPath, thumbnailBuffer)

    // Return URL for accessing the thumbnail
    const thumbnailUrl = `${STORAGE_CONFIG.BASE_FILE_URL}/api/files/thumbnails/${yearMonth}/${thumbnailFilename}`

    console.log(`Thumbnail saved: ${thumbnailPath}`)
    return thumbnailUrl

  } catch (error) {
    console.error('Error saving thumbnail:', error)
    throw new Error('Failed to save thumbnail')
  }
}

/**
 * Get file serving headers based on file type
 */
export function getFileServingHeaders(filename: string, mimeType?: string): HeadersInit {
  const extension = path.extname(filename).toLowerCase()

  // Default headers
  const headers: HeadersInit = {
    'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
  }

  // Set content type if provided
  if (mimeType) {
    headers['Content-Type'] = mimeType
  }

  // Security headers for different file types
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
    headers['Content-Type'] = headers['Content-Type'] || `image/${extension.slice(1)}`
  } else if (extension === '.pdf') {
    headers['Content-Type'] = 'application/pdf'
    headers['Content-Disposition'] = 'inline'
  } else if (['.doc', '.docx'].includes(extension)) {
    headers['Content-Type'] = extension === '.docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/msword'
    headers['Content-Disposition'] = `attachment; filename="${filename}"`
  } else {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`
  }

  // Security headers
  headers['X-Content-Type-Options'] = 'nosniff'
  headers['X-Frame-Options'] = 'DENY'

  return headers
}

/**
 * Storage Factory - Choose between local and cloud storage
 * Priority: R2 > S3 > Local storage
 */
export function createStorageAdapter(): CloudStorageAdapter | null {
  const storageProvider = process.env.STORAGE_PROVIDER?.toLowerCase() || 'local'

  // Explicitly configured storage provider
  if (storageProvider === 'r2') {
    const { R2StorageAdapter } = require('./r2-storage')
    const r2Adapter = new R2StorageAdapter()

    if (r2Adapter.isConfigured()) {
      console.log('Using CloudFlare R2 storage adapter')
      return r2Adapter
    } else {
      console.warn('R2 configured but not properly set up, falling back...')
    }
  }

  if (storageProvider === 's3') {
    const s3Adapter = new S3StorageAdapter()

    if (s3Adapter.isConfigured()) {
      console.log('Using AWS S3 storage adapter')
      return s3Adapter
    } else {
      console.warn('S3 configured but not properly set up, falling back...')
    }
  }

  if (storageProvider === 'local') {
    console.log('Using local storage (development only)')
    return null
  }

  // Auto-detection fallback (backward compatibility)
  // Try R2 first, then S3, then local
  const { R2StorageAdapter } = require('./r2-storage')
  const r2Adapter = new R2StorageAdapter()

  if (r2Adapter.isConfigured()) {
    console.log('Auto-detected CloudFlare R2 storage adapter')
    return r2Adapter
  }

  const s3Adapter = new S3StorageAdapter()

  if (s3Adapter.isConfigured()) {
    console.log('Auto-detected AWS S3 storage adapter')
    return s3Adapter
  }

  // No cloud storage configured - use local storage
  console.log('No cloud storage configured, using local storage')
  return null
}

/**
 * Enhanced file save function that uses cloud storage when available
 */
export async function saveFileToCloudStorage(file: File, filename: string): Promise<string> {
  const storageAdapter = createStorageAdapter()

  if (storageAdapter) {
    // Use cloud storage (S3)
    return await storageAdapter.saveFile(file, filename)
  } else {
    // Fall back to local storage
    return await saveFileToStorage(file, filename)
  }
}

/**
 * Enhanced file deletion that works with both cloud and local storage
 */
export async function deleteFileFromCloudStorage(filename: string): Promise<boolean> {
  const storageAdapter = createStorageAdapter()

  if (storageAdapter) {
    // Use cloud storage (S3)
    return await storageAdapter.deleteFile(filename)
  } else {
    // Fall back to local storage
    return await deleteFileFromStorage(filename)
  }
}

/**
 * Enhanced thumbnail save function for cloud storage
 */
export async function saveThumbnailToCloudStorage(
  thumbnailBuffer: Uint8Array,
  originalFilename: string
): Promise<string> {
  const storageAdapter = createStorageAdapter()

  if (storageAdapter && 'saveThumbnail' in storageAdapter) {
    // Use cloud storage (S3)
    const buffer = Buffer.from(thumbnailBuffer)
    return await (storageAdapter as S3StorageAdapter).saveThumbnail(buffer, originalFilename)
  } else {
    // Fall back to local storage
    const buffer = Buffer.from(thumbnailBuffer)
    return await saveThumbnailToStorage(buffer, originalFilename)
  }
}

/**
 * Get storage type information
 */
export function getStorageInfo(): { type: 'local' | 's3'; configured: boolean; details?: any } {
  const storageAdapter = createStorageAdapter()

  if (storageAdapter) {
    const s3Adapter = storageAdapter as S3StorageAdapter
    return {
      type: 's3',
      configured: true,
      details: s3Adapter.getBucketInfo()
    }
  } else {
    return {
      type: 'local',
      configured: true,
      details: {
        storageDir: STORAGE_CONFIG.LOCAL_STORAGE_DIR,
        baseUrl: STORAGE_CONFIG.BASE_FILE_URL
      }
    }
  }
}

// Type definitions
export interface FileInfo {
  filename: string
  size: number
  createdAt: Date
  modifiedAt: Date
  exists: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors?: string[]
}

export interface StorageUsage {
  totalFiles: number
  totalSize: number
  percentUsed: number
  remainingSpace: number
}

export interface CleanupResult {
  filesProcessed: number
  filesDeleted: number
  spaceReclaimed: number
  errors: string[]
}

// Future: Cloud storage adapter interface
export interface CloudStorageAdapter {
  saveFile(file: File, filename: string): Promise<string>
  deleteFile(filename: string): Promise<boolean>
  getFileInfo(filename: string): Promise<FileInfo | null>
  generateSignedUrl(filename: string, expiresIn?: number): Promise<string>
}

// S3 Storage Configuration
export const S3_CONFIG = {
  BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || 'eduhu-files',
  REGION: process.env.AWS_S3_REGION || 'us-east-1',
  ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  // S3 folder structure
  FOLDERS: {
    UPLOADS: 'uploads',
    THUMBNAILS: 'thumbnails',
    TEMP: 'temp'
  },
  // Signed URL configuration
  SIGNED_URL_EXPIRES_IN: 3600, // 1 hour
  UPLOAD_EXPIRES_IN: 300, // 5 minutes for upload URLs
} as const

// AWS SDK imports
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * S3 Storage Adapter Implementation
 * Provides cloud storage functionality using AWS S3
 */
export class S3StorageAdapter implements CloudStorageAdapter {
  private s3Client: S3Client
  private bucketName: string

  constructor() {
    // Validate required environment variables
    if (!S3_CONFIG.ACCESS_KEY_ID || !S3_CONFIG.SECRET_ACCESS_KEY) {
      console.warn('AWS credentials not found. S3StorageAdapter will not function properly.')
    }

    if (!S3_CONFIG.BUCKET_NAME) {
      console.warn('AWS S3 bucket name not configured.')
    }

    // Initialize S3 client
    this.s3Client = new S3Client({
      region: S3_CONFIG.REGION,
      credentials: {
        accessKeyId: S3_CONFIG.ACCESS_KEY_ID || '',
        secretAccessKey: S3_CONFIG.SECRET_ACCESS_KEY || ''
      }
    })

    this.bucketName = S3_CONFIG.BUCKET_NAME

    // Log initialization in development
    if (process.env.NODE_ENV === 'development') {
      console.log('S3StorageAdapter initialized:', {
        bucket: this.bucketName,
        region: S3_CONFIG.REGION,
        hasCredentials: !!(S3_CONFIG.ACCESS_KEY_ID && S3_CONFIG.SECRET_ACCESS_KEY)
      })
    }
  }

  /**
   * Upload a file to S3 storage
   */
  async saveFile(file: File, filename: string): Promise<string> {
    try {
      const startTime = Date.now()

      // Create S3 key with folder structure
      const s3Key = this.createS3Key(filename, S3_CONFIG.FOLDERS.UPLOADS)

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type,
        ContentLength: file.size,
        Metadata: {
          originalName: file.name,
          uploadedAt: new Date().toISOString(),
          fileSize: file.size.toString()
        },
        // Set appropriate caching headers
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
        // Ensure proper content disposition for downloads
        ContentDisposition: `inline; filename="${file.name}"`
      }

      // Execute upload
      const command = new PutObjectCommand(uploadParams)
      await this.s3Client.send(command)

      // Generate the file URL
      const fileUrl = `https://${this.bucketName}.s3.${S3_CONFIG.REGION}.amazonaws.com/${s3Key}`

      // Log successful upload
      const uploadTime = Date.now() - startTime
      console.log(`File uploaded to S3: ${s3Key} (${uploadTime}ms)`)

      return fileUrl

    } catch (error) {
      console.error('S3 upload error:', error)

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('AccessDenied')) {
          throw new Error('S3 access denied. Please check AWS credentials and bucket permissions.')
        }
        if (error.message.includes('NoSuchBucket')) {
          throw new Error(`S3 bucket '${this.bucketName}' does not exist.`)
        }
        if (error.message.includes('NetworkingError')) {
          throw new Error('Network error during S3 upload. Please check your internet connection.')
        }
      }

      throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a file from S3 storage
   */
  async deleteFile(filename: string): Promise<boolean> {
    try {
      const s3Key = this.createS3Key(filename, S3_CONFIG.FOLDERS.UPLOADS)

      const deleteParams = {
        Bucket: this.bucketName,
        Key: s3Key
      }

      const command = new DeleteObjectCommand(deleteParams)
      await this.s3Client.send(command)

      console.log(`File deleted from S3: ${s3Key}`)
      return true

    } catch (error) {
      console.error('S3 delete error:', error)

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('NoSuchKey')) {
          console.warn(`File not found in S3: ${filename}`)
          return false
        }
        if (error.message.includes('AccessDenied')) {
          throw new Error('S3 access denied for delete operation.')
        }
      }

      // Don't throw for delete operations, just return false
      console.warn(`Failed to delete file from S3: ${filename}`)
      return false
    }
  }

  /**
   * Get file information from S3
   */
  async getFileInfo(filename: string): Promise<FileInfo | null> {
    try {
      const s3Key = this.createS3Key(filename, S3_CONFIG.FOLDERS.UPLOADS)

      const headParams = {
        Bucket: this.bucketName,
        Key: s3Key
      }

      const command = new HeadObjectCommand(headParams)
      const response = await this.s3Client.send(command)

      if (!response.ContentLength || !response.LastModified) {
        return null
      }

      return {
        filename,
        size: response.ContentLength,
        createdAt: response.LastModified,
        modifiedAt: response.LastModified,
        exists: true
      }

    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null
      }

      console.error('S3 getFileInfo error:', error)
      return null
    }
  }

  /**
   * Generate a signed URL for secure file access
   */
  async generateSignedUrl(filename: string, expiresIn = S3_CONFIG.SIGNED_URL_EXPIRES_IN): Promise<string> {
    try {
      const s3Key = this.createS3Key(filename, S3_CONFIG.FOLDERS.UPLOADS)

      const getParams = {
        Bucket: this.bucketName,
        Key: s3Key
      }

      const command = new GetObjectCommand(getParams)
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn })

      return signedUrl

    } catch (error) {
      console.error('S3 signed URL generation error:', error)
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate a presigned URL for direct upload from client
   */
  async generatePresignedUploadUrl(filename: string, fileType: string, expiresIn = S3_CONFIG.UPLOAD_EXPIRES_IN): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    try {
      const s3Key = this.createS3Key(filename, S3_CONFIG.FOLDERS.UPLOADS)

      const putParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        ContentType: fileType
      }

      const command = new PutObjectCommand(putParams)
      const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn })

      // Generate the final file URL
      const fileUrl = `https://${this.bucketName}.s3.${S3_CONFIG.REGION}.amazonaws.com/${s3Key}`

      return {
        uploadUrl,
        fileUrl,
        key: s3Key
      }

    } catch (error) {
      console.error('S3 presigned upload URL generation error:', error)
      throw new Error(`Failed to generate presigned upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Save thumbnail to S3
   */
  async saveThumbnail(thumbnailBuffer: Buffer, originalFilename: string): Promise<string> {
    try {
      const thumbnailFilename = createThumbnailPath(originalFilename)
      const s3Key = this.createS3Key(thumbnailFilename, S3_CONFIG.FOLDERS.THUMBNAILS)

      const uploadParams = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        ContentLength: thumbnailBuffer.length,
        CacheControl: 'public, max-age=31536000', // Cache for 1 year
        Metadata: {
          originalFilename,
          type: 'thumbnail',
          generatedAt: new Date().toISOString()
        }
      }

      const command = new PutObjectCommand(uploadParams)
      await this.s3Client.send(command)

      const thumbnailUrl = `https://${this.bucketName}.s3.${S3_CONFIG.REGION}.amazonaws.com/${s3Key}`
      console.log(`Thumbnail uploaded to S3: ${s3Key}`)

      return thumbnailUrl

    } catch (error) {
      console.error('S3 thumbnail upload error:', error)
      throw new Error(`Failed to upload thumbnail to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create S3 key with proper folder structure and date organization
   */
  private createS3Key(filename: string, folder: string): string {
    const today = new Date()
    const yearMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    return `${folder}/${yearMonth}/${filename}`
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return !!(
      S3_CONFIG.ACCESS_KEY_ID &&
      S3_CONFIG.SECRET_ACCESS_KEY &&
      S3_CONFIG.BUCKET_NAME
    )
  }

  /**
   * Get bucket information
   */
  getBucketInfo(): { bucket: string; region: string; configured: boolean } {
    return {
      bucket: this.bucketName,
      region: S3_CONFIG.REGION,
      configured: this.isConfigured()
    }
  }
}