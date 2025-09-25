import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock the dependencies
jest.mock('@/lib/instant', () => ({
  db: {
    transact: jest.fn(),
    query: jest.fn()
  },
  FILE_UPLOAD_CONFIG: {
    MAX_FILE_SIZE_MB: 50,
    ALLOWED_TYPES: ['image/*', 'application/pdf', 'text/*', 'application/msword'],
    THUMBNAIL_SIZE: { width: 200, height: 200 },
    PROCESSING_QUEUE_SIZE: 50
  }
}))

jest.mock('@/lib/file-processing', () => ({
  processFile: jest.fn()
}))

jest.mock('@/lib/file-storage', () => ({
  saveFileToCloudStorage: jest.fn(),
  getStorageInfo: jest.fn()
}))

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123')
}))

describe('Upload API Route', () => {
  const mockProcessFile = require('@/lib/file-processing').processFile
  const mockSaveFileToCloudStorage = require('@/lib/file-storage').saveFileToCloudStorage
  const mockDbTransact = require('@/lib/instant').db.transact

  beforeEach(() => {
    jest.clearAllMocks()
    // Setup default successful mocks
    mockProcessFile.mockResolvedValue({
      content: 'processed file content',
      metadata: { pageCount: 5, wordCount: 1000 }
    })
    mockSaveFileToCloudStorage.mockResolvedValue({
      key: 'uploads/2024/01/mock-file.pdf',
      url: 'https://storage.example.com/mock-file.pdf',
      size: 1024
    })
    mockDbTransact.mockResolvedValue({})
  })

  describe('POST /api/upload', () => {
    it('should successfully upload a valid file', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')
      formData.append('sessionId', 'session-456')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('id')
      expect(data).toHaveProperty('url')
      expect(data.filename).toBe('test.pdf')
      expect(data.fileType).toBe('application/pdf')
      expect(data.teacherId).toBe('teacher-123')
      expect(data.sessionId).toBe('session-456')

      expect(mockProcessFile).toHaveBeenCalledWith(file, {
        extractText: true,
        generateThumbnail: true
      })
      expect(mockSaveFileToCloudStorage).toHaveBeenCalled()
      expect(mockDbTransact).toHaveBeenCalled()
    })

    it('should return 400 when no file is provided', async () => {
      const formData = new FormData()
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No file provided')
      expect(data.code).toBe('NO_FILE')
    })

    it('should return 400 when no teacherId is provided', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Teacher ID required')
      expect(data.code).toBe('NO_TEACHER_ID')
    })

    it('should return 413 when file size exceeds limit', async () => {
      // Create a mock large file
      const largeContent = 'x'.repeat(51 * 1024 * 1024) // 51MB
      const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(413)
      expect(data.error).toContain('File size exceeds maximum allowed size')
      expect(data.code).toBe('FILE_TOO_LARGE')
      expect(data.maxSize).toBe(50)
    })

    it('should handle file processing errors', async () => {
      mockProcessFile.mockRejectedValue(new Error('Processing failed'))

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('File processing failed')
      expect(data.code).toBe('PROCESSING_ERROR')
    })

    it('should handle storage errors', async () => {
      mockSaveFileToCloudStorage.mockRejectedValue(new Error('Storage failed'))

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('File storage failed')
      expect(data.code).toBe('STORAGE_ERROR')
    })

    it('should handle database transaction errors', async () => {
      mockDbTransact.mockRejectedValue(new Error('Database error'))

      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Database operation failed')
      expect(data.code).toBe('DATABASE_ERROR')
    })

    it('should upload different file types successfully', async () => {
      const fileTypes = [
        { content: 'image content', name: 'test.jpg', type: 'image/jpeg' },
        { content: 'text content', name: 'test.txt', type: 'text/plain' },
        { content: 'word content', name: 'test.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      ]

      for (const fileType of fileTypes) {
        const file = new File([fileType.content], fileType.name, { type: fileType.type })
        const formData = new FormData()
        formData.append('file', file)
        formData.append('teacherId', 'teacher-123')

        const request = new NextRequest('http://localhost:3000/api/upload', {
          method: 'POST',
          body: formData
        })

        const response = await POST(request)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.filename).toBe(fileType.name)
        expect(data.fileType).toBe(fileType.type)
      }
    })

    it('should include optional sessionId and messageId in response', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')
      formData.append('sessionId', 'session-456')
      formData.append('messageId', 'message-789')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.sessionId).toBe('session-456')
      expect(data.messageId).toBe('message-789')
    })

    it('should include performance metrics in response', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' })
      const formData = new FormData()
      formData.append('file', file)
      formData.append('teacherId', 'teacher-123')

      const request = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('processingTime')
      expect(typeof data.processingTime).toBe('number')
      expect(data.processingTime).toBeGreaterThan(0)
    })
  })
})