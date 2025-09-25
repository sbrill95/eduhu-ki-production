/**
 * Integration tests for the enhanced file serving API route
 * Tests both local storage and S3 integration scenarios
 */

import { createMocks } from 'node-mocks-http'
import { GET, HEAD } from '@/app/api/files/[...path]/route'
import { NextRequest } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { S3StorageAdapter } from '@/lib/file-storage'

// Mock the database module
jest.mock('@/lib/instant', () => ({
  db: {
    query: jest.fn(),
    transact: jest.fn()
  },
  FILE_UPLOAD_CONFIG: {
    MAX_FILE_SIZE_MB: 10,
    ALLOWED_TYPES: ['text/plain', 'image/*', 'application/pdf']
  }
}))

// Mock the database validation function
jest.mock('@/lib/database', () => ({
  validateSessionAccess: jest.fn()
}))

// Mock file system operations
jest.mock('fs/promises')
jest.mock('fs', () => ({
  existsSync: jest.fn()
}))

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3')
jest.mock('@aws-sdk/s3-request-presigner')

const mockFs = fs as jest.Mocked<typeof fs>
const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof import('fs').existsSync>

describe('File Serving API Integration Tests', () => {
  const TEST_TEACHER_ID = 'test_teacher_123'
  const TEST_SESSION_ID = 'test_session_456'

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset environment variables
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_S3_BUCKET_NAME

    // Mock database responses
    const mockDb = require('@/lib/instant').db
    mockDb.query.mockResolvedValue({ file_uploads: [] })
    mockDb.transact.mockResolvedValue({})

    const mockValidateSessionAccess = require('@/lib/database').validateSessionAccess
    mockValidateSessionAccess.mockResolvedValue(true)
  })

  describe('Security Validation', () => {
    it('should reject empty file paths', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/')

      const response = await GET(request, { params: { path: [] } })

      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toBe('File path required')
    })

    it('should reject path traversal attempts', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/../../../etc/passwd')

      const response = await GET(request, { params: { path: ['..', '..', '..', 'etc', 'passwd'] } })

      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toBe('Invalid file path')
    })

    it('should reject tilde paths', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/~/sensitive')

      const response = await GET(request, { params: { path: ['~', 'sensitive'] } })

      expect(response.status).toBe(400)

      const body = await response.json()
      expect(body.error).toBe('Invalid file path')
    })

    it('should validate session access when provided', async () => {
      const mockValidateSessionAccess = require('@/lib/database').validateSessionAccess
      mockValidateSessionAccess.mockResolvedValue(false)

      const request = new NextRequest(
        `http://localhost:3000/api/files/test.txt?teacherId=${TEST_TEACHER_ID}&sessionId=${TEST_SESSION_ID}`
      )

      const response = await GET(request, { params: { path: ['test.txt'] } })

      expect(response.status).toBe(403)

      const body = await response.json()
      expect(body.error).toBe('Unauthorized access to session')

      expect(mockValidateSessionAccess).toHaveBeenCalledWith(TEST_SESSION_ID, TEST_TEACHER_ID)
    })

    it('should validate file ownership when database record exists', async () => {
      const mockDb = require('@/lib/instant').db
      mockDb.query.mockResolvedValue({
        file_uploads: [{
          id: 'file123',
          filename: 'test.txt',
          teacher_id: 'different_teacher',
          file_path: 'test.txt'
        }]
      })

      const request = new NextRequest(
        `http://localhost:3000/api/files/test.txt?teacherId=${TEST_TEACHER_ID}`
      )

      const response = await GET(request, { params: { path: ['test.txt'] } })

      expect(response.status).toBe(403)

      const body = await response.json()
      expect(body.error).toBe('File access denied')
    })
  })

  describe('Local Storage File Serving', () => {
    beforeEach(() => {
      // Mock successful local file access
      mockExistsSync.mockReturnValue(true)
      mockFs.stat.mockResolvedValue({
        size: 1024,
        mtime: new Date('2024-01-01T12:00:00Z'),
        birthtime: new Date('2024-01-01T11:00:00Z'),
        isFile: () => true
      } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('test file content'))
    })

    it('should serve file from local storage successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/test.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 'test.txt'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-served-from')).toBe('local')
      expect(response.headers.get('content-length')).toBe('1024')
      expect(response.headers.get('content-type')).toBe('text/plain')

      const body = await response.arrayBuffer()
      expect(Buffer.from(body).toString()).toBe('test file content')
    })

    it('should serve images with correct MIME type', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/image.jpg')

      const response = await GET(request, { params: { path: ['2024', '01', 'image.jpg'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('image/jpeg')
    })

    it('should serve PDFs with inline disposition', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/document.pdf')

      const response = await GET(request, { params: { path: ['2024', '01', 'document.pdf'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/pdf')
      expect(response.headers.get('content-disposition')).toBe('inline')
    })

    it('should handle thumbnail requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/thumbnails/2024/01/image.jpg')

      const response = await GET(request, { params: { path: ['thumbnails', '2024', '01', 'image.jpg'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-file-path')).toBe('thumbnails/2024/01/image.jpg')

      // Verify the file system path includes thumbnails directory
      expect(mockFs.stat).toHaveBeenCalledWith(
        expect.stringContaining(path.join('thumbnails', '2024', '01', 'image.jpg'))
      )
    })

    it('should return 404 for non-existent files', async () => {
      mockFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'))

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/nonexistent.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 'nonexistent.txt'] } })

      expect(response.status).toBe(404)

      const body = await response.json()
      expect(body.error).toBe('File not found')
    })

    it('should set appropriate security headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/test.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 'test.txt'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-content-type-options')).toBe('nosniff')
      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('cache-control')).toBe('public, max-age=31536000')
    })
  })

  describe('S3 Storage Fallback', () => {
    beforeEach(() => {
      // Configure S3 environment
      process.env.AWS_ACCESS_KEY_ID = 'test-key'
      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'

      // Mock local file not found
      mockExistsSync.mockReturnValue(false)
      mockFs.stat.mockRejectedValue(new Error('ENOENT: file not found'))

      // Mock S3 operations
      const mockS3Send = jest.fn()
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl

      // Mock successful S3 file info
      mockS3Send.mockResolvedValue({
        ContentLength: 2048,
        LastModified: new Date('2024-01-01T12:00:00Z')
      })

      // Mock signed URL generation
      mockGetSignedUrl.mockResolvedValue('https://test-bucket.s3.amazonaws.com/signed-url')

      // Mock global fetch for S3 file content
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(Buffer.from('S3 file content').buffer)
      }) as jest.MockedFunction<typeof fetch>

      require('@aws-sdk/client-s3').S3Client.mockImplementation(() => ({
        send: mockS3Send
      }))
    })

    afterEach(() => {
      delete (global as any).fetch
    })

    it('should fallback to S3 when local file not found', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/s3-only-file.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 's3-only-file.txt'] } })

      expect(response.status).toBe(200)
      expect(response.headers.get('x-served-from')).toBe('s3')
      expect(response.headers.get('content-length')).toBe('15') // 'S3 file content'.length

      const body = await response.arrayBuffer()
      expect(Buffer.from(body).toString()).toBe('S3 file content')
    })

    it('should handle S3 file not found', async () => {
      // Mock S3 file not found
      const mockGetSignedUrl = require('@aws-sdk/s3-request-presigner').getSignedUrl
      mockGetSignedUrl.mockRejectedValue(new Error('NoSuchKey'))

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/missing-everywhere.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 'missing-everywhere.txt'] } })

      expect(response.status).toBe(404)

      const body = await response.json()
      expect(body.error).toBe('File not found')
    })

    it('should handle S3 access errors gracefully', async () => {
      // Mock S3 access denied
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403
      }) as jest.MockedFunction<typeof fetch>

      const request = new NextRequest('http://localhost:3000/api/files/2024/01/restricted.txt')

      const response = await GET(request, { params: { path: ['2024', '01', 'restricted.txt'] } })

      expect(response.status).toBe(500)

      const body = await response.json()
      expect(body.error).toBe('File access failed')
    })
  })

  describe('Analytics Logging', () => {
    beforeEach(() => {
      // Mock successful local file access
      mockExistsSync.mockReturnValue(true)
      mockFs.stat.mockResolvedValue({
        size: 512,
        mtime: new Date('2024-01-01T12:00:00Z'),
        birthtime: new Date('2024-01-01T11:00:00Z'),
        isFile: () => true
      } as any)
      mockFs.readFile.mockResolvedValue(Buffer.from('logged file content'))

      // Mock database file record
      const mockDb = require('@/lib/instant').db
      mockDb.query.mockResolvedValue({
        file_uploads: [{
          id: 'file123',
          filename: 'logged.txt',
          teacher_id: TEST_TEACHER_ID,
          file_path: '2024/01/logged.txt'
        }]
      })
    })

    it('should log successful file access analytics', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/files/2024/01/logged.txt?teacherId=${TEST_TEACHER_ID}&sessionId=${TEST_SESSION_ID}`
      )

      const response = await GET(request, { params: { path: ['2024', '01', 'logged.txt'] } })

      expect(response.status).toBe(200)

      const mockDb = require('@/lib/instant').db
      expect(mockDb.transact).toHaveBeenCalledWith([
        expect.objectContaining({
          'usage_analytics': expect.objectContaining({
            update: expect.objectContaining({
              teacher_id: TEST_TEACHER_ID,
              event_type: 'file_access',
              session_id: TEST_SESSION_ID,
              feature_used: 'file_serving',
              metadata: expect.objectContaining({
                file_id: 'file123',
                filename: 'logged.txt',
                file_path: '2024/01/logged.txt',
                served_from: 'local',
                file_size: 512,
                is_thumbnail: false
              })
            })
          })
        })
      ])
    })

    it('should log failed file access attempts', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'))

      const request = new NextRequest(
        `http://localhost:3000/api/files/2024/01/missing.txt?teacherId=${TEST_TEACHER_ID}`
      )

      const response = await GET(request, { params: { path: ['2024', '01', 'missing.txt'] } })

      expect(response.status).toBe(404)

      const mockDb = require('@/lib/instant').db
      expect(mockDb.transact).toHaveBeenCalledWith([
        expect.objectContaining({
          'usage_analytics': expect.objectContaining({
            update: expect.objectContaining({
              teacher_id: TEST_TEACHER_ID,
              event_type: 'file_access_failed',
              metadata: expect.objectContaining({
                file_path: '2024/01/missing.txt',
                error_message: expect.stringContaining('not found')
              })
            })
          })
        })
      ])
    })

    it('should handle analytics logging failures gracefully', async () => {
      const mockDb = require('@/lib/instant').db
      mockDb.transact.mockRejectedValue(new Error('Database connection failed'))

      const request = new NextRequest(
        `http://localhost:3000/api/files/2024/01/logged.txt?teacherId=${TEST_TEACHER_ID}`
      )

      // Should still serve the file even if analytics fails
      const response = await GET(request, { params: { path: ['2024', '01', 'logged.txt'] } })

      expect(response.status).toBe(200)

      const body = await response.arrayBuffer()
      expect(Buffer.from(body).toString()).toBe('logged file content')
    })
  })

  describe('HEAD Request Support', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true)
      mockFs.stat.mockResolvedValue({
        size: 256,
        mtime: new Date('2024-01-01T12:00:00Z'),
        birthtime: new Date('2024-01-01T11:00:00Z'),
        isFile: () => true
      } as any)
    })

    it('should respond to HEAD requests with headers only', async () => {
      const request = new NextRequest('http://localhost:3000/api/files/2024/01/test.txt', { method: 'HEAD' })\n\n      const response = await HEAD(request, { params: { path: ['2024', '01', 'test.txt'] } })\n\n      expect(response.status).toBe(200)\n      expect(response.headers.get('content-length')).toBe('256')\n      expect(response.headers.get('content-type')).toBe('text/plain')\n      expect(response.headers.get('x-served-from')).toBe('local')\n\n      // HEAD responses should have no body\n      const body = await response.text()\n      expect(body).toBe('')\n    })\n\n    it('should handle HEAD requests for S3 files', async () => {\n      // Configure S3\n      process.env.AWS_ACCESS_KEY_ID = 'test-key'\n      process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'\n      process.env.AWS_S3_BUCKET_NAME = 'test-bucket'\n\n      // Mock local file not found\n      mockExistsSync.mockReturnValue(false)\n      mockFs.stat.mockRejectedValue(new Error('ENOENT'))\n\n      // Mock S3 file info\n      const mockS3Send = jest.fn().mockResolvedValue({\n        ContentLength: 1024,\n        LastModified: new Date('2024-01-01T12:00:00Z')\n      })\n\n      require('@aws-sdk/client-s3').S3Client.mockImplementation(() => ({\n        send: mockS3Send\n      }))\n\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/s3-file.txt', { method: 'HEAD' })\n\n      const response = await HEAD(request, { params: { path: ['2024', '01', 's3-file.txt'] } })\n\n      expect(response.status).toBe(200)\n      expect(response.headers.get('content-length')).toBe('1024')\n      expect(response.headers.get('x-served-from')).toBe('s3')\n    })\n\n    it('should return 404 for HEAD requests on missing files', async () => {\n      mockFs.stat.mockRejectedValue(new Error('ENOENT'))\n\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/missing.txt', { method: 'HEAD' })\n\n      const response = await HEAD(request, { params: { path: ['2024', '01', 'missing.txt'] } })\n\n      expect(response.status).toBe(404)\n    })\n  })\n\n  describe('Error Handling', () => {\n    it('should handle file system permission errors', async () => {\n      mockFs.stat.mockRejectedValue(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }))\n\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/restricted.txt')\n\n      const response = await GET(request, { params: { path: ['2024', '01', 'restricted.txt'] } })\n\n      expect(response.status).toBe(500)\n\n      const body = await response.json()\n      expect(body.error).toBe('File access failed')\n    })\n\n    it('should handle database query failures gracefully', async () => {\n      const mockDb = require('@/lib/instant').db\n      mockDb.query.mockRejectedValue(new Error('Database connection lost'))\n\n      // Mock successful local file access\n      mockExistsSync.mockReturnValue(true)\n      mockFs.stat.mockResolvedValue({\n        size: 128,\n        mtime: new Date(),\n        birthtime: new Date(),\n        isFile: () => true\n      } as any)\n      mockFs.readFile.mockResolvedValue(Buffer.from('file content'))\n\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/test.txt')\n\n      // Should still serve the file even if database query fails\n      const response = await GET(request, { params: { path: ['2024', '01', 'test.txt'] } })\n\n      expect(response.status).toBe(200)\n\n      const body = await response.arrayBuffer()\n      expect(Buffer.from(body).toString()).toBe('file content')\n    })\n\n    it('should handle malformed directory structure', async () => {\n      mockFs.stat.mockResolvedValue({\n        size: 0,\n        mtime: new Date(),\n        birthtime: new Date(),\n        isFile: () => false // This is a directory, not a file\n      } as any)\n\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/directory')\n\n      const response = await GET(request, { params: { path: ['2024', '01', 'directory'] } })\n\n      expect(response.status).toBe(500)\n\n      const body = await response.json()\n      expect(body.error).toBe('File access failed')\n    })\n  })\n\n  describe('Content Type Detection', () => {\n    beforeEach(() => {\n      mockExistsSync.mockReturnValue(true)\n      mockFs.stat.mockResolvedValue({\n        size: 100,\n        mtime: new Date(),\n        birthtime: new Date(),\n        isFile: () => true\n      } as any)\n      mockFs.readFile.mockResolvedValue(Buffer.from('content'))\n    })\n\n    it('should detect image content types', async () => {\n      const testCases = [\n        { filename: 'image.jpg', expectedType: 'image/jpeg' },\n        { filename: 'image.png', expectedType: 'image/png' },\n        { filename: 'image.gif', expectedType: 'image/gif' },\n        { filename: 'image.webp', expectedType: 'image/webp' }\n      ]\n\n      for (const testCase of testCases) {\n        const request = new NextRequest(`http://localhost:3000/api/files/2024/01/${testCase.filename}`)\n        const response = await GET(request, { params: { path: ['2024', '01', testCase.filename] } })\n\n        expect(response.status).toBe(200)\n        expect(response.headers.get('content-type')).toBe(testCase.expectedType)\n      }\n    })\n\n    it('should detect document content types', async () => {\n      const testCases = [\n        { filename: 'document.pdf', expectedType: 'application/pdf' },\n        { filename: 'document.doc', expectedType: 'application/msword' },\n        { filename: 'document.docx', expectedType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },\n        { filename: 'data.csv', expectedType: 'text/csv' },\n        { filename: 'readme.md', expectedType: 'text/markdown' }\n      ]\n\n      for (const testCase of testCases) {\n        const request = new NextRequest(`http://localhost:3000/api/files/2024/01/${testCase.filename}`)\n        const response = await GET(request, { params: { path: ['2024', '01', testCase.filename] } })\n\n        expect(response.status).toBe(200)\n        expect(response.headers.get('content-type')).toBe(testCase.expectedType)\n      }\n    })\n\n    it('should default to octet-stream for unknown types', async () => {\n      const request = new NextRequest('http://localhost:3000/api/files/2024/01/unknown.xyz')\n      const response = await GET(request, { params: { path: ['2024', '01', 'unknown.xyz'] } })\n\n      expect(response.status).toBe(200)\n      expect(response.headers.get('content-type')).toBe('application/octet-stream')\n    })\n  })\n})