import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { CloudStorageAdapter, FileInfo, createThumbnailPath } from './file-storage'

// CloudFlare R2 Configuration
export const R2_CONFIG = {
  ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  BUCKET_NAME: process.env.R2_BUCKET_NAME || 'eduhu-files',
  ENDPOINT: process.env.R2_ENDPOINT,
  // R2 folder structure
  FOLDERS: {
    UPLOADS: 'uploads',
    THUMBNAILS: 'thumbnails',
    TEMP: 'temp'
  },
  // Signed URL configuration
  SIGNED_URL_EXPIRES_IN: 3600, // 1 hour
  UPLOAD_EXPIRES_IN: 300, // 5 minutes for upload URLs
} as const

/**
 * CloudFlare R2 Storage Adapter Implementation
 * Provides cloud storage functionality using CloudFlare R2 (S3-compatible)
 */
export class R2StorageAdapter implements CloudStorageAdapter {
  private r2Client: S3Client
  private bucketName: string
  private accountId: string

  constructor() {
    // Validate required environment variables
    if (!R2_CONFIG.ACCESS_KEY_ID || !R2_CONFIG.SECRET_ACCESS_KEY) {
      console.warn('CloudFlare R2 credentials not found. R2StorageAdapter will not function properly.')
    }

    if (!R2_CONFIG.BUCKET_NAME) {
      console.warn('CloudFlare R2 bucket name not configured.')
    }

    if (!R2_CONFIG.ACCOUNT_ID) {
      console.warn('CloudFlare R2 account ID not configured.')
    }

    this.accountId = R2_CONFIG.ACCOUNT_ID || ''
    this.bucketName = R2_CONFIG.BUCKET_NAME

    // Initialize R2 client (S3-compatible)
    this.r2Client = new S3Client({
      region: 'auto', // R2 uses 'auto' as region
      endpoint: R2_CONFIG.ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_CONFIG.ACCESS_KEY_ID || '',
        secretAccessKey: R2_CONFIG.SECRET_ACCESS_KEY || ''
      },
      // R2 specific configuration
      forcePathStyle: false,
    })

    // Log initialization in development
    if (process.env.NODE_ENV === 'development') {
      console.log('R2StorageAdapter initialized:', {
        bucket: this.bucketName,
        accountId: this.accountId,
        endpoint: R2_CONFIG.ENDPOINT,
        hasCredentials: !!(R2_CONFIG.ACCESS_KEY_ID && R2_CONFIG.SECRET_ACCESS_KEY)
      })
    }
  }

  /**
   * Upload a file to R2 storage
   */
  async saveFile(file: File, filename: string): Promise<string> {
    try {
      const startTime = Date.now()

      // Create R2 key with folder structure
      const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Prepare upload parameters
      const uploadParams = {
        Bucket: this.bucketName,
        Key: r2Key,
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
      await this.r2Client.send(command)

      // Generate the file URL (R2 public URL format)
      const fileUrl = `https://pub-${this.bucketName}.r2.dev/${r2Key}`

      // Log successful upload
      const uploadTime = Date.now() - startTime
      console.log(`File uploaded to R2: ${r2Key} (${uploadTime}ms)`)

      return fileUrl

    } catch (error) {
      console.error('R2 upload error:', error)

      // Provide specific error messages
      if (error instanceof Error) {
        if (error.message.includes('AccessDenied') || error.message.includes('Forbidden')) {
          throw new Error('R2 access denied. Please check CloudFlare R2 credentials and bucket permissions.')
        }
        if (error.message.includes('NoSuchBucket')) {
          throw new Error(`R2 bucket '${this.bucketName}' does not exist.`)
        }
        if (error.message.includes('NetworkingError') || error.message.includes('network')) {
          throw new Error('Network error during R2 upload. Please check your internet connection.')
        }
      }

      throw new Error(`Failed to upload file to R2: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Delete a file from R2 storage
   */
  async deleteFile(filename: string): Promise<boolean> {
    try {
      const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)

      const deleteParams = {
        Bucket: this.bucketName,
        Key: r2Key
      }

      const command = new DeleteObjectCommand(deleteParams)
      await this.r2Client.send(command)

      console.log(`File deleted from R2: ${r2Key}`)
      return true

    } catch (error) {
      console.error('R2 delete error:', error)

      // Handle specific errors
      if (error instanceof Error) {
        if (error.message.includes('NoSuchKey')) {
          console.warn(`File not found in R2: ${filename}`)
          return false
        }
        if (error.message.includes('AccessDenied') || error.message.includes('Forbidden')) {
          throw new Error('R2 access denied for delete operation.')
        }
      }

      // Don't throw for delete operations, just return false
      console.warn(`Failed to delete file from R2: ${filename}`)
      return false
    }
  }

  /**
   * Get file information from R2
   */
  async getFileInfo(filename: string): Promise<FileInfo | null> {
    try {
      const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)

      const headParams = {
        Bucket: this.bucketName,
        Key: r2Key
      }

      const command = new HeadObjectCommand(headParams)
      const response = await this.r2Client.send(command)

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
      if (error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) {
        return null
      }

      console.error('R2 getFileInfo error:', error)
      return null
    }
  }

  /**
   * Generate a signed URL for secure file access
   * Note: R2 signed URLs work similarly to S3
   */
  async generateSignedUrl(filename: string, expiresIn = R2_CONFIG.SIGNED_URL_EXPIRES_IN): Promise<string> {
    try {
      const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)

      const getParams = {
        Bucket: this.bucketName,
        Key: r2Key
      }

      const command = new GetObjectCommand(getParams)
      const signedUrl = await getSignedUrl(this.r2Client, command, { expiresIn })

      return signedUrl

    } catch (error) {
      console.error('R2 signed URL generation error:', error)
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate a presigned URL for direct upload from client
   */
  async generatePresignedUploadUrl(filename: string, fileType: string, expiresIn = R2_CONFIG.UPLOAD_EXPIRES_IN): Promise<{ uploadUrl: string; fileUrl: string; key: string }> {
    try {
      const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)

      const putParams = {
        Bucket: this.bucketName,
        Key: r2Key,
        ContentType: fileType
      }

      const command = new PutObjectCommand(putParams)
      const uploadUrl = await getSignedUrl(this.r2Client, command, { expiresIn })

      // Generate the final file URL (using R2 public URL format)
      const fileUrl = `https://pub-${this.bucketName}.r2.dev/${r2Key}`

      return {
        uploadUrl,
        fileUrl,
        key: r2Key
      }

    } catch (error) {
      console.error('R2 presigned upload URL generation error:', error)
      throw new Error(`Failed to generate presigned upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Save thumbnail to R2
   */
  async saveThumbnail(thumbnailBuffer: Buffer, originalFilename: string): Promise<string> {
    try {
      const thumbnailFilename = createThumbnailPath(originalFilename)
      const r2Key = this.createR2Key(thumbnailFilename, R2_CONFIG.FOLDERS.THUMBNAILS)

      const uploadParams = {
        Bucket: this.bucketName,
        Key: r2Key,
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
      await this.r2Client.send(command)

      const thumbnailUrl = `https://pub-${this.bucketName}.r2.dev/${r2Key}`
      console.log(`Thumbnail uploaded to R2: ${r2Key}`)

      return thumbnailUrl

    } catch (error) {
      console.error('R2 thumbnail upload error:', error)
      throw new Error(`Failed to upload thumbnail to R2: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create R2 key with proper folder structure and date organization
   */
  private createR2Key(filename: string, folder: string): string {
    const today = new Date()
    const yearMonth = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}`
    return `${folder}/${yearMonth}/${filename}`
  }

  /**
   * Check if the adapter is properly configured
   */
  isConfigured(): boolean {
    return !!(
      R2_CONFIG.ACCESS_KEY_ID &&
      R2_CONFIG.SECRET_ACCESS_KEY &&
      R2_CONFIG.BUCKET_NAME &&
      R2_CONFIG.ACCOUNT_ID
    )
  }

  /**
   * Get bucket information
   */
  getBucketInfo(): { bucket: string; accountId: string; endpoint: string; configured: boolean } {
    return {
      bucket: this.bucketName,
      accountId: this.accountId,
      endpoint: R2_CONFIG.ENDPOINT || `https://${this.accountId}.r2.cloudflarestorage.com`,
      configured: this.isConfigured()
    }
  }

  /**
   * Get R2-specific public URL for a file
   */
  getPublicUrl(filename: string): string {
    const r2Key = this.createR2Key(filename, R2_CONFIG.FOLDERS.UPLOADS)
    return `https://pub-${this.bucketName}.r2.dev/${r2Key}`
  }

  /**
   * Test R2 connection and permissions
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      // Try to list bucket contents (limited to 1 object)
      const listParams = {
        Bucket: this.bucketName,
        MaxKeys: 1
      }

      // Note: R2 uses the same S3 client, so ListObjects command would work
      // For now, we'll test with a simple head-bucket equivalent
      const headParams = {
        Bucket: this.bucketName,
        Key: 'test-connection'
      }

      const command = new HeadObjectCommand(headParams)

      try {
        await this.r2Client.send(command)
        return {
          success: true,
          message: 'R2 connection successful',
          details: this.getBucketInfo()
        }
      } catch (headError) {
        // If we get NoSuchKey error, it means the bucket exists and we have access
        if (headError instanceof Error && headError.name === 'NoSuchKey') {
          return {
            success: true,
            message: 'R2 connection successful (bucket accessible)',
            details: this.getBucketInfo()
          }
        }
        throw headError
      }

    } catch (error) {
      console.error('R2 connection test failed:', error)
      return {
        success: false,
        message: `R2 connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: this.getBucketInfo()
      }
    }
  }
}