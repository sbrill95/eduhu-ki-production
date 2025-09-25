import {
  saveFileToCloudStorage,
  getStorageInfo,
  deleteFileFromStorage,
  createStorageAdapter,
  S3StorageAdapter,
  getFileServingHeaders,
  STORAGE_CONFIG
} from './file-storage'

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

describe('File Storage', () => {
  const mockS3Send = jest.fn()
  const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock S3Client
    S3Client.mockImplementation(() => ({
      send: mockS3Send
    }))

    // Setup default successful mocks
    mockS3Send.mockResolvedValue({
      ETag: '"test-etag"',
      Location: 'https://bucket.s3.amazonaws.com/test-file.pdf'
    })

    mockGetSignedUrl.mockResolvedValue('https://presigned-url.com/test-file.pdf')

    // Mock environment variables
    process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
    process.env.AWS_REGION = 'us-east-1'
    process.env.STORAGE_TYPE = 's3'
  })

  afterEach(() => {
    delete process.env.AWS_S3_BUCKET_NAME
    delete process.env.AWS_REGION
    delete process.env.STORAGE_TYPE
  })

  describe('S3StorageAdapter', () => {
    let adapter: S3StorageAdapter

    beforeEach(() => {
      adapter = new S3StorageAdapter('test-bucket', 'us-east-1')
    })

    it('should upload file to S3', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const key = '2024/01/test.pdf'

      const result = await adapter.uploadFile(file, key)

      expect(result).toEqual({
        key,
        url: 'https://presigned-url.com/test-file.pdf',
        etag: '"test-etag"'
      })
      expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutObjectCommand))
      expect(mockGetSignedUrl).toHaveBeenCalled()
    })

    it('should get file from S3', async () => {
      const mockStream = new ReadableStream()
      mockS3Send.mockResolvedValue({
        Body: mockStream,
        ContentType: 'application/pdf',
        ContentLength: 1024,
        LastModified: new Date()
      })

      const key = '2024/01/test.pdf'
      const result = await adapter.getFile(key)

      expect(result.stream).toBe(mockStream)
      expect(result.metadata.contentType).toBe('application/pdf')
      expect(result.metadata.size).toBe(1024)
      expect(mockS3Send).toHaveBeenCalledWith(expect.any(GetObjectCommand))
    })

    it('should delete file from S3', async () => {
      const key = '2024/01/test.pdf'

      await adapter.deleteFile(key)

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand))
    })

    it('should handle S3 upload errors', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 upload failed'))

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const key = '2024/01/test.pdf'

      await expect(adapter.uploadFile(file, key)).rejects.toThrow('S3 upload failed')
    })

    it('should generate presigned URLs for private files', async () => {
      const key = '2024/01/private.pdf'

      const url = await adapter.getPresignedUrl(key, 3600)

      expect(url).toBe('https://presigned-url.com/test-file.pdf')
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.any(S3Client),
        expect.any(GetObjectCommand),
        { expiresIn: 3600 }
      )
    })
  })

  describe('createStorageAdapter', () => {
    it('should create S3 adapter when configured', () => {
      process.env.STORAGE_TYPE = 's3'
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'
      process.env.AWS_REGION = 'us-east-1'

      const adapter = createStorageAdapter()

      expect(adapter).toBeInstanceOf(S3StorageAdapter)
    })

    it('should throw error for missing S3 configuration', () => {
      process.env.STORAGE_TYPE = 's3'
      delete process.env.AWS_S3_BUCKET_NAME

      expect(() => createStorageAdapter()).toThrow(
        'AWS_S3_BUCKET_NAME is required for S3 storage'
      )
    })

    it('should create local adapter when configured', () => {
      process.env.STORAGE_TYPE = 'local'
      process.env.LOCAL_STORAGE_PATH = '/uploads'

      const adapter = createStorageAdapter()

      expect(adapter).toBeDefined()
      // LocalStorageAdapter should be created
    })
  })

  describe('saveFileToCloudStorage', () => {
    it('should save file using storage adapter', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const teacherId = 'teacher-123'

      const result = await saveFileToCloudStorage(file, teacherId)

      expect(result).toHaveProperty('key')
      expect(result).toHaveProperty('url')
      expect(result.key).toMatch(/^\d{4}\/\d{2}\/teacher-123\//)
      expect(result.key).toContain('test.pdf')
    })

    it('should generate unique keys for duplicate filenames', async () => {
      const file1 = new File(['content 1'], 'test.pdf', { type: 'application/pdf' })
      const file2 = new File(['content 2'], 'test.pdf', { type: 'application/pdf' })
      const teacherId = 'teacher-123'

      const result1 = await saveFileToCloudStorage(file1, teacherId)
      const result2 = await saveFileToCloudStorage(file2, teacherId)

      expect(result1.key).not.toBe(result2.key)
    })

    it('should sanitize filenames', async () => {
      const file = new File(['test content'], 'test file with spaces & symbols!.pdf', {
        type: 'application/pdf'
      })
      const teacherId = 'teacher-123'

      const result = await saveFileToCloudStorage(file, teacherId)

      expect(result.key).not.toContain(' ')
      expect(result.key).not.toContain('&')
      expect(result.key).not.toContain('!')
    })

    it('should organize files by date and teacher', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const teacherId = 'teacher-123'
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')

      const result = await saveFileToCloudStorage(file, teacherId)

      expect(result.key).toMatch(new RegExp(`^${year}/${month}/teacher-123/`))
    })
  })

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      const info = await getStorageInfo()

      expect(info).toHaveProperty('type')
      expect(info).toHaveProperty('available')
      expect(info).toHaveProperty('configuration')
    })

    it('should indicate S3 availability', async () => {
      process.env.STORAGE_TYPE = 's3'
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'

      const info = await getStorageInfo()

      expect(info.type).toBe('s3')
      expect(info.available).toBe(true)
      expect(info.configuration.bucket).toBe('test-bucket')
    })

    it('should handle storage configuration errors', async () => {
      process.env.STORAGE_TYPE = 's3'
      delete process.env.AWS_S3_BUCKET_NAME

      const info = await getStorageInfo()

      expect(info.available).toBe(false)
      expect(info.error).toContain('AWS_S3_BUCKET_NAME is required')
    })
  })

  describe('deleteFileFromStorage', () => {
    it('should delete file using storage adapter', async () => {
      const key = '2024/01/teacher-123/test.pdf'

      await deleteFileFromStorage(key)

      expect(mockS3Send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand))
    })

    it('should handle deletion errors gracefully', async () => {
      mockS3Send.mockRejectedValue(new Error('File not found'))

      const key = '2024/01/teacher-123/nonexistent.pdf'

      await expect(deleteFileFromStorage(key)).rejects.toThrow('File not found')
    })
  })

  describe('getFileServingHeaders', () => {
    it('should return correct headers for PDF files', () => {
      const headers = getFileServingHeaders('document.pdf', 1024, new Date())

      expect(headers['Content-Type']).toBe('application/pdf')
      expect(headers['Content-Length']).toBe('1024')
      expect(headers['Cache-Control']).toContain('public')
      expect(headers['ETag']).toBeTruthy()
    })

    it('should return correct headers for image files', () => {
      const headers = getFileServingHeaders('image.jpg', 2048, new Date())

      expect(headers['Content-Type']).toBe('image/jpeg')
      expect(headers['Content-Length']).toBe('2048')
    })

    it('should handle unknown file types', () => {
      const headers = getFileServingHeaders('unknown.xyz', 512, new Date())

      expect(headers['Content-Type']).toBe('application/octet-stream')
    })

    it('should include security headers', () => {
      const headers = getFileServingHeaders('document.pdf', 1024, new Date())

      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
    })

    it('should set appropriate cache headers', () => {
      const lastModified = new Date('2024-01-01')
      const headers = getFileServingHeaders('document.pdf', 1024, lastModified)

      expect(headers['Last-Modified']).toBe(lastModified.toUTCString())
      expect(headers['Cache-Control']).toMatch(/max-age=\d+/)
    })
  })

  describe('File Processing and Validation', () => {
    it('should validate file types', async () => {
      const invalidFile = new File(['content'], 'virus.exe', { type: 'application/x-executable' })
      const teacherId = 'teacher-123'

      await expect(saveFileToCloudStorage(invalidFile, teacherId)).rejects.toThrow(
        'File type not allowed'
      )
    })

    it('should validate file sizes', async () => {
      const largeContent = 'x'.repeat(51 * 1024 * 1024) // 51MB
      const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      const teacherId = 'teacher-123'

      await expect(saveFileToCloudStorage(largeFile, teacherId)).rejects.toThrow(
        'File size exceeds maximum allowed'
      )
    })

    it('should handle concurrent uploads', async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        new File([`content ${i}`], `file-${i}.pdf`, { type: 'application/pdf' })
      )
      const teacherId = 'teacher-123'

      const promises = files.map(file => saveFileToCloudStorage(file, teacherId))
      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach(result => {
        expect(result).toHaveProperty('key')
        expect(result).toHaveProperty('url')
      })
    })
  })

  describe('Storage Configuration', () => {
    it('should use correct storage configuration', () => {
      expect(STORAGE_CONFIG).toHaveProperty('MAX_FILE_SIZE_MB')
      expect(STORAGE_CONFIG).toHaveProperty('ALLOWED_MIME_TYPES')
      expect(STORAGE_CONFIG).toHaveProperty('CACHE_MAX_AGE')
    })

    it('should validate storage environment variables', () => {
      delete process.env.AWS_S3_BUCKET_NAME
      delete process.env.AWS_REGION

      expect(() => createStorageAdapter()).toThrow()
    })
  })
})