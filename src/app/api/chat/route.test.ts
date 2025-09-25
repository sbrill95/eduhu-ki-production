import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock all dependencies
jest.mock('@/lib/ai', () => ({
  OpenAIProvider: {
    chat: jest.fn()
  }
}))

jest.mock('@/lib/database', () => ({
  addMessageToSession: jest.fn(),
  getChatSession: jest.fn(),
  validateSessionAccess: jest.fn()
}))

jest.mock('@/lib/memory', () => ({
  extractMemoriesFromMessage: jest.fn(),
  saveMemory: jest.fn()
}))

jest.mock('@/lib/instant-server', () => ({
  serverDb: {
    queryFileUploads: jest.fn()
  }
}))

describe('Chat API Route', () => {
  const mockOpenAIChat = require('@/lib/ai').OpenAIProvider.chat
  const mockAddMessageToSession = require('@/lib/database').addMessageToSession
  const mockGetChatSession = require('@/lib/database').getChatSession
  const mockValidateSessionAccess = require('@/lib/database').validateSessionAccess
  const mockExtractMemoriesFromMessage = require('@/lib/memory').extractMemoriesFromMessage
  const mockSaveMemory = require('@/lib/memory').saveMemory
  const mockQueryFileUploads = require('@/lib/instant-server').serverDb.queryFileUploads

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default successful mocks
    mockOpenAIChat.mockResolvedValue({
      content: 'AI response content',
      role: 'assistant'
    })
    mockAddMessageToSession.mockResolvedValue({ id: 'message-123' })
    mockGetChatSession.mockResolvedValue({
      id: 'session-456',
      teacherId: 'teacher-123',
      messages: []
    })
    mockValidateSessionAccess.mockResolvedValue(true)
    mockExtractMemoriesFromMessage.mockResolvedValue([])
    mockSaveMemory.mockResolvedValue({})
    mockQueryFileUploads.mockResolvedValue({
      data: { file_uploads: {} }
    })
  })

  describe('POST /api/chat', () => {
    it('should successfully process a chat message', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Hello, how are you?' }
        ],
        sessionId: 'session-456',
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockOpenAIChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: 'Hello, how are you?'
          })
        ]),
        expect.any(Object)
      )
      expect(mockAddMessageToSession).toHaveBeenCalled()
    })

    it('should return 400 for invalid messages format', async () => {
      const requestBody = {
        messages: 'invalid format',
        sessionId: 'session-456',
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const responseText = await response.text()
      expect(responseText).toBe('Invalid messages format')
    })

    it('should return 400 when sessionId provided without teacherId', async () => {
      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: 'session-456'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      const responseText = await response.text()
      expect(responseText).toBe('Teacher ID required when session ID provided')
    })

    it('should process file attachments when provided', async () => {
      mockQueryFileUploads.mockResolvedValue({
        data: {
          file_uploads: {
            'file1': {
              id: 'file1',
              filename: 'document.pdf',
              processing_status: 'completed',
              content: 'Document content'
            }
          }
        }
      })

      const requestBody = {
        messages: [{ role: 'user', content: 'Analyze this document' }],
        sessionId: 'session-456',
        teacherId: 'teacher-123',
        fileAttachments: [{ id: 'file1' }]
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockQueryFileUploads).toHaveBeenCalledWith({
        $: {
          where: {
            id: { in: ['file1'] },
            teacher_id: 'teacher-123'
          }
        }
      })
    })

    it('should handle AI provider errors gracefully', async () => {
      mockOpenAIChat.mockRejectedValue(new Error('OpenAI API error'))

      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }],
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      const responseText = await response.text()
      expect(responseText).toContain('Chat completion failed')
    })

    it('should validate session access when sessionId provided', async () => {
      mockValidateSessionAccess.mockResolvedValue(false)

      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }],
        sessionId: 'session-456',
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(403)
      const responseText = await response.text()
      expect(responseText).toBe('Access denied to session')
      expect(mockValidateSessionAccess).toHaveBeenCalledWith('session-456', 'teacher-123')
    })

    it('should extract and save memories from messages', async () => {
      const extractedMemories = [
        {
          type: 'preference',
          content: 'Teacher prefers visual explanations',
          confidence: 0.9
        }
      ]
      mockExtractMemoriesFromMessage.mockResolvedValue(extractedMemories)

      const requestBody = {
        messages: [{ role: 'user', content: 'I prefer visual explanations' }],
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockExtractMemoriesFromMessage).toHaveBeenCalled()
      expect(mockSaveMemory).toHaveBeenCalledWith(
        'teacher-123',
        extractedMemories[0]
      )
    })

    it('should continue without file attachments when fetch fails', async () => {
      mockQueryFileUploads.mockRejectedValue(new Error('Database error'))

      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }],
        teacherId: 'teacher-123',
        fileAttachments: [{ id: 'file1' }]
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockOpenAIChat).toHaveBeenCalled()
    })

    it('should filter out incomplete file attachments', async () => {
      mockQueryFileUploads.mockResolvedValue({
        data: {
          file_uploads: {
            'file1': {
              id: 'file1',
              processing_status: 'processing'
            },
            'file2': {
              id: 'file2',
              processing_status: 'completed'
            }
          }
        }
      })

      const requestBody = {
        messages: [{ role: 'user', content: 'Hello' }],
        teacherId: 'teacher-123',
        fileAttachments: [{ id: 'file1' }, { id: 'file2' }]
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      // Only completed files should be processed
    })

    it('should handle empty messages array', async () => {
      const requestBody = {
        messages: [],
        teacherId: 'teacher-123'
      }

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(mockOpenAIChat).toHaveBeenCalledWith([], expect.any(Object))
    })
  })
})