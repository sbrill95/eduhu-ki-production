/**
 * @jest-environment node
 */

// Mock AWS SDK before importing anything else
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn()
}))

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://test-signed-url.com')
}))

import {
  S3StorageAdapter,
  createStorageAdapter,
  getStorageInfo,
  saveFileToStorage,
  deleteFileFromStorage,
  validateFileForStorage,
  generateSecureFilename,
  createThumbnailPath,
  getFileServingHeaders,
  calculateTeacherStorageUsage,
  cleanupExpiredFiles,
  STORAGE_CONFIG
} from '../file-storage'

describe('File Storage System', () => {
  describe('S3StorageAdapter', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should initialize with proper configuration', () => {
      const adapter = new S3StorageAdapter()
      expect(adapter).toBeInstanceOf(S3StorageAdapter)
    })

    it('should detect configuration status correctly', () => {
      // Mock environment variables
      const originalEnv = process.env

      // Test with missing credentials
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const adapter = new S3StorageAdapter()
      expect(adapter.isConfigured()).toBe(false)

      // Test with complete credentials
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const configuredAdapter = new S3StorageAdapter()
      expect(configuredAdapter.isConfigured()).toBe(true)

      // Restore environment
      process.env = originalEnv
    })

    it('should return correct bucket info', () => {
      const originalEnv = process.env

      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket',
        AWS_S3_REGION: 'us-west-2'
      }

      const adapter = new S3StorageAdapter()
      const bucketInfo = adapter.getBucketInfo()

      expect(bucketInfo).toEqual({
        bucket: 'test-bucket',
        region: 'us-west-2',
        configured: true
      })

      process.env = originalEnv
    })

    it('should create S3 key with proper folder structure', () => {
      const adapter = new S3StorageAdapter()

      // Access private method through type assertion
      const createS3Key = (adapter as any).createS3Key.bind(adapter)
      const key = createS3Key('test-file.jpg', 'uploads')

      expect(key).toMatch(/^uploads\/\d{4}\/\d{2}\/test-file\.jpg$/)
    })
  })

  describe('Storage Factory', () => {
    it('should return S3 adapter when configured', () => {
      const originalEnv = process.env

      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const adapter = createStorageAdapter()
      expect(adapter).toBeInstanceOf(S3StorageAdapter)

      process.env = originalEnv
    })

    it('should return null when S3 not configured', () => {
      const originalEnv = process.env

      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        AWS_S3_BUCKET_NAME: undefined
      }

      const adapter = createStorageAdapter()
      expect(adapter).toBeNull()

      process.env = originalEnv
    })
  })

  describe('Storage Info', () => {
    it('should return S3 info when configured', () => {
      const originalEnv = process.env

      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket',
        AWS_S3_REGION: 'us-east-1'
      }

      const info = getStorageInfo()
      expect(info.type).toBe('s3')
      expect(info.configured).toBe(true)
      expect(info.details.bucket).toBe('test-bucket')

      process.env = originalEnv
    })

    it('should return local info when S3 not configured', () => {
      const originalEnv = process.env

      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        AWS_S3_BUCKET_NAME: undefined
      }

      const info = getStorageInfo()
      expect(info.type).toBe('local')
      expect(info.configured).toBe(true)
      expect(info.details.storageDir).toBe('uploads')

      process.env = originalEnv
    })
  })
})

describe('File Validation', () => {
  beforeEach(() => {
    // Mock FILE_UPLOAD_CONFIG
    jest.doMock('../instant', () => ({
      FILE_UPLOAD_CONFIG: {
        MAX_FILE_SIZE_MB: 10,
        ALLOWED_TYPES: ['text/plain', 'image/*', 'application/pdf']
      }
    }))
  })

  it('should validate acceptable files', () => {
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })

    const result = validateFileForStorage(file)

    expect(result.isValid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('should reject files with dangerous extensions', () => {
    const file = new File(['malicious'], 'virus.exe', { type: 'application/octet-stream' })

    const result = validateFileForStorage(file)

    expect(result.isValid).toBe(false)
    expect(result.errors).toContain('File extension .exe is not allowed for security reasons')
  })

  it('should reject oversized files', () => {
    // Create a large file (> 10MB mock limit)
    const largeContent = 'x'.repeat(11 * 1024 * 1024)
    const file = new File([largeContent], 'large.txt', { type: 'text/plain' })

    const result = validateFileForStorage(file)

    expect(result.isValid).toBe(false)
    expect(result.errors?.[0]).toContain('File size exceeds maximum')
  })
})

describe('Utility Functions', () => {
  describe('generateSecureFilename', () => {
    it('should generate secure filename with timestamp', () => {
      const result = generateSecureFilename('test.txt', 'teacher123')

      expect(result).toMatch(/^teacher12-\d{13}-[a-f0-9]{16}\.txt$/)
    })

    it('should use default prefix when no teacherId provided', () => {
      const result = generateSecureFilename('document.pdf')

      expect(result).toMatch(/^file-\d{13}-[a-f0-9]{16}\.pdf$/)
    })

    it('should preserve file extension', () => {
      const result = generateSecureFilename('image.png', 'teacher')

      expect(result.endsWith('.png')).toBe(true)
    })
  })

  describe('createThumbnailPath', () => {
    it('should create thumbnail path with _thumb suffix', () => {
      expect(createThumbnailPath('image.jpg')).toBe('image_thumb.jpg')
    })

    it('should handle files without extension', () => {
      expect(createThumbnailPath('image')).toBe('image_thumb.jpg')
    })
  })

  describe('getFileServingHeaders', () => {
    it('should return appropriate headers for images', () => {
      const headers = getFileServingHeaders('image.jpg', 'image/jpeg')

      expect(headers['Content-Type']).toBe('image/jpeg')
      expect(headers['Cache-Control']).toBe('public, max-age=31536000')
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('should set inline disposition for PDFs', () => {
      const headers = getFileServingHeaders('document.pdf', 'application/pdf')

      expect(headers['Content-Type']).toBe('application/pdf')
      expect(headers['Content-Disposition']).toBe('inline')
    })

    it('should set attachment disposition for Word documents', () => {
      const headers = getFileServingHeaders('document.docx')

      expect(headers['Content-Type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      expect(headers['Content-Disposition']).toBe('attachment; filename="document.docx"')
    })
  })

  describe('calculateTeacherStorageUsage', () => {
    it('should return mock storage usage data', async () => {
      const result = await calculateTeacherStorageUsage('teacher123')

      expect(result).toEqual({
        totalFiles: 0,
        totalSize: 0,
        percentUsed: 0,
        remainingSpace: STORAGE_CONFIG.MAX_STORAGE_PER_TEACHER
      })
    })
  })

  describe('cleanupExpiredFiles', () => {
    it('should return cleanup results', async () => {
      const result = await cleanupExpiredFiles()

      expect(result).toEqual({
        filesProcessed: 0,
        filesDeleted: 0,
        spaceReclaimed: 0,
        errors: []
      })
    })
  })
})

describe('File Storage Integration', () => {
  it('should handle file upload workflow', async () => {
    // This would be an integration test with actual file upload
    // For now, just test that the functions exist and can be imported
    const { saveFileToCloudStorage, deleteFileFromCloudStorage } = require('../file-storage')

    expect(typeof saveFileToCloudStorage).toBe('function')
    expect(typeof deleteFileFromCloudStorage).toBe('function')
  })
})