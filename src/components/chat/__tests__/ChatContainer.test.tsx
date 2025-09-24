import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatContainer from '../ChatContainer'
import { useMessages, addMessage, createChat, DatabaseError } from '@/lib/database'

// Mock the database functions
jest.mock('@/lib/database', () => ({
  useMessages: jest.fn(),
  addMessage: jest.fn(),
  createChat: jest.fn(),
  sortMessagesByTimestamp: jest.fn((messages) => messages),
  monitorQueryPerformance: jest.fn((name, query) => query),
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'DatabaseError'
    }
  }
}))

// Mock fetch for API calls
global.fetch = jest.fn()

// Mock ReadableStream for streaming responses
global.ReadableStream = jest.fn().mockImplementation(() => ({
  getReader: jest.fn().mockReturnValue({
    read: jest.fn().mockResolvedValue({ done: true, value: undefined })
  })
}))

const mockUseMessages = useMessages as jest.MockedFunction<typeof useMessages>
const mockAddMessage = addMessage as jest.MockedFunction<typeof addMessage>
const mockCreateChat = createChat as jest.MockedFunction<typeof createChat>
const mockFetch = fetch as jest.MockedFunction<typeof fetch>

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockUseMessages.mockReturnValue({
      data: { messages: [] },
      isLoading: false,
      error: null
    })

    mockCreateChat.mockResolvedValue('new-chat-id')
    mockAddMessage.mockResolvedValue('message-id')
  })

  describe('Component Rendering', () => {
    it('should render the teacher-focused header correctly', () => {
      render(<ChatContainer chatId="test-chat" />)

      expect(screen.getByText('Teacher AI Assistant')).toBeInTheDocument()
      expect(screen.getByText(/Ask questions about teaching/)).toBeInTheDocument()
    })

    it('should show welcome message for empty chat', () => {
      render(<ChatContainer chatId="test-chat" />)

      expect(screen.getByText('Welcome to eduhu.ki!')).toBeInTheDocument()
      expect(screen.getByText(/I'm your AI teaching assistant/)).toBeInTheDocument()
      expect(screen.getByText(/lesson planning, teaching strategies/)).toBeInTheDocument()
    })

    it('should render chat input field', () => {
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByPlaceholderText(/Ask about lesson plans/)
      expect(input).toBeInTheDocument()
      expect(input).not.toBeDisabled()
    })
  })

  describe('Message Loading', () => {
    it('should show loading spinner when messages are loading', () => {
      mockUseMessages.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(<ChatContainer chatId="test-chat" />)

      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument()
    })

    it('should display existing messages correctly', () => {
      const mockMessages = [
        {
          id: '1',
          chat_id: 'test-chat',
          content: 'What are some effective reading strategies?',
          role: 'user' as const,
          timestamp: Date.now() - 1000
        },
        {
          id: '2',
          chat_id: 'test-chat',
          content: 'Here are some proven reading strategies for students...',
          role: 'assistant' as const,
          timestamp: Date.now()
        }
      ]

      mockUseMessages.mockReturnValue({
        data: { messages: mockMessages },
        isLoading: false,
        error: null
      })

      render(<ChatContainer chatId="test-chat" />)

      expect(screen.getByText('What are some effective reading strategies?')).toBeInTheDocument()
      expect(screen.getByText(/Here are some proven reading strategies/)).toBeInTheDocument()
    })
  })

  describe('Message Sending - Teacher Workflows', () => {
    it('should handle lesson planning question correctly', async () => {
      const user = userEvent.setup()

      // Mock successful API response
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "content", "content": "Here are some great science lesson ideas: "}')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "content", "content": "1. Volcano experiments..."}')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "done"}')
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined
          })
      }

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      } as any)

      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      const sendButton = screen.getByRole('button', { name: /send/i })

      await user.type(input, 'I need help with 5th grade science lesson plans')
      await user.click(sendButton)

      // Should create chat and save user message
      await waitFor(() => {
        expect(mockCreateChat).toHaveBeenCalledWith('I need help with 5th grade science lesson plans')
        expect(mockAddMessage).toHaveBeenCalledWith(
          'new-chat-id',
          'I need help with 5th grade science lesson plans',
          'user'
        )
      })

      // Should show AI typing indicator
      expect(screen.getByText('AI is typing...')).toBeInTheDocument()

      // Should eventually save AI response
      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          'new-chat-id',
          'Here are some great science lesson ideas: 1. Volcano experiments...',
          'assistant'
        )
      }, { timeout: 5000 })
    })

    it('should handle student engagement question', async () => {
      const user = userEvent.setup()

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type": "content", "content": "For student engagement, try: "}')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"type": "done"}')
              })
              .mockResolvedValueOnce({ done: true })
          })
        }
      } as any)

      render(<ChatContainer chatId="existing-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'How can I improve student engagement in my math class?')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      // Should not create new chat for existing chat
      expect(mockCreateChat).not.toHaveBeenCalled()

      // Should save message to existing chat
      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          'existing-chat',
          'How can I improve student engagement in my math class?',
          'user'
        )
      })
    })

    it('should disable input during message sending', async () => {
      const user = userEvent.setup()

      // Mock API call that takes time
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))

      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      // Input should be disabled while processing
      expect(input).toBeDisabled()
    })
  })

  describe('Error Handling - Production Ready', () => {
    it('should display user-friendly database error messages', async () => {
      mockAddMessage.mockRejectedValue(new DatabaseError('Connection failed: Network timeout'))

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
        expect(screen.getByText('Connection failed: Network timeout')).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed'))

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      await waitFor(() => {
        expect(screen.getByText('Network error. Please check your internet connection and try again.')).toBeInTheDocument()
      })
    })

    it('should handle API service errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      } as any)

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      await waitFor(() => {
        expect(screen.getByText('AI service temporarily unavailable. Please try again in a moment.')).toBeInTheDocument()
      })
    })

    it('should re-enable input after error', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'))

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      // Wait for error to be handled
      await waitFor(() => {
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      })

      // Input should be enabled again
      expect(input).not.toBeDisabled()
    })
  })

  describe('Streaming Display', () => {
    it('should show streaming content as it arrives', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "content", "content": "Hello "}')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "content", "content": "teacher!"}')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type": "done"}')
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined
          })
      }

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      } as any)

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Hello')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      // Should eventually show complete streamed content
      await waitFor(() => {
        expect(mockAddMessage).toHaveBeenCalledWith(
          'new-chat-id',
          'Hello teacher!',
          'assistant'
        )
      }, { timeout: 5000 })
    })
  })

  describe('Accessibility - Educational Standards', () => {
    it('should have proper ARIA labels for screen readers', () => {
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      expect(input).toHaveAccessibleName()

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeInTheDocument()
    })

    it('should announce loading states to assistive technology', () => {
      mockUseMessages.mockReturnValue({
        data: null,
        isLoading: true,
        error: null
      })

      render(<ChatContainer chatId="test-chat" />)

      const loadingElement = screen.getByRole('status', { hidden: true })
      expect(loadingElement).toBeInTheDocument()
    })

    it('should properly announce errors to screen readers', async () => {
      mockFetch.mockRejectedValue(new Error('Test error'))

      const user = userEvent.setup()
      render(<ChatContainer chatId="test-chat" />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')

      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })

      await waitFor(() => {
        const errorElement = screen.getByRole('alert', { name: /something went wrong/i })
        expect(errorElement).toBeInTheDocument()
      })
    })
  })
})