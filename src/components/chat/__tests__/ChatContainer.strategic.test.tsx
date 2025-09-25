/**
 * Strategic ChatContainer Tests - Focus on business critical functionality
 * Target: 40%+ coverage with high-value test scenarios
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { jest } from '@jest/globals'
import ChatContainer from '../ChatContainer'

// Mock external dependencies
jest.mock('@/lib/database', () => ({
  useMessages: jest.fn().mockReturnValue({
    data: { messages: [] },
    isLoading: false,
    error: null
  }),
  addMessage: jest.fn().mockResolvedValue('msg-123'),
  createChatSession: jest.fn().mockResolvedValue('chat-456'),
  DatabaseError: class MockDatabaseError extends Error {},
  monitorQueryPerformance: jest.fn((name, query) => query),
  sortMessagesByTimestamp: jest.fn((messages) => messages),
  useChatWithMessages: jest.fn()
}))

jest.mock('@/lib/metrics', () => ({
  startMetricsCollection: jest.fn(),
  PerformanceMonitor: {
    trackAPIPerformance: jest.fn()
  }
}))

jest.mock('@/lib/cache', () => ({
  CacheManager: {}
}))

jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('mock-uuid-123')
}))

// Mock fetch globally
global.fetch = jest.fn()

const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ChatContainer Strategic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render welcome message for empty chat', () => {
      render(<ChatContainer sessionId="test-session" />)

      expect(screen.getByText('Welcome to eduhu.ki!')).toBeInTheDocument()
      expect(screen.getByText('I\'m your AI teaching assistant')).toBeInTheDocument()
    })

    it('should display session ID in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(<ChatContainer sessionId="dev-session-123" />)

      expect(screen.getByText(/Chat ID: dev-sess.../)).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should show loading spinner when messages are loading', () => {
      const { useMessages } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(<ChatContainer sessionId="test-session" />)

      expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
    })
  })

  describe('Message Handling', () => {
    it('should handle sending a simple text message', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          content: 'Hello teacher!',
          role: 'user',
          timestamp: Date.now(),
          chat_id: 'chat-123'
        }
      ]

      const { useMessages, addMessage } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: mockMessages },
        isLoading: false,
        error: null
      })

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Hello! How can I help?"}\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"done"}\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              })
          })
        }
      } as any)

      render(<ChatContainer sessionId="existing-session" />)

      // Find and interact with input (assuming ChatInput component has a text input)
      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type/i)
      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText('Send')

      fireEvent.change(messageInput, { target: { value: 'How do I plan a math lesson?' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(addMessage).toHaveBeenCalledWith(
          expect.any(String),
          'How do I plan a math lesson?',
          'user',
          expect.objectContaining({
            contentType: 'text',
            tokenCount: expect.any(Number)
          })
        )
      }, { timeout: 5000 })
    })

    it('should extract educational topics from user messages', async () => {
      const { useMessages } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Great question!"}\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      } as any)

      render(<ChatContainer sessionId="topic-test" />)

      const messageInput = screen.getByRole('textbox') || screen.getByPlaceholderText(/type/i)
      const sendButton = screen.getByRole('button', { name: /send/i }) || screen.getByText('Send')

      // Send message with educational keywords
      fireEvent.change(messageInput, { target: { value: 'I need help with lesson planning and classroom management for grade 5' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        const { addMessage } = require('@/lib/database')
        expect(addMessage).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          'user',
          expect.objectContaining({
            educationalTopics: expect.arrayContaining(['lesson-planning', 'classroom-management'])
          })
        )
      })
    })
  })

  describe('File Upload Integration', () => {
    it('should handle file upload with message', async () => {
      const { useMessages, createChatSession } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'No chat found' }
      })

      // Mock file upload API
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ fileId: 'file-123' })
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          body: {
            getReader: () => ({
              read: jest.fn()
                .mockResolvedValueOnce({
                  done: false,
                  value: new TextEncoder().encode('data: {"type":"content","content":"I can see your file."}\n')
                })
                .mockResolvedValueOnce({
                  done: true
                })
            })
          }
        } as any)

      render(<ChatContainer sessionId="file-test" />)

      const file = new File(['test content'], 'lesson-plan.pdf', { type: 'application/pdf' })

      // Simulate file selection (this depends on how ChatInput handles files)
      const fileInput = screen.getByLabelText(/upload/i) || document.querySelector('input[type="file"]')
      if (fileInput) {
        fireEvent.change(fileInput, { target: { files: [file] } })

        const messageInput = screen.getByRole('textbox')
        fireEvent.change(messageInput, { target: { value: 'Please review this lesson plan' } })

        const sendButton = screen.getByRole('button', { name: /send/i })
        fireEvent.click(sendButton)

        await waitFor(() => {
          expect(createChatSession).toHaveBeenCalled()
          expect(mockFetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData)
          }))
        })
      }
    })
  })

  describe('Error Handling', () => {
    it('should display error when API request fails', async () => {
      const { useMessages } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      // Mock API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as any)

      render(<ChatContainer sessionId="error-test" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText(/API error: 500/)).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      const { useMessages } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'))

      render(<ChatContainer sessionId="network-test" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText(/Network error/i)).toBeInTheDocument()
      })
    })

    it('should handle database errors', async () => {
      const { useMessages, DatabaseError, addMessage } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      addMessage.mockRejectedValueOnce(new DatabaseError('Database connection failed'))

      render(<ChatContainer sessionId="db-error-test" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Test message' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Database connection failed')).toBeInTheDocument()
      })
    })
  })

  describe('Streaming Response', () => {
    it('should display streaming content as it arrives', async () => {
      const { useMessages } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      let readCount = 0
      const mockReader = {
        read: jest.fn(() => {
          readCount++
          if (readCount === 1) {
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode('data: {"type":"content","content":"Hello"}\n')
            })
          } else if (readCount === 2) {
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode('data: {"type":"content","content":" there!"}\n')
            })
          } else if (readCount === 3) {
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode('data: {"type":"done"}\n')
            })
          } else {
            return Promise.resolve({ done: true })
          }
        })
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader }
      } as any)

      render(<ChatContainer sessionId="streaming-test" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Hello AI' } })
      fireEvent.click(sendButton)

      // Should show streaming indicator
      await waitFor(() => {
        expect(screen.getByText('AI is typing...')).toBeInTheDocument()
      })

      // Should eventually show the complete response
      await waitFor(() => {
        expect(screen.getByText('Hello there!')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Chat Session Management', () => {
    it('should create new chat when none exists', async () => {
      const { useMessages, createChatSession } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'No chat found' }
      })

      createChatSession.mockResolvedValue('new-chat-789')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Welcome to your new chat!"}\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      } as any)

      render(<ChatContainer sessionId="new-session" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Start new conversation about teaching strategies for elementary students' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(createChatSession).toHaveBeenCalledWith(
          expect.stringContaining('demo-teacher-'),
          'Start new conversation about teaching strategies for elementary students'
        )
      })
    })

    it('should truncate long titles when creating chat', async () => {
      const { useMessages, createChatSession } = require('@/lib/database')
      useMessages.mockReturnValue({
        data: null,
        isLoading: false,
        error: { message: 'No chat found' }
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValueOnce({ done: true })
          })
        }
      } as any)

      render(<ChatContainer sessionId="long-title-test" />)

      const longMessage = 'This is a very long message that should be truncated when used as a chat title because it exceeds the 50 character limit that we have set for chat titles in our application'

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: longMessage } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(createChatSession).toHaveBeenCalledWith(
          expect.any(String),
          expect.stringMatching(/^.{1,53}\.\.\.$/)) // Should end with ... and be truncated
      })
    })
  })

  describe('Performance Metrics', () => {
    it('should track API performance metrics', async () => {
      const { useMessages } = require('@/lib/database')
      const { PerformanceMonitor } = require('@/lib/metrics')

      useMessages.mockReturnValue({
        data: { messages: [] },
        isLoading: false,
        error: null
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type":"content","content":"Response"}\n')
              })
              .mockResolvedValueOnce({
                done: true
              })
          })
        }
      } as any)

      render(<ChatContainer sessionId="metrics-test" />)

      const messageInput = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      fireEvent.change(messageInput, { target: { value: 'Test metrics' } })
      fireEvent.click(sendButton)

      await waitFor(() => {
        expect(PerformanceMonitor.trackAPIPerformance).toHaveBeenCalledWith({
          endpoint: '/api/chat',
          method: 'POST',
          statusCode: 200,
          duration: expect.any(Number),
          timestamp: expect.any(Number)
        })
      })
    })
  })
})