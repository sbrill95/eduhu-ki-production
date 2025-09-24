/**
 * End-to-End Tests for Teacher Workflows
 * These tests validate the complete user journey from a teacher's perspective
 * Tests run in real browsers and validate the full application stack
 */

import { test, expect, type Page } from '@playwright/test'

test.describe('Teacher Workflow Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the chat interface
    await page.goto('/chat')

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle')

    // Verify the page loads correctly
    await expect(page.getByText('Teacher AI Assistant')).toBeVisible()
  })

  test('Complete lesson planning workflow @teacher-workflow', async ({ page }) => {
    // Teacher arrives at eduhu.ki for lesson planning help
    await expect(page.getByText('Welcome to eduhu.ki!')).toBeVisible()
    await expect(page.getByText(/I'm your AI teaching assistant/)).toBeVisible()

    // Teacher asks about lesson planning
    const lessonPlanQuery = "I need help creating a comprehensive lesson plan for teaching fractions to 4th graders. The lesson should be 45 minutes long and include hands-on activities."

    await page.getByPlaceholder(/Ask about lesson plans/).fill(lessonPlanQuery)
    await page.getByRole('button', { name: /send/i }).click()

    // Verify user message appears immediately
    await expect(page.getByText(lessonPlanQuery)).toBeVisible()

    // Wait for AI response with typing indicator
    await expect(page.getByText('AI is typing...')).toBeVisible()

    // Wait for AI response to stream in and complete
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Verify AI provides comprehensive lesson plan response
    const aiResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(aiResponse).toContainText('lesson plan')
    await expect(aiResponse).toContainText('fractions')
    await expect(aiResponse).toContainText('4th grade')

    // Teacher asks follow-up about differentiation
    const followUpQuery = "How can I modify this lesson for students with learning disabilities and advanced learners?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(followUpQuery)
    await page.getByRole('button', { name: /send/i }).click()

    // Verify follow-up appears and gets response
    await expect(page.getByText(followUpQuery)).toBeVisible()
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(4)', { timeout: 30000 })

    // Verify differentiation advice is provided
    const differentiationResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(differentiationResponse).toContainText(['differentiat', 'accommodat', 'modif', 'support'])

    // Teacher asks about assessment
    const assessmentQuery = "What assessment strategies would work well with this fractions lesson?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(assessmentQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText(assessmentQuery)).toBeVisible()
    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(6)', { timeout: 30000 })

    // Verify complete conversation history is maintained
    const messageCount = await page.locator('[data-testid="user-message"], [data-testid="assistant-message"]').count()
    expect(messageCount).toBe(6) // 3 user messages + 3 AI responses
  })

  test('Classroom management scenario @teacher-workflow', async ({ page }) => {
    // Teacher seeks help with challenging classroom situation
    const managementQuery = "I have a student who is constantly disrupting class by calling out and not following directions. How can I address this behavior while maintaining a positive learning environment?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(managementQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText(managementQuery)).toBeVisible()
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Verify AI provides practical classroom management advice
    const managementResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(managementResponse).toContainText(['behavior', 'positive', 'strategy', 'support'])

    // Teacher asks for specific intervention strategies
    const interventionQuery = "Can you suggest specific intervention strategies that I can implement immediately?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(interventionQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(4)', { timeout: 30000 })

    const interventionResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(interventionResponse).toContainText(['specific', 'strategy', 'implement'])
  })

  test('Student engagement inquiry workflow @teacher-workflow', async ({ page }) => {
    // Teacher seeks help with student engagement
    const engagementQuery = "My 7th grade math students seem bored and disengaged during lessons. What are some interactive teaching strategies I can use to make algebra more engaging?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(engagementQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Verify AI provides engagement strategies
    const engagementResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(engagementResponse).toContainText(['interactive', 'engage', 'algebra', '7th grade'])

    // Teacher requests specific activity ideas
    const activityQuery = "Can you give me 3 specific algebra activities I can try next week?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(activityQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(4)', { timeout: 30000 })

    const activityResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(activityResponse).toContainText('algebra')

    // Should provide numbered or listed activities
    expect(await activityResponse.textContent()).toMatch(/[1-3]\.|\d+\)/g)
  })

  test('Curriculum standards alignment @teacher-workflow', async ({ page }) => {
    // Teacher needs help aligning lessons with standards
    const standardsQuery = "I need to align my 5th grade science unit on ecosystems with Common Core and NGSS standards. Can you help me identify the key standards and create learning objectives?"

    await page.getByPlaceholder(/Ask about lesson plans/).fill(standardsQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    const standardsResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(standardsResponse).toContainText(['standards', 'NGSS', 'objectives', 'ecosystem'])
  })

  test('Technology integration guidance @teacher-workflow', async ({ page }) => {
    // Teacher wants to integrate technology into teaching
    const techQuery = "How can I effectively integrate technology into my elementary reading lessons? I want to use digital tools but maintain hands-on learning experiences."

    await page.getByPlaceholder(/Ask about lesson plans/).fill(techQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    const techResponse = page.locator('[data-testid="assistant-message"]').last()
    await expect(techResponse).toContainText(['technology', 'digital', 'reading', 'elementary'])
  })
})

test.describe('Chat Persistence Across Sessions', () => {
  test('Messages persist across browser refresh @teacher-workflow', async ({ page }) => {
    // Send a message
    const testMessage = "Test message for persistence - creating a reading comprehension lesson"

    await page.goto('/chat')
    await page.getByPlaceholder(/Ask about lesson plans/).fill(testMessage)
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText(testMessage)).toBeVisible()
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Refresh the page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify message history persists
    await expect(page.getByText(testMessage)).toBeVisible()

    // Verify AI response also persists
    const persistedResponse = page.locator('[data-testid="assistant-message"]')
    await expect(persistedResponse).toBeVisible()
  })

  test('Chat continues seamlessly after page refresh @teacher-workflow', async ({ page }) => {
    // Start a conversation
    await page.goto('/chat')

    const firstMessage = "I'm planning a unit on American Revolution for 8th graders"
    await page.getByPlaceholder(/Ask about lesson plans/).fill(firstMessage)
    await page.getByRole('button', { name: /send/i }).click()

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Refresh page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Continue the conversation
    const followUpMessage = "What primary sources would be good for this unit?"
    await page.getByPlaceholder(/Ask about lesson plans/).fill(followUpMessage)
    await page.getByRole('button', { name: /send/i }).click()

    // Verify both old and new messages are present
    await expect(page.getByText(firstMessage)).toBeVisible()
    await expect(page.getByText(followUpMessage)).toBeVisible()

    await page.waitForSelector('[data-testid="assistant-message"]:nth-child(4)', { timeout: 30000 })

    // Should have 2 user messages and 2 AI responses
    const totalMessages = await page.locator('[data-testid="user-message"], [data-testid="assistant-message"]').count()
    expect(totalMessages).toBe(4)
  })
})

test.describe('Error Handling and Recovery', () => {
  test('Graceful handling of network errors @teacher-workflow', async ({ page }) => {
    await page.goto('/chat')

    // Simulate network failure by blocking the API endpoint
    await page.route('/api/chat', route => route.abort())

    const testMessage = "This should trigger a network error"
    await page.getByPlaceholder(/Ask about lesson plans/).fill(testMessage)
    await page.getByRole('button', { name: /send/i }).click()

    // Should show user message immediately
    await expect(page.getByText(testMessage)).toBeVisible()

    // Should show appropriate error message
    await expect(page.getByText(/network error/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/check your internet connection/i)).toBeVisible()

    // Input should be re-enabled for retry
    const input = page.getByPlaceholder(/Ask about lesson plans/)
    await expect(input).toBeEnabled()
  })

  test('Recovery after network restoration @teacher-workflow', async ({ page }) => {
    await page.goto('/chat')

    // Block API initially
    await page.route('/api/chat', route => route.abort())

    const testMessage = "This will fail first, then succeed"
    await page.getByPlaceholder(/Ask about lesson plans/).fill(testMessage)
    await page.getByRole('button', { name: /send/i }).click()

    // Wait for error
    await expect(page.getByText(/network error/i)).toBeVisible()

    // Restore network by removing the route block
    await page.unroute('/api/chat')

    // Retry the same message
    await page.getByPlaceholder(/Ask about lesson plans/).fill(testMessage)
    await page.getByRole('button', { name: /send/i }).click()

    // Should now succeed
    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Should not show error anymore
    await expect(page.getByText(/network error/i)).not.toBeVisible()
  })
})

test.describe('Mobile Teacher Experience', () => {
  test('Mobile responsive design for teachers on-the-go @teacher-workflow', async ({ page }) => {
    // Simulate mobile viewport (common teacher devices)
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE size

    await page.goto('/chat')
    await page.waitForLoadState('networkidle')

    // Verify mobile layout
    const header = page.locator('h1:has-text("Teacher AI Assistant")')
    await expect(header).toBeVisible()

    // Chat interface should be fully functional on mobile
    const input = page.getByPlaceholder(/Ask about lesson plans/)
    await expect(input).toBeVisible()

    // Test typing and sending on mobile
    const mobileQuery = "Quick question about homework policies"
    await input.fill(mobileQuery)
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText(mobileQuery)).toBeVisible()

    // Verify mobile-friendly message display
    const userMessage = page.locator('[data-testid="user-message"]')
    await expect(userMessage).toBeVisible()

    // Messages should be properly sized for mobile reading
    const messageWidth = await userMessage.boundingBox()
    expect(messageWidth?.width).toBeLessThan(350) // Should fit mobile screen with margin
  })

  test('Touch interactions work properly on mobile @teacher-workflow', async ({ page }) => {
    await page.setViewportSize({ width: 414, height: 896 }) // iPhone 11 size

    await page.goto('/chat')

    // Test touch interaction with send button
    const input = page.getByPlaceholder(/Ask about lesson plans/)
    await input.fill("Touch test message")

    const sendButton = page.getByRole('button', { name: /send/i })

    // Verify button is appropriately sized for touch
    const buttonBox = await sendButton.boundingBox()
    expect(buttonBox?.height).toBeGreaterThan(40) // Minimum touch target size

    await sendButton.click()
    await expect(page.getByText("Touch test message")).toBeVisible()
  })
})

test.describe('Accessibility for Educational Environments', () => {
  test('Screen reader compatibility for vision-impaired teachers @accessibility', async ({ page }) => {
    await page.goto('/chat')

    // Verify essential accessibility attributes
    const input = page.getByRole('textbox')
    await expect(input).toHaveAttribute('aria-label')

    const sendButton = page.getByRole('button', { name: /send/i })
    await expect(sendButton).toBeVisible()

    // Send a message and verify response has proper structure
    await input.fill("Test accessibility message")
    await sendButton.click()

    await page.waitForSelector('[data-testid="assistant-message"]', { timeout: 30000 })

    // Verify messages have proper semantic structure
    const userMessage = page.locator('[data-testid="user-message"]')
    const aiMessage = page.locator('[data-testid="assistant-message"]')

    await expect(userMessage).toHaveAttribute('role')
    await expect(aiMessage).toHaveAttribute('role')
  })

  test('Keyboard navigation for teachers with motor disabilities @accessibility', async ({ page }) => {
    await page.goto('/chat')

    // Test tab navigation
    await page.keyboard.press('Tab')

    // Should focus on input field
    const input = page.getByPlaceholder(/Ask about lesson plans/)
    await expect(input).toBeFocused()

    // Type message using keyboard only
    await page.keyboard.type("Keyboard navigation test message")

    // Tab to send button
    await page.keyboard.press('Tab')
    const sendButton = page.getByRole('button', { name: /send/i })
    await expect(sendButton).toBeFocused()

    // Send using Enter key
    await page.keyboard.press('Enter')

    await expect(page.getByText("Keyboard navigation test message")).toBeVisible()
  })

  test('High contrast mode for teachers with visual impairments @accessibility', async ({ page }) => {
    await page.goto('/chat')

    // Force high contrast mode (simulating Windows high contrast)
    await page.addStyleTag({
      content: `
        @media (prefers-contrast: high) {
          * {
            background-color: black !important;
            color: white !important;
            border-color: white !important;
          }
        }
      `
    })

    // Verify interface remains functional in high contrast
    const input = page.getByPlaceholder(/Ask about lesson plans/)
    await expect(input).toBeVisible()

    await input.fill("High contrast test message")
    await page.getByRole('button', { name: /send/i }).click()

    await expect(page.getByText("High contrast test message")).toBeVisible()
  })
})