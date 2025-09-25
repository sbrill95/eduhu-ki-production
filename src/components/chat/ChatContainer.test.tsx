import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatContainer from './ChatContainer'

// Mock dependencies
jest.mock('./ChatMessage', () => {
  return function ChatMessage({ message }: { message: any }) {
    return <div data-testid="chat-message">{message.content}</div>
  }
})

jest.mock('./ChatInput', () => {
  return function ChatInput({ onSendMessage, onFileUpload, isLoading }: any) {
    return (
      <div data-testid="chat-input">
        <button
          onClick={() => onSendMessage('Test message')}
          disabled={isLoading}
          data-testid="send-button"
        >
          Send
        </button>
        <button
          onClick={() => onFileUpload([{ id: 'file1', name: 'test.pdf' }])}
          data-testid="upload-button"
        >
          Upload
        </button>
      </div>
    )
  }
})

jest.mock('@/lib/database', () => ({
  useMessages: jest.fn(),
  addMessage: jest.fn(),
  createChatSession: jest.fn(),
  DatabaseError: class DatabaseError extends Error {},
  monitorQueryPerformance: jest.fn(),
  useChatWithMessages: jest.fn(),
  sortMessagesByTimestamp: jest.fn()
}))

jest.mock('@/lib/instant', () => ({
  type: 'Message'
}))

jest.mock('@/lib/metrics', () => ({
  startMetricsCollection: jest.fn(),
  PerformanceMonitor: jest.fn()
}))

jest.mock('@/lib/cache', () => ({
  CacheManager: jest.fn()
}))

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'test-uuid-123')
}))

describe('ChatContainer', () => {
  const mockUseMessages = require('@/lib/database').useMessages
  const mockAddMessage = require('@/lib/database').addMessage
  const mockMonitorQueryPerformance = require('@/lib/database').monitorQueryPerformance
  const mockSortMessagesByTimestamp = require('@/lib/database').sortMessagesByTimestamp
  const mockStartMetricsCollection = require('@/lib/metrics').startMetricsCollection

  const mockMessages = [
    {
      id: 'msg1',
      content: 'Hello there',
      role: 'user',
      created_at: 1000,
      session_id: 'session-123'
    },
    {
      id: 'msg2',
      content: 'Hi! How can I help you?',
      role: 'assistant',
      created_at: 2000,
      session_id: 'session-123'
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mocks
    mockUseMessages.mockReturnValue({
      data: mockMessages,
      isLoading: false,
      error: null
    })

    mockMonitorQueryPerformance.mockImplementation((name, query) => query)
    mockSortMessagesByTimestamp.mockImplementation((msgs) => msgs)
    mockAddMessage.mockResolvedValue({ id: 'new-msg-123' })
  })

  it('should render chat messages', () => {
    render(<ChatContainer sessionId="session-123" />)

    expect(screen.getAllByTestId('chat-message')).toHaveLength(2)
    expect(screen.getByText('Hello there')).toBeInTheDocument()
    expect(screen.getByText('Hi! How can I help you?')).toBeInTheDocument()
  })

  it('should render chat input', () => {
    render(<ChatContainer sessionId="session-123" />)

    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByTestId('send-button')).toBeInTheDocument()
    expect(screen.getByTestId('upload-button')).toBeInTheDocument()
  })

  it('should handle sending a message', async () => {
    const user = userEvent.setup()
    render(<ChatContainer sessionId="session-123" />)

    const sendButton = screen.getByTestId('send-button')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Test message',
          role: 'user',
          session_id: 'session-123'
        })
      )
    })
  })

  it('should handle file uploads', async () => {
    const user = userEvent.setup()
    render(<ChatContainer sessionId="session-123" />)

    const uploadButton = screen.getByTestId('upload-button')
    await user.click(uploadButton)

    // Should trigger file upload handling
    await waitFor(() => {
      expect(screen.getByTestId('upload-button')).toBeInTheDocument()
    })
  })

  it('should show loading state during message sending', async () => {
    // Mock a delayed message sending
    mockAddMessage.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ id: 'new-msg' }), 1000))
    )

    const user = userEvent.setup()
    render(<ChatContainer sessionId="session-123" />)

    const sendButton = screen.getByTestId('send-button')
    await user.click(sendButton)

    // Should disable send button while loading
    expect(sendButton).toBeDisabled()
  })

  it('should handle empty message list', () => {
    mockUseMessages.mockReturnValue({
      data: [],
      isLoading: false,
      error: null
    })

    render(<ChatContainer sessionId="session-123" />)

    expect(screen.queryAllByTestId('chat-message')).toHaveLength(0)
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    mockUseMessages.mockReturnValue({
      data: [],
      isLoading: true,
      error: null
    })

    render(<ChatContainer sessionId="session-123" />)

    // Should show loading indicator
    expect(screen.queryAllByTestId('chat-message')).toHaveLength(0)
  })

  it('should handle database errors', () => {
    const error = new Error('Database connection failed')
    mockUseMessages.mockReturnValue({
      data: [],
      isLoading: false,
      error
    })

    render(<ChatContainer sessionId="session-123" />)

    // Should handle error gracefully
    expect(screen.queryAllByTestId('chat-message')).toHaveLength(0)
  })

  it('should sort messages by timestamp', () => {
    const unsortedMessages = [
      { id: 'msg2', created_at: 2000, content: 'Second' },
      { id: 'msg1', created_at: 1000, content: 'First' }
    ]

    mockUseMessages.mockReturnValue({
      data: unsortedMessages,
      isLoading: false,
      error: null
    })

    render(<ChatContainer sessionId="session-123" />)

    expect(mockSortMessagesByTimestamp).toHaveBeenCalledWith(unsortedMessages)
  })

  it('should initialize metrics collection', () => {
    render(<ChatContainer sessionId="session-123" />)

    expect(mockStartMetricsCollection).toHaveBeenCalled()
  })

  it('should handle streaming messages', async () => {
    const user = userEvent.setup()

    // Mock streaming response
    mockAddMessage.mockImplementation(async (message) => {
      // Simulate streaming response
      return { id: 'streaming-msg-123', streaming: true }
    })

    render(<ChatContainer sessionId="session-123" />)

    const sendButton = screen.getByTestId('send-button')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalled()
    })
  })

  it('should handle message with file attachments', () => {
    const messagesWithFiles = [
      {
        id: 'msg1',
        content: 'Here is a document',
        role: 'user',
        created_at: 1000,
        session_id: 'session-123',
        fileAttachments: ['file1', 'file2']
      }
    ]

    mockUseMessages.mockReturnValue({
      data: messagesWithFiles,
      isLoading: false,
      error: null
    })

    render(<ChatContainer sessionId="session-123" />)

    expect(screen.getByText('Here is a document')).toBeInTheDocument()
  })

  it('should handle session ID changes', () => {
    const { rerender } = render(<ChatContainer sessionId="session-123" />)

    // Change session ID
    rerender(<ChatContainer sessionId="session-456" />)

    // Should query messages for new session
    expect(mockUseMessages).toHaveBeenLastCalledWith('session-456', 100)
  })

  it('should limit messages for performance', () => {
    render(<ChatContainer sessionId="session-123" />)

    expect(mockUseMessages).toHaveBeenCalledWith('session-123', 100)
  })

  it('should auto-scroll to bottom on new messages', async () => {
    const { rerender } = render(<ChatContainer sessionId="session-123" />)

    const newMessages = [
      ...mockMessages,
      {
        id: 'msg3',
        content: 'New message',
        role: 'user',
        created_at: 3000,
        session_id: 'session-123'
      }
    ]

    mockUseMessages.mockReturnValue({
      data: newMessages,
      isLoading: false,
      error: null
    })

    rerender(<ChatContainer sessionId="session-123" />)

    await waitFor(() => {
      expect(screen.getByText('New message')).toBeInTheDocument()
    })
  })

  it('should handle message sending errors', async () => {
    const user = userEvent.setup()
    mockAddMessage.mockRejectedValue(new Error('Failed to send message'))

    render(<ChatContainer sessionId="session-123" />)

    const sendButton = screen.getByTestId('send-button')
    await user.click(sendButton)

    await waitFor(() => {
      // Should handle error gracefully and not crash
      expect(sendButton).not.toBeDisabled()
    })
  })

  it('should generate unique message IDs', async () => {
    const user = userEvent.setup()
    render(<ChatContainer sessionId="session-123" />)

    const sendButton = screen.getByTestId('send-button')
    await user.click(sendButton)

    await waitFor(() => {
      expect(mockAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String)
        })
      )
    })
  })

  it('should monitor query performance', () => {
    render(<ChatContainer sessionId="session-123" />)

    expect(mockMonitorQueryPerformance).toHaveBeenCalledWith(
      'chat-messages',
      expect.anything()
    )
  })
})