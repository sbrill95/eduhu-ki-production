import OpenAI from 'openai'

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

// Rate limiting configuration
interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const rateLimitConfig: RateLimitConfig = {
  maxRequests: 30, // 30 requests per window
  windowMs: 60000, // 1 minute
}

// Simple in-memory rate limiting (for production, use Redis or similar)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

// Environment validation
function validateEnvironment() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey || apiKey === 'your-openai-api-key-here') {
    throw new Error('OPENAI_API_KEY environment variable is not set or invalid')
  }
  if (apiKey.length < 20) {
    throw new Error('OPENAI_API_KEY appears to be invalid (too short)')
  }
  return apiKey
}

// Initialize OpenAI with validation - defer during build
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    try {
      const apiKey = validateEnvironment()
      openai = new OpenAI({
        apiKey,
        timeout: 30000, // 30 second timeout
        maxRetries: 2, // Built-in retry logic
      })
    } catch (error) {
      console.error('Failed to initialize OpenAI:', error)
      throw error
    }
  }
  return openai
}

export class OpenAIProvider {
  // Rate limiting check
  private static checkRateLimit(identifier: string = 'global'): boolean {
    const now = Date.now()
    const userLimits = requestCounts.get(identifier)

    if (!userLimits || now > userLimits.resetTime) {
      // Reset or initialize
      requestCounts.set(identifier, {
        count: 1,
        resetTime: now + rateLimitConfig.windowMs
      })
      return true
    }

    if (userLimits.count >= rateLimitConfig.maxRequests) {
      return false // Rate limit exceeded
    }

    userLimits.count++
    return true
  }

  // Environment validation helper
  static validateEnvironment(): boolean {
    try {
      validateEnvironment()
      return true
    } catch (error) {
      console.error('Environment validation failed:', error)
      return false
    }
  }

  // Educational system prompt optimized for teachers
  private static getSystemPrompt(): ChatMessage {
    return {
      role: 'system',
      content: `You are an AI teaching assistant designed specifically for educators. Your role is to help teachers with:

- Lesson planning and curriculum development
- Teaching strategies and methodologies
- Student engagement techniques
- Educational resource recommendations
- Classroom management advice
- Assessment and evaluation strategies
- Professional development guidance

Keep responses:
- Practical and actionable
- Appropriate for K-12 and higher education
- Supportive and encouraging
- Grounded in educational best practices
- Concise but comprehensive

Always consider the teacher's time constraints and provide immediately useful advice.`
    }
  }

  // Standard response (non-streaming) with retry logic
  static async sendMessage(messages: ChatMessage[], identifier?: string): Promise<string> {
    // Rate limiting check
    if (!this.checkRateLimit(identifier)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.')
    }

    let lastError: Error | undefined
    const maxRetries = 3
    const baseDelay = 1000 // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const systemMessage = this.getSystemPrompt()
        const fullMessages = [systemMessage, ...messages]

        const response = await getOpenAIClient().chat.completions.create({
          model: process.env.NEXT_PUBLIC_AI_MODEL as string || 'gpt-4o-mini',
          messages: fullMessages,
          max_tokens: 1000,
          temperature: 0.7,
          presence_penalty: 0.1, // Encourage diverse responses
          frequency_penalty: 0.1, // Reduce repetition
        })

        const content = response.choices[0]?.message?.content
        if (!content) {
          throw new Error('Empty response from OpenAI API')
        }

        return content
      } catch (error) {
        lastError = error as Error
        console.error(`OpenAI API error (attempt ${attempt + 1}/${maxRetries}):`, error)

        // Don't retry on certain errors
        if (error instanceof OpenAI.APIError) {
          if (error.status === 401 || error.status === 403) {
            throw new Error('Invalid API key or insufficient permissions')
          }
          if (error.status === 429) {
            // Rate limited by OpenAI, wait longer
            if (attempt < maxRetries - 1) {
              await this.delay(baseDelay * Math.pow(2, attempt + 2)) // Exponential backoff
              continue
            }
            throw new Error('OpenAI API rate limit exceeded. Please try again later.')
          }
        }

        // Exponential backoff for retries
        if (attempt < maxRetries - 1) {
          await this.delay(baseDelay * Math.pow(2, attempt))
        }
      }
    }

    // All retries failed
    throw new Error(`Failed to get AI response after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`)
  }

  // Helper for delays
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Streaming response for real-time chat with error handling
  static async streamMessage(messages: ChatMessage[], identifier?: string) {
    // Rate limiting check
    if (!this.checkRateLimit(identifier)) {
      throw new Error('Rate limit exceeded. Please try again in a minute.')
    }

    try {
      const systemMessage = this.getSystemPrompt()
      const fullMessages = [systemMessage, ...messages]

      return await getOpenAIClient().chat.completions.create({
        model: process.env.NEXT_PUBLIC_AI_MODEL as string || 'gpt-4o-mini',
        messages: fullMessages,
        max_tokens: 1000,
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
        stream: true,
      })
    } catch (error) {
      console.error('OpenAI streaming error:', error)

      if (error instanceof OpenAI.APIError) {
        if (error.status === 401 || error.status === 403) {
          throw new Error('Invalid API key or insufficient permissions')
        }
        if (error.status === 429) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.')
        }
      }

      throw new Error('Failed to start AI response stream')
    }
  }

  // Fallback response for when AI is unavailable
  static getFallbackResponse(userMessage: string): string {
    const fallbacks = [
      "I apologize, but I'm currently experiencing technical difficulties. As an alternative, I'd recommend checking educational resources like Khan Academy, Edutopia, or reaching out to your teaching community for immediate assistance.",
      "I'm temporarily unable to provide a detailed response. For quick teaching help, consider browsing TeachersPayTeachers, Common Sense Education, or consulting with fellow educators in your school.",
      "Due to a technical issue, I can't generate a full response right now. For immediate teaching support, try educational blogs like We Are Teachers or contact your school's instructional coach."
    ]

    // Simple hash-based selection for consistency
    const index = Math.abs(userMessage.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % fallbacks.length
    return fallbacks[index]
  }

  // Helper to format messages for OpenAI API
  static formatMessagesForAPI(chatMessages: Array<{ content: string; role: 'user' | 'assistant' }>): ChatMessage[] {
    return chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  // Input validation
  static validateMessages(messages: ChatMessage[]): boolean {
    if (!Array.isArray(messages)) {
      return false
    }

    return messages.every(msg =>
      msg &&
      typeof msg.content === 'string' &&
      msg.content.trim().length > 0 &&
      ['user', 'assistant', 'system'].includes(msg.role) &&
      msg.content.length <= 10000 // Reasonable length limit
    )
  }

  // Get current rate limit status
  static getRateLimitStatus(identifier: string = 'global'): { remaining: number; resetTime: number } {
    const now = Date.now()
    const userLimits = requestCounts.get(identifier)

    if (!userLimits || now > userLimits.resetTime) {
      return {
        remaining: rateLimitConfig.maxRequests,
        resetTime: now + rateLimitConfig.windowMs
      }
    }

    return {
      remaining: Math.max(0, rateLimitConfig.maxRequests - userLimits.count),
      resetTime: userLimits.resetTime
    }
  }
}