import { NextRequest } from 'next/server'
import { GET } from './route'

// Mock the dependencies
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  stat: jest.fn()
}))

jest.mock('path', () => ({
  join: jest.fn(),
  resolve: jest.fn(),
  normalize: jest.fn()
}))

jest.mock('@/lib/file-storage', () => ({
  getFileServingHeaders: jest.fn(),
  STORAGE_CONFIG: {
    STORAGE_TYPE: 'local',
    LOCAL_STORAGE_PATH: '/uploads',
    CACHE_MAX_AGE: 3600
  },
  createStorageAdapter: jest.fn(),
  S3StorageAdapter: jest.fn()
}))

jest.mock('@/lib/instant', () => ({
  db: {
    query: jest.fn()
  }
}))

jest.mock('@/lib/database', () => ({
  validateSessionAccess: jest.fn()
}))

describe('Files API Route', () => {
  const mockReadFile = require('fs/promises').readFile
  const mockStat = require('fs/promises').stat
  const mockGetFileServingHeaders = require('@/lib/file-storage').getFileServingHeaders
  const mockCreateStorageAdapter = require('@/lib/file-storage').createStorageAdapter
  const mockDbQuery = require('@/lib/instant').db.query
  const mockValidateSessionAccess = require('@/lib/database').validateSessionAccess

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default successful mocks
    mockStat.mockResolvedValue({
      size: 1024,
      mtime: new Date(),
      isFile: () => true,
      isDirectory: () => false
    })
    mockReadFile.mockResolvedValue(Buffer.from('file content'))
    mockGetFileServingHeaders.mockReturnValue({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'public, max-age=3600',
      'ETag': 'test-etag'
    })
    mockValidateSessionAccess.mockResolvedValue(true)
    mockDbQuery.mockResolvedValue({ data: { file_uploads: [] } })

    // Mock storage adapter
    const mockAdapter = {
      getFile: jest.fn().mockResolvedValue({
        stream: new ReadableStream(),
        metadata: {
          size: 1024,
          contentType: 'application/pdf',
          lastModified: new Date()
        }
      })
    }
    mockCreateStorageAdapter.mockReturnValue(mockAdapter)
  })

  describe('GET /api/files/[...path]', () => {
    it('should successfully serve a file', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(mockGetFileServingHeaders).toHaveBeenCalled()
    })

    it('should return 400 for empty file path', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/')

      const response = await GET(request, {
        params: { path: [] }
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('File path required')
    })

    it('should prevent path traversal attacks', async () => {
      const maliciousPaths = [
        ['..', '..', 'etc', 'passwd'],
        ['~', 'sensitive-file.txt'],
        ['uploads', '..', '..', 'config.json']
      ]

      for (const maliciousPath of maliciousPaths) {
        const filePath = maliciousPath.join('/')
        const request = new NextRequest(`http://localhost:3000/api/files/${filePath}`)

        const response = await GET(request, {
          params: { path: maliciousPath }
        })

        expect(response.status).toBe(400)
        const data = await response.json()
        expect(data.error).toBe('Invalid file path')
      }
    })

    it('should validate session access when sessionId provided', async () => {
      mockValidateSessionAccess.mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf?teacherId=teacher-123&sessionId=session-456')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Access denied to session')
      expect(mockValidateSessionAccess).toHaveBeenCalledWith('session-456', 'teacher-123')
    })

    it('should handle file not found errors', async () => {
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'))

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/nonexistent.pdf')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'nonexistent.pdf'] }
      })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('File not found')
    })

    it('should verify file ownership when teacherId provided', async () => {
      mockDbQuery.mockResolvedValue({
        data: {
          file_uploads: [{
            id: 'file-123',
            file_path: '2024/01/document.pdf',
            teacher_id: 'teacher-123'
          }]
        }
      })

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf?teacherId=teacher-123')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(200)
      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          file_uploads: expect.objectContaining({
            $: expect.objectContaining({
              where: expect.objectContaining({
                file_path: '2024/01/document.pdf',
                teacher_id: 'teacher-123'
              })
            })
          })
        })
      )
    })

    it('should return 403 when file not owned by teacher', async () => {
      mockDbQuery.mockResolvedValue({
        data: { file_uploads: [] }
      })

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf?teacherId=teacher-123')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Access denied to file')
    })

    it('should serve different file types with correct headers', async () => {
      const fileTypes = [
        {
          path: ['image.jpg'],
          expectedType: 'image/jpeg'
        },
        {
          path: ['document.pdf'],
          expectedType: 'application/pdf'
        },
        {
          path: ['text.txt'],
          expectedType: 'text/plain'
        }
      ]

      for (const fileType of fileTypes) {
        mockGetFileServingHeaders.mockReturnValue({
          'Content-Type': fileType.expectedType,
          'Cache-Control': 'public, max-age=3600'
        })

        const request = new NextRequest(`http://localhost:3000/api/files/${fileType.path.join('/')}`)

        const response = await GET(request, {
          params: { path: fileType.path }
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe(fileType.expectedType)
      }
    })

    it('should handle storage adapter errors', async () => {
      const mockAdapter = {
        getFile: jest.fn().mockRejectedValue(new Error('Storage error'))
      }
      mockCreateStorageAdapter.mockReturnValue(mockAdapter)

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to retrieve file')
    })

    it('should include performance metrics in response headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf')

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(200)
      expect(response.headers.get('X-Response-Time')).toBeTruthy()
    })

    it('should handle conditional requests with ETag', async () => {
      mockGetFileServingHeaders.mockReturnValue({
        'Content-Type': 'application/pdf',
        'ETag': 'test-etag-123'
      })

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf', {
        headers: {
          'If-None-Match': 'test-etag-123'
        }
      })

      const response = await GET(request, {
        params: { path: ['2024', '01', 'document.pdf'] }
      })

      expect(response.status).toBe(304)
    })

    it('should sanitize file paths correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024//01///document.pdf')

      const response = await GET(request, {
        params: { path: ['2024', '', '01', '', '', 'document.pdf'] }
      })

      expect(response.status).toBe(200)
      // Path should be normalized during processing
    })
  })
})