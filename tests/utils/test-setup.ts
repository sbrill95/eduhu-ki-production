/**
 * Test setup utilities for eduhu.ki E2E and integration tests
 * Provides database setup, user management, and common test helpers
 */

import { v4 as uuidv4 } from 'uuid'

// Types for test data
export interface TestUser {
  id: string
  email: string
  name: string
  role: 'teacher' | 'admin'
  createdAt: number
}

export interface TestChat {
  id: string
  userId: string
  title: string
  createdAt: number
  updatedAt: number
}

export interface TestMessage {
  id: string
  chatId: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
}

// In-memory test data store
const testData = {
  users: new Map<string, TestUser>(),
  chats: new Map<string, TestChat>(),
  messages: new Map<string, TestMessage>(),
  sessions: new Map<string, any>()
}

/**
 * Setup test database with clean state
 */
export async function setupTestDatabase(): Promise<void> {
  // Clear all test data
  testData.users.clear()
  testData.chats.clear()
  testData.messages.clear()
  testData.sessions.clear()

  console.log('✅ Test database setup completed')
}

/**
 * Cleanup test database after tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  // Clean up any persistent test data
  testData.users.clear()
  testData.chats.clear()
  testData.messages.clear()
  testData.sessions.clear()

  console.log('🧹 Test database cleanup completed')
}

/**
 * Create a test user for testing scenarios
 */
export async function createTestUser(
  email: string,
  options: Partial<TestUser> = {}
): Promise<string> {
  const userId = uuidv4()
  const user: TestUser = {
    id: userId,
    email,
    name: options.name || `Test User ${userId.slice(0, 8)}`,
    role: options.role || 'teacher',
    createdAt: Date.now(),
    ...options
  }

  testData.users.set(userId, user)
  return userId
}

/**
 * Create a test chat session
 */
export async function createTestChat(
  userId: string,
  title: string,
  options: Partial<TestChat> = {}
): Promise<string> {
  const chatId = uuidv4()
  const chat: TestChat = {
    id: chatId,
    userId,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...options
  }

  testData.chats.set(chatId, chat)
  return chatId
}

/**
 * Add a test message to a chat
 */
export async function addTestMessage(
  chatId: string,
  content: string,
  role: TestMessage['role'] = 'user',
  options: Partial<TestMessage> = {}
): Promise<string> {
  const messageId = uuidv4()
  const message: TestMessage = {
    id: messageId,
    chatId,
    content,
    role,
    timestamp: Date.now(),
    ...options
  }

  testData.messages.set(messageId, message)

  // Update chat's updatedAt timestamp
  const chat = testData.chats.get(chatId)
  if (chat) {
    chat.updatedAt = Date.now()
    testData.chats.set(chatId, chat)
  }

  return messageId
}

/**
 * Get test user by ID
 */
export function getTestUser(userId: string): TestUser | undefined {
  return testData.users.get(userId)
}

/**
 * Get test chat by ID
 */
export function getTestChat(chatId: string): TestChat | undefined {
  return testData.chats.get(chatId)
}

/**
 * Get test messages for a chat
 */
export function getTestMessages(chatId: string): TestMessage[] {
  return Array.from(testData.messages.values())
    .filter(msg => msg.chatId === chatId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get all chats for a user
 */
export function getUserChats(userId: string): TestChat[] {
  return Array.from(testData.chats.values())
    .filter(chat => chat.userId === userId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Create a complete test scenario with user, chat, and messages
 */
export async function createTestScenario(scenarioName: string) {
  const scenarios = {
    'teacher-math-lesson': async () => {
      const userId = await createTestUser('math.teacher@eduhu.test', {
        name: 'Ms. Johnson',
        role: 'teacher'
      })

      const chatId = await createTestChat(userId, 'Math Lesson Planning')

      await addTestMessage(chatId, 'I need help creating a lesson plan for teaching fractions to 4th graders', 'user')
      await addTestMessage(chatId, 'I\'d be happy to help you create an engaging fractions lesson for 4th graders! Here\'s a comprehensive lesson plan...', 'assistant')

      return { userId, chatId }
    },

    'teacher-multiple-subjects': async () => {
      const userId = await createTestUser('multi.teacher@eduhu.test', {
        name: 'Mr. Rodriguez',
        role: 'teacher'
      })

      // Create multiple chat sessions
      const mathChatId = await createTestChat(userId, 'Math: Multiplication Strategies')
      const scienceChatId = await createTestChat(userId, 'Science: Solar System')
      const englishChatId = await createTestChat(userId, 'English: Creative Writing')

      // Add messages to each chat
      await addTestMessage(mathChatId, 'What are effective strategies for teaching multiplication to 3rd graders?', 'user')
      await addTestMessage(mathChatId, 'Here are several proven strategies for teaching multiplication to 3rd graders...', 'assistant')

      await addTestMessage(scienceChatId, 'Help me plan a solar system unit for elementary students', 'user')
      await addTestMessage(scienceChatId, 'Let\'s create an engaging solar system unit! Here\'s a comprehensive plan...', 'assistant')

      await addTestMessage(englishChatId, 'I need creative writing prompts for middle school students', 'user')
      await addTestMessage(englishChatId, 'Here are some engaging creative writing prompts for middle schoolers...', 'assistant')

      return { userId, chatIds: [mathChatId, scienceChatId, englishChatId] }
    },

    'new-teacher-guidance': async () => {
      const userId = await createTestUser('new.teacher@eduhu.test', {
        name: 'Sarah Chen',
        role: 'teacher'
      })

      const chatId = await createTestChat(userId, 'New Teacher Support')

      await addTestMessage(chatId, 'I\'m a new teacher starting my first year. What are the most important classroom management strategies?', 'user')
      await addTestMessage(chatId, 'Congratulations on starting your teaching career! Here are the essential classroom management strategies...', 'assistant')

      await addTestMessage(chatId, 'How do I handle difficult parent-teacher conferences?', 'user')
      await addTestMessage(chatId, 'Parent-teacher conferences can be challenging, but with the right approach, they become opportunities...', 'assistant')

      return { userId, chatId }
    },

    'empty-teacher-account': async () => {
      const userId = await createTestUser('empty.teacher@eduhu.test', {
        name: 'Empty Account Teacher',
        role: 'teacher'
      })

      return { userId }
    }
  }

  const scenario = scenarios[scenarioName as keyof typeof scenarios]
  if (!scenario) {
    throw new Error(`Unknown test scenario: ${scenarioName}`)
  }

  return await scenario()
}

/**
 * Wait for element with custom timeout and better error messages
 */
export function waitForSelector(selector: string, timeout: number = 5000) {
  return {
    timeout,
    state: 'visible' as const,
    // Custom error message for better debugging
    get description() {
      return `Waiting for "${selector}" to be visible within ${timeout}ms`
    }
  }
}

/**
 * Generate realistic teacher-focused test messages
 */
export const teacherTestMessages = {
  lessonPlanning: [
    'Help me create a lesson plan for teaching the American Revolution to 5th graders',
    'I need ideas for hands-on science experiments about magnetism',
    'What are some engaging ways to teach fractions using real-world examples?',
    'How can I make Shakespeare more accessible to high school freshmen?'
  ],

  classroomManagement: [
    'What are effective strategies for managing a noisy classroom?',
    'How do I handle students who consistently forget their homework?',
    'What\'s the best way to organize group work activities?',
    'How can I create a more inclusive classroom environment?'
  ],

  assessment: [
    'What are alternatives to traditional tests for assessing student learning?',
    'How do I give constructive feedback on student essays?',
    'What are some quick formative assessment techniques I can use daily?',
    'How do I track student progress in reading comprehension?'
  ],

  parentCommunication: [
    'How do I communicate with parents about their child\'s behavior issues?',
    'What should I include in weekly parent newsletters?',
    'How do I handle parent complaints about grades?',
    'What\'s the best way to involve parents in their child\'s learning?'
  ],

  technology: [
    'How can I integrate tablets into my math lessons effectively?',
    'What are some good educational apps for elementary reading?',
    'How do I teach digital citizenship to middle schoolers?',
    'What are creative ways to use presentation software in lessons?'
  ]
}

/**
 * Generate random teacher test message
 */
export function getRandomTeacherMessage(): string {
  const categories = Object.keys(teacherTestMessages) as Array<keyof typeof teacherTestMessages>
  const randomCategory = categories[Math.floor(Math.random() * categories.length)]
  const messages = teacherTestMessages[randomCategory]
  return messages[Math.floor(Math.random() * messages.length)]
}

/**
 * Performance testing utilities
 */
export const performanceHelpers = {
  /**
   * Measure execution time of an async operation
   */
  async measureTime<T>(operation: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
    const startTime = performance.now()
    const result = await operation()
    const endTime = performance.now()
    return {
      result,
      timeMs: endTime - startTime
    }
  },

  /**
   * Assert operation completes within time limit
   */
  async assertWithinTime<T>(
    operation: () => Promise<T>,
    maxTimeMs: number,
    operationName: string = 'Operation'
  ): Promise<T> {
    const { result, timeMs } = await this.measureTime(operation)

    if (timeMs > maxTimeMs) {
      throw new Error(`${operationName} took ${timeMs}ms, expected under ${maxTimeMs}ms`)
    }

    console.log(`✅ ${operationName} completed in ${timeMs}ms (under ${maxTimeMs}ms limit)`)
    return result
  },

  /**
   * Run operation multiple times and get average timing
   */
  async benchmarkOperation<T>(
    operation: () => Promise<T>,
    iterations: number = 5
  ): Promise<{ averageTimeMs: number; results: T[] }> {
    const results: T[] = []
    const times: number[] = []

    for (let i = 0; i < iterations; i++) {
      const { result, timeMs } = await this.measureTime(operation)
      results.push(result)
      times.push(timeMs)
    }

    const averageTimeMs = times.reduce((sum, time) => sum + time, 0) / times.length

    console.log(`📊 Benchmark completed: ${iterations} iterations, average ${averageTimeMs}ms`)
    return { averageTimeMs, results }
  }
}

/**
 * Mock data generators for consistent testing
 */
export const mockDataGenerators = {
  /**
   * Generate a realistic AI response for educational queries
   */
  generateAIResponse(userMessage: string): string {
    const responses = {
      lessonPlan: 'Here\'s a comprehensive lesson plan that will engage your students and meet learning objectives...',
      classroomManagement: 'For effective classroom management, I recommend these proven strategies...',
      assessment: 'Here are several assessment approaches that will help you gauge student understanding...',
      parentCommunication: 'When communicating with parents, it\'s important to be clear, positive, and solution-focused...',
      general: 'I\'d be happy to help with that! Here are some ideas and strategies you can implement...'
    }

    // Simple keyword matching to return appropriate response type
    const lowerMessage = userMessage.toLowerCase()
    if (lowerMessage.includes('lesson') || lowerMessage.includes('plan')) return responses.lessonPlan
    if (lowerMessage.includes('manage') || lowerMessage.includes('behavior')) return responses.classroomManagement
    if (lowerMessage.includes('assess') || lowerMessage.includes('test')) return responses.assessment
    if (lowerMessage.includes('parent')) return responses.parentCommunication

    return responses.general
  },

  /**
   * Generate streaming response chunks
   */
  generateStreamingChunks(fullResponse: string, chunkSize: number = 10): string[] {
    const chunks: string[] = []
    for (let i = 0; i < fullResponse.length; i += chunkSize) {
      chunks.push(fullResponse.slice(i, i + chunkSize))
    }
    return chunks
  }
}

/**
 * Test environment validation
 */
export async function validateTestEnvironment(): Promise<void> {
  // Check that we're in test mode
  if (!process.env.NODE_ENV?.includes('test')) {
    console.warn('⚠️ Warning: Not running in test environment')
  }

  // Check required test configuration
  const requiredEnvVars = [
    'INSTANTDB_APP_ID',
    'OPENAI_API_KEY'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar] || process.env[envVar]?.includes('your-')) {
      console.warn(`⚠️ Warning: ${envVar} not properly configured for testing`)
    }
  }

  console.log('🔧 Test environment validation completed')
}

/**
 * Export all test utilities
 */
export default {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestUser,
  createTestChat,
  addTestMessage,
  getTestUser,
  getTestChat,
  getTestMessages,
  getUserChats,
  createTestScenario,
  waitForSelector,
  teacherTestMessages,
  getRandomTeacherMessage,
  performanceHelpers,
  mockDataGenerators,
  validateTestEnvironment
}