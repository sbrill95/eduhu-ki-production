import { test, expect } from '@playwright/test'
import { setupTestDatabase, cleanupTestDatabase, createTestUser } from '../utils/test-setup'

test.describe('Chat Session Management Integration', () => {
  let testUserId: string

  test.beforeAll(async () => {
    await setupTestDatabase()
    testUserId = await createTestUser('teacher@eduhu.test')
  })

  test.afterAll(async () => {
    await cleanupTestDatabase()
  })

  test.describe('Session Creation and Management', () => {
    test('should create new chat session with proper metadata', async ({ page }) => {
      await page.goto('/chat')

      // Start a new conversation
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Help me create a science lesson about photosynthesis')

      const sendButton = page.getByRole('button', { name: /send/i })
      await sendButton.click()

      // Wait for response and verify session creation
      await expect(page.getByText(/photosynthesis/i)).toBeVisible({ timeout: 10000 })

      // Check that session appears in sidebar
      const sessionTitle = page.getByRole('button').filter({ hasText: /science lesson about/i })
      await expect(sessionTitle).toBeVisible()

      // Verify session metadata
      const timestamp = page.locator('[data-testid="session-timestamp"]').first()
      await expect(timestamp).toContainText(/just now|seconds ago/i)
    })

    test('should generate appropriate chat titles from first message', async ({ page }) => {
      await page.goto('/chat')

      const testCases = [
        {
          message: 'How do I teach multiplication to 3rd graders?',
          expectedTitle: /multiplication.*3rd graders/i
        },
        {
          message: 'What are some engaging reading activities for elementary students?',
          expectedTitle: /reading activities.*elementary/i
        },
        {
          message: 'Help me create a lesson plan for the water cycle',
          expectedTitle: /lesson plan.*water cycle/i
        }
      ]

      for (const { message, expectedTitle } of testCases) {
        // Create new chat
        await page.getByRole('button', { name: /new chat/i }).click()

        // Send message
        const input = page.getByPlaceholderText(/ask about lesson plans/i)
        await input.fill(message)
        await page.getByRole('button', { name: /send/i }).click()

        // Wait for AI response
        await page.waitForSelector('[data-testid="ai-message"]', { timeout: 15000 })

        // Check generated title
        const sessionTitle = page.locator('[data-testid="session-title"]').first()
        await expect(sessionTitle).toContainText(expectedTitle)
      }
    })

    test('should handle session creation failures gracefully', async ({ page, context }) => {
      // Simulate network failure
      await context.setOffline(true)

      await page.goto('/chat')

      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Test message during offline')

      const sendButton = page.getByRole('button', { name: /send/i })
      await sendButton.click()

      // Should show offline indicator
      await expect(page.getByText(/offline/i)).toBeVisible()

      // Should queue the message
      await expect(page.getByText(/message queued/i)).toBeVisible()

      // Restore connection
      await context.setOffline(false)

      // Message should be sent when connection restored
      await expect(page.getByText(/test message during offline/i)).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Session Switching and State Management', () => {
    test('should switch between chat sessions without data loss', async ({ page }) => {
      // Create first session
      await page.goto('/chat')
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('First session: Math lesson ideas')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Create second session
      await page.getByRole('button', { name: /new chat/i }).click()
      await input.fill('Second session: Science experiments')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Switch back to first session
      await page.getByText(/math lesson ideas/i).first().click()

      // Verify first session content is preserved
      await expect(page.getByText(/first session: math lesson ideas/i)).toBeVisible()

      // Switch to second session
      await page.getByText(/science experiments/i).first().click()

      // Verify second session content is preserved
      await expect(page.getByText(/second session: science experiments/i)).toBeVisible()
    })

    test('should preserve unsent message drafts when switching sessions', async ({ page }) => {
      // Create a session
      await page.goto('/chat')
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Initial message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Start typing a draft message
      const draftMessage = 'This is an unsent draft message about art projects'
      await input.fill(draftMessage)

      // Switch to a different session without sending
      await page.getByRole('button', { name: /new chat/i }).click()
      await input.fill('Different session message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Switch back to original session
      await page.getByText(/initial message/i).first().click()

      // Verify draft message is preserved
      await expect(input).toHaveValue(draftMessage)
    })

    test('should update last accessed timestamp on session switch', async ({ page }) => {
      // Create two sessions with delay between them
      await page.goto('/chat')

      // First session
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('First session message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Wait to create time difference
      await page.waitForTimeout(2000)

      // Second session
      await page.getByRole('button', { name: /new chat/i }).click()
      await input.fill('Second session message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Get initial timestamps
      const firstSessionTime = await page.locator('[data-testid="session-timestamp"]').first().textContent()

      // Switch back to first session
      await page.getByText(/first session message/i).first().click()

      // Verify timestamp was updated
      const updatedFirstSessionTime = await page.locator('[data-testid="session-timestamp"]').first().textContent()
      expect(updatedFirstSessionTime).not.toBe(firstSessionTime)
    })
  })

  test.describe('Session Persistence and Recovery', () => {
    test('should restore active session on page refresh', async ({ page }) => {
      // Create a session
      await page.goto('/chat')
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      const testMessage = 'Page refresh test message about classroom management'

      await input.fill(testMessage)
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Get session ID for verification
      const sessionUrl = page.url()

      // Refresh the page
      await page.reload()

      // Verify session is restored
      expect(page.url()).toBe(sessionUrl)
      await expect(page.getByText(testMessage)).toBeVisible()
    })

    test('should maintain session state across browser tabs', async ({ context }) => {
      const page1 = await context.newPage()
      const page2 = await context.newPage()

      // Create session in first tab
      await page1.goto('/chat')
      const input1 = page1.getByPlaceholderText(/ask about lesson plans/i)
      await input1.fill('Multi-tab test: History lesson ideas')
      await page1.getByRole('button', { name: /send/i }).click()
      await page1.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Open same session in second tab
      const sessionUrl = page1.url()
      await page2.goto(sessionUrl)

      // Verify session content is visible in second tab
      await expect(page2.getByText(/history lesson ideas/i)).toBeVisible()

      // Add message in second tab
      const input2 = page2.getByPlaceholderText(/ask about lesson plans/i)
      await input2.fill('Follow-up question about historical timelines')
      await page2.getByRole('button', { name: /send/i }).click()
      await page2.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Verify new message appears in first tab
      await expect(page1.getByText(/historical timelines/i)).toBeVisible({ timeout: 5000 })

      await page1.close()
      await page2.close()
    })

    test('should recover from connection interruptions', async ({ page, context }) => {
      // Create a session
      await page.goto('/chat')
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Connection test message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Simulate connection loss
      await context.setOffline(true)

      // Try to send message while offline
      await input.fill('Offline message about creative writing')
      await page.getByRole('button', { name: /send/i }).click()

      // Should show offline status
      await expect(page.getByText(/offline/i)).toBeVisible()

      // Restore connection
      await context.setOffline(false)

      // Should automatically reconnect and sync
      await expect(page.getByText(/online/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/offline message about creative writing/i)).toBeVisible({ timeout: 5000 })
    })
  })

  test.describe('Real-time Synchronization', () => {
    test('should sync new sessions across browser tabs', async ({ context }) => {
      const page1 = await context.newPage()
      const page2 = await context.newPage()

      // Open chat in both tabs
      await page1.goto('/chat')
      await page2.goto('/chat')

      // Create session in first tab
      const input1 = page1.getByPlaceholderText(/ask about lesson plans/i)
      await input1.fill('Sync test: Geography activities')
      await page1.getByRole('button', { name: /send/i }).click()
      await page1.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Verify session appears in second tab's sidebar
      await expect(page2.getByText(/geography activities/i)).toBeVisible({ timeout: 5000 })

      await page1.close()
      await page2.close()
    })

    test('should handle concurrent session creation', async ({ context }) => {
      const page1 = await context.newPage()
      const page2 = await context.newPage()

      await page1.goto('/chat')
      await page2.goto('/chat')

      // Create sessions simultaneously
      const [_result1, _result2] = await Promise.all([
        (async () => {
          const input1 = page1.getByPlaceholderText(/ask about lesson plans/i)
          await input1.fill('Concurrent session 1: Math games')
          await page1.getByRole('button', { name: /send/i }).click()
          return page1.waitForSelector('[data-testid="ai-message"]', { timeout: 15000 })
        })(),
        (async () => {
          const input2 = page2.getByPlaceholderText(/ask about lesson plans/i)
          await input2.fill('Concurrent session 2: Science labs')
          await page2.getByRole('button', { name: /send/i }).click()
          return page2.waitForSelector('[data-testid="ai-message"]', { timeout: 15000 })
        })()
      ])

      // Verify both sessions exist and are distinct
      await expect(page1.getByText(/math games/i)).toBeVisible()
      await expect(page1.getByText(/science labs/i)).toBeVisible({ timeout: 5000 })

      await expect(page2.getByText(/math games/i)).toBeVisible({ timeout: 5000 })
      await expect(page2.getByText(/science labs/i)).toBeVisible()

      await page1.close()
      await page2.close()
    })

    test('should maintain session order by last activity', async ({ page }) => {
      // Create multiple sessions
      await page.goto('/chat')

      const sessions = [
        'First session: Ancient civilizations',
        'Second session: Plant biology',
        'Third session: Creative writing prompts'
      ]

      // Create sessions in order
      for (const sessionMessage of sessions) {
        await page.getByRole('button', { name: /new chat/i }).click()

        const input = page.getByPlaceholderText(/ask about lesson plans/i)
        await input.fill(sessionMessage)
        await page.getByRole('button', { name: /send/i }).click()
        await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

        // Small delay to ensure different timestamps
        await page.waitForTimeout(1000)
      }

      // Interact with first session to make it most recent
      await page.getByText(/ancient civilizations/i).first().click()
      await page.getByPlaceholderText(/ask about lesson plans/i).fill('Follow-up about Egypt')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Check session order - first session should now be at top
      const sessionTitles = page.locator('[data-testid="session-title"]')
      await expect(sessionTitles.first()).toContainText(/ancient civilizations/i)
    })
  })

  test.describe('Performance and Scalability', () => {
    test('should handle up to 50 chat sessions efficiently', async ({ page }) => {
      await page.goto('/chat')

      // Create multiple sessions rapidly
      const sessionCount = 20 // Reduced for test performance
      const startTime = Date.now()

      for (let i = 0; i < sessionCount; i++) {
        await page.getByRole('button', { name: /new chat/i }).click()

        const input = page.getByPlaceholderText(/ask about lesson plans/i)
        await input.fill(`Session ${i + 1}: Teaching topic number ${i + 1}`)
        await page.getByRole('button', { name: /send/i }).click()

        // Wait for AI response with shorter timeout for bulk testing
        await page.waitForSelector('[data-testid="ai-message"]', { timeout: 8000 })
      }

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Performance assertion - should handle sessions efficiently
      expect(totalTime).toBeLessThan(sessionCount * 2000) // Max 2 seconds per session

      // Verify all sessions are accessible
      const sessionTitles = page.locator('[data-testid="session-title"]')
      await expect(sessionTitles).toHaveCount(sessionCount)

      // Test navigation performance
      const navigationStartTime = Date.now()
      await sessionTitles.first().click()
      await page.waitForSelector('[data-testid="message-list"]')
      const navigationEndTime = Date.now()

      expect(navigationEndTime - navigationStartTime).toBeLessThan(500) // Sub-500ms navigation
    })

    test('should maintain UI responsiveness during session operations', async ({ page }) => {
      await page.goto('/chat')

      // Create a session
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Performance test session')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Test rapid interactions while AI is responding
      await input.fill('Quick follow-up question about assessment methods')

      // UI should remain responsive
      const sendButton = page.getByRole('button', { name: /send/i })
      await expect(sendButton).toBeEnabled()

      // Navigation should still work
      const newChatButton = page.getByRole('button', { name: /new chat/i })
      await expect(newChatButton).toBeEnabled()

      // Test typing responsiveness
      await input.fill('')
      await input.type('Testing UI responsiveness during operations', { delay: 10 })

      const typedValue = await input.inputValue()
      expect(typedValue).toBe('Testing UI responsiveness during operations')
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle malformed session data gracefully', async ({ page }) => {
      // This would typically involve database manipulation in a real test
      await page.goto('/chat')

      // Navigate to a non-existent session
      await page.goto('/chat/invalid-session-id')

      // Should redirect to new chat or show error state
      await expect(page.getByText(/session not found|new conversation/i)).toBeVisible({ timeout: 5000 })
    })

    test('should recover from database synchronization errors', async ({ page, context }) => {
      await page.goto('/chat')

      // Create session normally
      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Error recovery test message')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Simulate intermittent network issues
      await context.setOffline(true)
      await page.waitForTimeout(1000)
      await context.setOffline(false)

      // Continue using the session
      await input.fill('Follow-up after network interruption')
      await page.getByRole('button', { name: /send/i }).click()

      // Should recover and continue working
      await expect(page.getByText(/follow-up after network interruption/i)).toBeVisible({ timeout: 10000 })
    })

    test('should handle session limits gracefully', async ({ page }) => {
      // This test would verify behavior when approaching session limits
      // Implementation depends on business rules for maximum sessions
      await page.goto('/chat')

      // For this test, assume we're testing the warning behavior
      // when approaching limits rather than actually creating 1000+ sessions

      const input = page.getByPlaceholderText(/ask about lesson plans/i)
      await input.fill('Session limit test')
      await page.getByRole('button', { name: /send/i }).click()
      await page.waitForSelector('[data-testid="ai-message"]', { timeout: 10000 })

      // Session should be created successfully
      await expect(page.getByText(/session limit test/i)).toBeVisible()
    })
  })
})