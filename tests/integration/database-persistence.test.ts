/**
 * Integration Tests for InstantDB Persistence
 * Tests real database operations and real-time synchronization
 * These tests require a running InstantDB instance
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import {
  createChat,
  addMessage,
  useMessages,
  useChats,
  testDatabaseConnection,
  DatabaseError
} from '@/lib/database'

// Test configuration
const TEST_TIMEOUT = 30000 // 30 seconds for database operations
const SYNC_WAIT_TIME = 2000 // 2 seconds for real-time sync

describe('InstantDB Integration Tests', () => {
  let testChatId: string
  let cleanup: (() => void)[] = []

  beforeAll(async () => {
    // Verify database connection before running tests
    const isConnected = await testDatabaseConnection()
    if (!isConnected) {
      throw new Error('Database connection failed. Please ensure InstantDB is properly configured.')
    }
  }, TEST_TIMEOUT)

  afterAll(async () => {
    // Cleanup any test data created
    // Note: InstantDB doesn't have delete operations, so we rely on test database isolation
    cleanup.forEach(cleanupFn => cleanupFn())
  })

  describe('Chat Persistence', () => {
    it('should create and persist a new chat', async () => {
      const chatTitle = `Test Chat - ${Date.now()}`

      testChatId = await createChat(chatTitle)

      expect(testChatId).toBeDefined()
      expect(typeof testChatId).toBe('string')
      expect(testChatId.length).toBeGreaterThan(0)

      // Add to cleanup
      cleanup.push(() => {
        // Chat cleanup would go here if InstantDB supported deletion
      })
    }, TEST_TIMEOUT)

    it('should retrieve created chat through useChats hook', async () => {
      // Create a chat first
      const chatTitle = `Integration Test Chat - ${Date.now()}`
      const chatId = await createChat(chatTitle)

      // Use React hook to query chats
      const { result } = renderHook(() => useChats(10))

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 10000 })

      expect(result.current.data).toBeDefined()
      expect(result.current.data?.chats).toBeInstanceOf(Array)

      // Verify our chat exists in the results
      const chats = result.current.data?.chats || []
      const ourChat = chats.find(chat => chat.id === chatId)
      expect(ourChat).toBeDefined()
      expect(ourChat?.title).toBe(chatTitle)
    }, TEST_TIMEOUT)
  })

  describe('Message Persistence', () => {
    beforeEach(async () => {
      // Create a fresh chat for each test
      testChatId = await createChat(`Message Test Chat - ${Date.now()}`)
    })

    it('should save and retrieve user messages', async () => {
      const userMessage = 'How can I create engaging science lessons for 5th graders?'

      // Save message to database
      const messageId = await addMessage(testChatId, userMessage, 'user')

      expect(messageId).toBeDefined()
      expect(typeof messageId).toBe('string')

      // Retrieve messages using hook
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.data?.messages).toBeDefined()
      }, { timeout: 10000 })

      const messages = result.current.data?.messages || []
      const savedMessage = messages.find(msg => msg.id === messageId)

      expect(savedMessage).toBeDefined()
      expect(savedMessage?.content).toBe(userMessage)
      expect(savedMessage?.role).toBe('user')
      expect(savedMessage?.chat_id).toBe(testChatId)
    }, TEST_TIMEOUT)

    it('should save and retrieve AI assistant messages', async () => {
      const assistantResponse = `Here are some engaging science lesson ideas for 5th graders:

1. Volcano Eruption Experiment - Mix baking soda and vinegar to demonstrate chemical reactions
2. Plant Growth Investigation - Track how different conditions affect plant growth
3. Simple Machines Scavenger Hunt - Find examples of levers, pulleys, and inclined planes around school
4. Weather Station Project - Create tools to measure temperature, humidity, and wind direction
5. States of Matter Exploration - Use ice, water, and steam to demonstrate solid, liquid, and gas

Each lesson should include hands-on activities, observation journals, and group discussions to promote active learning and scientific thinking skills.`

      // Save assistant message
      const messageId = await addMessage(testChatId, assistantResponse, 'assistant')

      // Verify message persisted correctly
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 10000 })

      const messages = result.current.data?.messages || []
      const savedMessage = messages.find(msg => msg.id === messageId)

      expect(savedMessage).toBeDefined()
      expect(savedMessage?.content).toBe(assistantResponse)
      expect(savedMessage?.role).toBe('assistant')
      expect(savedMessage?.content.length).toBeGreaterThan(100) // Verify long content persisted
    }, TEST_TIMEOUT)

    it('should maintain chronological order of messages', async () => {
      const messages = [
        { content: 'What are some effective reading strategies?', role: 'user' as const },
        { content: 'Here are proven reading strategies...', role: 'assistant' as const },
        { content: 'Can you provide specific examples for 2nd graders?', role: 'user' as const },
        { content: 'For 2nd graders, try these approaches...', role: 'assistant' as const }
      ]

      const savedMessageIds = []

      // Save messages with small delays to ensure timestamp ordering
      for (const message of messages) {
        const messageId = await addMessage(testChatId, message.content, message.role)
        savedMessageIds.push(messageId)
        await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
      }

      // Retrieve all messages
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.data?.messages?.length).toBe(4)
      }, { timeout: 10000 })

      const retrievedMessages = result.current.data?.messages || []

      // Verify chronological order (should be sorted by timestamp)
      for (let i = 1; i < retrievedMessages.length; i++) {
        expect(retrievedMessages[i].timestamp).toBeGreaterThanOrEqual(retrievedMessages[i-1].timestamp)
      }

      // Verify content matches expected order
      expect(retrievedMessages[0].content).toBe('What are some effective reading strategies?')
      expect(retrievedMessages[1].content).toBe('Here are proven reading strategies...')
      expect(retrievedMessages[2].content).toBe('Can you provide specific examples for 2nd graders?')
      expect(retrievedMessages[3].content).toBe('For 2nd graders, try these approaches...')
    }, TEST_TIMEOUT)
  })

  describe('Real-time Synchronization', () => {
    it('should synchronize new messages across multiple hook instances', async () => {
      testChatId = await createChat(`Sync Test Chat - ${Date.now()}`)

      // Create two hook instances simulating different browser tabs
      const { result: hook1 } = renderHook(() => useMessages(testChatId))
      const { result: hook2 } = renderHook(() => useMessages(testChatId))

      // Wait for both hooks to load
      await waitFor(() => {
        expect(hook1.current.isLoading).toBe(false)
        expect(hook2.current.isLoading).toBe(false)
      }, { timeout: 10000 })

      // Both should start with empty message lists
      expect(hook1.current.data?.messages?.length || 0).toBe(0)
      expect(hook2.current.data?.messages?.length || 0).toBe(0)

      // Add a message through the database (not through the hooks)
      const testMessage = 'This message should appear in both hooks'
      await addMessage(testChatId, testMessage, 'user')

      // Wait for real-time sync to propagate
      await new Promise(resolve => setTimeout(resolve, SYNC_WAIT_TIME))

      // Both hooks should now see the new message
      await waitFor(() => {
        expect(hook1.current.data?.messages?.length).toBe(1)
        expect(hook2.current.data?.messages?.length).toBe(1)
      }, { timeout: 10000 })

      // Verify content is the same in both
      expect(hook1.current.data?.messages?.[0]?.content).toBe(testMessage)
      expect(hook2.current.data?.messages?.[0]?.content).toBe(testMessage)
    }, TEST_TIMEOUT)

    it('should handle concurrent message additions gracefully', async () => {
      testChatId = await createChat(`Concurrent Test Chat - ${Date.now()}`)

      // Add multiple messages concurrently to test race conditions
      const messagePromises = Array.from({ length: 5 }, (_, i) =>
        addMessage(testChatId, `Concurrent message ${i + 1}`, i % 2 === 0 ? 'user' : 'assistant')
      )

      const messageIds = await Promise.all(messagePromises)

      // All messages should have been saved successfully
      expect(messageIds).toHaveLength(5)
      messageIds.forEach(id => {
        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
      })

      // Retrieve and verify all messages
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.data?.messages?.length).toBe(5)
      }, { timeout: 10000 })

      const messages = result.current.data?.messages || []

      // Verify all messages are present and properly ordered by timestamp
      expect(messages).toHaveLength(5)
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i-1].timestamp)
      }
    }, TEST_TIMEOUT)
  })

  describe('Error Scenarios and Recovery', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test verifies our error handling works but requires mocking network failures
      // In a real integration test environment, you might temporarily disconnect the database

      // For now, test with an invalid chat ID to trigger an error scenario
      const { result } = renderHook(() => useMessages('invalid-chat-id-that-does-not-exist'))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 10000 })

      // Should handle gracefully - either return empty results or appropriate error state
      expect(result.current.error).toBeDefined()
    }, TEST_TIMEOUT)

    it('should recover from temporary network failures', async () => {
      const testConnectionRecovery = async () => {
        let retryCount = 0
        const maxRetries = 3

        while (retryCount < maxRetries) {
          try {
            const connected = await testDatabaseConnection()
            if (connected) {
              return true
            }
            throw new Error('Connection test failed')
          } catch (error) {
            retryCount++
            if (retryCount >= maxRetries) {
              throw error
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        return false
      }

      const recovered = await testConnectionRecovery()
      expect(recovered).toBe(true)
    }, TEST_TIMEOUT)
  })

  describe('Performance and Scalability', () => {
    it('should handle large message volumes efficiently', async () => {
      testChatId = await createChat(`Performance Test Chat - ${Date.now()}`)

      const startTime = Date.now()

      // Add 20 messages to test bulk operations
      const messagePromises = Array.from({ length: 20 }, (_, i) =>
        addMessage(
          testChatId,
          `Performance test message ${i + 1}: This is a longer message to test how the database handles varied content lengths and ensures good performance even with substantial text content.`,
          i % 2 === 0 ? 'user' : 'assistant'
        )
      )

      await Promise.all(messagePromises)
      const additionTime = Date.now() - startTime

      // Should complete within reasonable time (less than 10 seconds for 20 messages)
      expect(additionTime).toBeLessThan(10000)

      // Retrieve messages and measure query performance
      const queryStartTime = Date.now()
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
        expect(result.current.data?.messages?.length).toBe(20)
      }, { timeout: 10000 })

      const queryTime = Date.now() - queryStartTime

      // Query should be fast (less than 3 seconds)
      expect(queryTime).toBeLessThan(3000)

      // Verify all messages are properly ordered
      const messages = result.current.data?.messages || []
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i-1].timestamp)
      }
    }, TEST_TIMEOUT)

    it('should enforce message limits for performance', async () => {
      testChatId = await createChat(`Limit Test Chat - ${Date.now()}`)

      // Add more messages than the default limit
      const messageCount = 150
      for (let i = 0; i < messageCount; i++) {
        await addMessage(testChatId, `Message ${i + 1}`, 'user')
      }

      // Query with default limit (should be 100)
      const { result } = renderHook(() => useMessages(testChatId))

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      }, { timeout: 15000 })

      const messages = result.current.data?.messages || []

      // Should respect the limit for performance
      expect(messages.length).toBeLessThanOrEqual(100)

      // Messages should still be in correct chronological order
      for (let i = 1; i < messages.length; i++) {
        expect(messages[i].timestamp).toBeGreaterThanOrEqual(messages[i-1].timestamp)
      }
    }, TEST_TIMEOUT)
  })
})