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

describe('Additional Storage Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('saveFileToStorage', () => {
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

    // Mock fs/promises functions
    const mockMkdir = jest.fn().mockResolvedValue(undefined)
    const mockWriteFile = jest.fn().mockResolvedValue(undefined)
    const mockExistsSync = jest.fn().mockReturnValue(false)

    beforeEach(() => {
      jest.doMock('fs/promises', () => ({
        mkdir: mockMkdir,
        writeFile: mockWriteFile,
        unlink: jest.fn(),
        stat: jest.fn()
      }))
      jest.doMock('fs', () => ({
        existsSync: mockExistsSync
      }))
    })

    it('should create directories and save file', async () => {
      const { saveFileToStorage } = require('../file-storage')

      const result = await saveFileToStorage(mockFile, 'secure-filename.txt')

      expect(result).toMatch(/\/api\/files\/\d{4}\/\d{2}\/secure-filename\.txt$/)
      expect(mockMkdir).toHaveBeenCalled()
      expect(mockWriteFile).toHaveBeenCalled()
    })

    it('should handle existing directories', async () => {
      mockExistsSync.mockReturnValue(true)
      const { saveFileToStorage } = require('../file-storage')

      const result = await saveFileToStorage(mockFile, 'test-file.txt')

      expect(result).toContain('/api/files/')
    })

    it('should handle file save errors', async () => {
      mockWriteFile.mockRejectedValue(new Error('Disk full'))
      const { saveFileToStorage } = require('../file-storage')

      await expect(saveFileToStorage(mockFile, 'test.txt'))
        .rejects.toThrow('Failed to save file to storage')
    })
  })

  describe('deleteFileFromStorage', () => {
    const mockStat = jest.fn()
    const mockUnlink = jest.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      jest.doMock('fs/promises', () => ({
        stat: mockStat,
        unlink: mockUnlink,
        mkdir: jest.fn(),
        writeFile: jest.fn()
      }))
    })

    it('should successfully delete existing file', async () => {
      mockStat.mockResolvedValue({ size: 1024 })
      const { deleteFileFromStorage } = require('../file-storage')

      const result = await deleteFileFromStorage('2024/01/test-file.txt')

      expect(result).toBe(true)
      expect(mockUnlink).toHaveBeenCalled()
    })

    it('should return false for non-existent file', async () => {
      mockStat.mockRejectedValue(new Error('File not found'))
      const { deleteFileFromStorage } = require('../file-storage')

      const result = await deleteFileFromStorage('missing-file.txt')

      expect(result).toBe(false)
    })

    it('should handle delete errors gracefully', async () => {
      mockStat.mockResolvedValue({ size: 1024 })
      mockUnlink.mockRejectedValue(new Error('Permission denied'))
      const { deleteFileFromStorage } = require('../file-storage')

      const result = await deleteFileFromStorage('protected-file.txt')

      expect(result).toBe(false)
    })
  })

  describe('getFileInfo', () => {
    const mockStat = jest.fn()

    beforeEach(() => {
      jest.doMock('fs/promises', () => ({
        stat: mockStat,
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn()
      }))
    })

    it('should return file information', async () => {
      const mockStats = {
        size: 2048,
        birthtime: new Date('2024-01-01'),
        mtime: new Date('2024-01-02')
      }
      mockStat.mockResolvedValue(mockStats)

      const { getFileInfo } = require('../file-storage')
      const result = await getFileInfo('test-file.txt')

      expect(result).toEqual({
        filename: 'test-file.txt',
        size: 2048,
        createdAt: mockStats.birthtime,
        modifiedAt: mockStats.mtime,
        exists: true
      })
    })

    it('should return null for non-existent file', async () => {
      mockStat.mockRejectedValue(new Error('File not found'))

      const { getFileInfo } = require('../file-storage')
      const result = await getFileInfo('missing.txt')

      expect(result).toBeNull()
    })
  })

  describe('saveThumbnailToStorage', () => {
    const mockMkdir = jest.fn().mockResolvedValue(undefined)
    const mockWriteFile = jest.fn().mockResolvedValue(undefined)
    const mockExistsSync = jest.fn().mockReturnValue(false)

    beforeEach(() => {
      jest.doMock('fs/promises', () => ({
        mkdir: mockMkdir,
        writeFile: mockWriteFile,
        unlink: jest.fn(),
        stat: jest.fn()
      }))
      jest.doMock('fs', () => ({
        existsSync: mockExistsSync
      }))
    })

    it('should save thumbnail with correct path structure', async () => {
      const thumbnailBuffer = Buffer.from('fake thumbnail data')
      const { saveThumbnailToStorage } = require('../file-storage')

      const result = await saveThumbnailToStorage(thumbnailBuffer, 'original-image.jpg')

      expect(result).toContain('/api/files/thumbnails/')
      expect(result).toContain('original-image_thumb.jpg')
      expect(mockMkdir).toHaveBeenCalled()
      expect(mockWriteFile).toHaveBeenCalledWith(
        expect.any(String),
        thumbnailBuffer
      )
    })

    it('should handle thumbnail save errors', async () => {
      mockWriteFile.mockRejectedValue(new Error('Disk error'))

      const thumbnailBuffer = Buffer.from('thumbnail')
      const { saveThumbnailToStorage } = require('../file-storage')

      await expect(saveThumbnailToStorage(thumbnailBuffer, 'image.png'))
        .rejects.toThrow('Failed to save thumbnail')
    })
  })
})

describe('S3StorageAdapter Advanced Tests', () => {
  let adapter: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup environment for configured S3
    const originalEnv = process.env
    process.env = {
      ...originalEnv,
      AWS_ACCESS_KEY_ID: 'test-key-id',
      AWS_SECRET_ACCESS_KEY: 'test-secret',
      AWS_S3_BUCKET_NAME: 'test-bucket',
      AWS_S3_REGION: 'us-west-2'
    }

    const { S3StorageAdapter } = require('../file-storage')
    adapter = new S3StorageAdapter()
  })

  describe('saveFile', () => {
    it('should upload file with proper S3 parameters', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const mockSend = jest.fn().mockResolvedValue({})

      adapter.s3Client = { send: mockSend }
      adapter.bucketName = 'test-bucket'

      const result = await adapter.saveFile(mockFile, 'secure-file.txt')

      expect(result).toContain('s3.us-west-2.amazonaws.com')
      expect(mockSend).toHaveBeenCalled()
    })

    it('should handle S3 access denied errors', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const accessError = new Error('AccessDenied')
      const mockSend = jest.fn().mockRejectedValue(accessError)

      adapter.s3Client = { send: mockSend }

      await expect(adapter.saveFile(mockFile, 'test.txt'))
        .rejects.toThrow('S3 access denied')
    })

    it('should handle bucket not found errors', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const bucketError = new Error('NoSuchBucket')
      const mockSend = jest.fn().mockRejectedValue(bucketError)

      adapter.s3Client = { send: mockSend }

      await expect(adapter.saveFile(mockFile, 'test.txt'))
        .rejects.toThrow('does not exist')
    })

    it('should handle network errors', async () => {
      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const networkError = new Error('NetworkingError')
      const mockSend = jest.fn().mockRejectedValue(networkError)

      adapter.s3Client = { send: mockSend }

      await expect(adapter.saveFile(mockFile, 'test.txt'))
        .rejects.toThrow('Network error during S3 upload')
    })
  })

  describe('deleteFile', () => {
    it('should delete file successfully', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      adapter.s3Client = { send: mockSend }

      const result = await adapter.deleteFile('test-file.txt')

      expect(result).toBe(true)
      expect(mockSend).toHaveBeenCalled()
    })

    it('should return false for non-existent file', async () => {
      const notFoundError = new Error('NoSuchKey')
      const mockSend = jest.fn().mockRejectedValue(notFoundError)
      adapter.s3Client = { send: mockSend }

      const result = await adapter.deleteFile('missing.txt')

      expect(result).toBe(false)
    })

    it('should handle access denied on delete', async () => {
      const accessError = new Error('AccessDenied')
      const mockSend = jest.fn().mockRejectedValue(accessError)
      adapter.s3Client = { send: mockSend }

      await expect(adapter.deleteFile('test.txt'))
        .rejects.toThrow('S3 access denied for delete operation')
    })
  })

  describe('getFileInfo', () => {
    it('should return file information', async () => {
      const mockResponse = {
        ContentLength: 1024,
        LastModified: new Date('2024-01-01')
      }
      const mockSend = jest.fn().mockResolvedValue(mockResponse)
      adapter.s3Client = { send: mockSend }

      const result = await adapter.getFileInfo('test.txt')

      expect(result).toEqual({
        filename: 'test.txt',
        size: 1024,
        createdAt: mockResponse.LastModified,
        modifiedAt: mockResponse.LastModified,
        exists: true
      })
    })

    it('should return null for not found file', async () => {
      const notFoundError = new Error('NotFound')
      notFoundError.name = 'NotFound'
      const mockSend = jest.fn().mockRejectedValue(notFoundError)
      adapter.s3Client = { send: mockSend }

      const result = await adapter.getFileInfo('missing.txt')

      expect(result).toBeNull()
    })
  })

  describe('generateSignedUrl', () => {
    it('should generate valid signed URL', async () => {
      // Mock the getSignedUrl function
      const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed-url.com')
      jest.doMock('@aws-sdk/s3-request-presigner', () => ({
        getSignedUrl: mockGetSignedUrl
      }))

      const result = await adapter.generateSignedUrl('test.txt', 3600)

      expect(result).toBe('https://signed-url.com')
    })

    it('should handle signed URL generation errors', async () => {
      const mockGetSignedUrl = jest.fn().mockRejectedValue(new Error('URL generation failed'))
      jest.doMock('@aws-sdk/s3-request-presigner', () => ({
        getSignedUrl: mockGetSignedUrl
      }))

      await expect(adapter.generateSignedUrl('test.txt'))
        .rejects.toThrow('Failed to generate signed URL')
    })
  })

  describe('generatePresignedUploadUrl', () => {
    it('should generate upload URL and file URL', async () => {
      const mockGetSignedUrl = jest.fn().mockResolvedValue('https://upload-url.com')
      jest.doMock('@aws-sdk/s3-request-presigner', () => ({
        getSignedUrl: mockGetSignedUrl
      }))

      const result = await adapter.generatePresignedUploadUrl('test.txt', 'text/plain')

      expect(result.uploadUrl).toBe('https://upload-url.com')
      expect(result.fileUrl).toContain('s3.us-west-2.amazonaws.com')
      expect(result.key).toContain('test.txt')
    })
  })

  describe('saveThumbnail', () => {
    it('should save thumbnail to S3', async () => {
      const mockSend = jest.fn().mockResolvedValue({})
      adapter.s3Client = { send: mockSend }
      adapter.bucketName = 'test-bucket'

      const thumbnailBuffer = Buffer.from('thumbnail data')
      const result = await adapter.saveThumbnail(thumbnailBuffer, 'image.jpg')

      expect(result).toContain('s3.us-west-2.amazonaws.com')
      expect(result).toContain('thumbnails/')
      expect(mockSend).toHaveBeenCalled()
    })

    it('should handle thumbnail save errors', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('S3 error'))
      adapter.s3Client = { send: mockSend }

      const thumbnailBuffer = Buffer.from('data')
      await expect(adapter.saveThumbnail(thumbnailBuffer, 'image.jpg'))
        .rejects.toThrow('Failed to upload thumbnail to S3')
    })
  })
})

describe('Cloud Storage Integration Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('saveFileToCloudStorage', () => {
    it('should use S3 adapter when configured', async () => {
      // Mock configured S3 environment
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const { saveFileToCloudStorage } = require('../file-storage')

      // This would use the S3 adapter
      await expect(saveFileToCloudStorage(mockFile, 'test.txt')).resolves.toBeDefined()

      process.env = originalEnv
    })

    it('should fall back to local storage when S3 not configured', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
        AWS_S3_BUCKET_NAME: undefined
      }

      // Mock fs functions for local storage
      jest.doMock('fs/promises', () => ({
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined)
      }))
      jest.doMock('fs', () => ({
        existsSync: jest.fn().mockReturnValue(false)
      }))

      const mockFile = new File(['content'], 'test.txt', { type: 'text/plain' })
      const { saveFileToCloudStorage } = require('../file-storage')

      const result = await saveFileToCloudStorage(mockFile, 'test.txt')
      expect(result).toContain('/api/files/')

      process.env = originalEnv
    })
  })

  describe('deleteFileFromCloudStorage', () => {
    it('should use S3 adapter when configured', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const { deleteFileFromCloudStorage } = require('../file-storage')

      await expect(deleteFileFromCloudStorage('test.txt')).resolves.toBeDefined()

      process.env = originalEnv
    })
  })

  describe('saveThumbnailToCloudStorage', () => {
    it('should use S3 adapter for thumbnails when configured', async () => {
      const originalEnv = process.env
      process.env = {
        ...originalEnv,
        AWS_ACCESS_KEY_ID: 'test-key',
        AWS_SECRET_ACCESS_KEY: 'test-secret',
        AWS_S3_BUCKET_NAME: 'test-bucket'
      }

      const thumbnailData = new Uint8Array([1, 2, 3, 4])
      const { saveThumbnailToCloudStorage } = require('../file-storage')

      await expect(saveThumbnailToCloudStorage(thumbnailData, 'image.jpg')).resolves.toBeDefined()

      process.env = originalEnv
    })
  })
})