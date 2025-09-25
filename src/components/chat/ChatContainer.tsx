'use client'

import { useEffect, useRef, useState } from 'react'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import {
  useMessages,
  addMessage,
  createChatSession,
  DatabaseError,
  monitorQueryPerformance,
  useChatWithMessages
} from '@/lib/database'
import { sortMessagesByTimestamp } from '@/lib/database'
import type { Message } from '@/lib/instant'
import { startMetricsCollection, PerformanceMonitor } from '@/lib/metrics'
import { CacheManager } from '@/lib/cache'
import crypto from 'crypto'

interface ChatContainerProps {
  sessionId: string
}

// Extended message interface with file attachments
interface MessageWithAttachments extends Message {
  fileAttachments?: string[]
  attachments?: any[] // FileUpload objects
}

export default function ChatContainer({ sessionId }: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [currentChatId, setCurrentChatId] = useState(sessionId)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [requestStartTime, setRequestStartTime] = useState<number>(0)
  const [messagesWithAttachments, setMessagesWithAttachments] = useState<MessageWithAttachments[]>([])

  // Initialize metrics collection on component mount
  useEffect(() => {
    startMetricsCollection()
    return () => {
      // Cleanup would go here in production
    }
  }, [])

  // Load messages from database with performance monitoring
  const messagesQuery = useMessages(currentChatId, 100) // Limit to last 100 messages for performance
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = monitorQueryPerformance('chat-messages', messagesQuery)
  const messages = messagesData?.messages ? sortMessagesByTimestamp(messagesData.messages as Message[]) : []

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesWithAttachments, streamingContent])

  // Fetch file attachments for messages
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!messages.length) {
        setMessagesWithAttachments([])
        return
      }

      const messagesWithFiles = await Promise.all(
        messages.map(async (message: Message) => {
          // For now, we'll simulate file attachments since the database query needs to be implemented
          // In a real implementation, you would query the file_uploads table by message_id
          return {
            ...message,
            attachments: [] // Empty for now, would be populated from database query
          } as MessageWithAttachments
        })
      )

      setMessagesWithAttachments(messagesWithFiles)
    }

    fetchAttachments()
  }, [messages])

  // Create chat if it doesn't exist
  useEffect(() => {
    if (currentChatId && (!messagesData || messagesError)) {
      // Chat might not exist, we'll create it when first message is sent
    }
  }, [currentChatId, messagesData, messagesError])

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (isLoading) return // Prevent sending while already processing

    setError(null)
    setIsLoading(true)
    let activeChatId = currentChatId

    try {
      // Create chat if needed
      if (!activeChatId || messagesError) {
        const title = content.length > 50 ? `${content.substring(0, 50)  }...` : content
        const teacherId = `demo-teacher-${  crypto.randomUUID().substring(0, 8)}`; activeChatId = await createChatSession(teacherId, title)
        setCurrentChatId(activeChatId)
      }

      // Handle file uploads first if present
      let uploadedFileIds: string[] = []
      if (files && files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('teacherId', `demo-teacher-${  crypto.randomUUID().substring(0, 8)}`)
          formData.append('sessionId', activeChatId)

          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          })

          if (!uploadResponse.ok) {
            throw new Error(`Failed to upload ${file.name}`)
          }

          const uploadResult = await uploadResponse.json()
          return uploadResult.fileId
        })

        uploadedFileIds = await Promise.all(uploadPromises)
      }

      // 1. Save user message to database with enhanced tracking
      const userMessageId = await addMessage(activeChatId, content, 'user', {
        contentType: files && files.length > 0 ? 'file_attachment' : 'text',
        tokenCount: content.length, // Rough approximation
        educationalTopics: extractEducationalTopics(content),
        fileAttachments: uploadedFileIds
      })

      setRequestStartTime(Date.now())

      // 2. Prepare message history for API
      const allMessages = messages.length > 0 ? messages : []
      const newUserMessage = { id: userMessageId, chat_id: activeChatId, content, role: 'user' as const, timestamp: Date.now(), fileAttachments: uploadedFileIds }
      const currentMessages = [...allMessages, newUserMessage]

      // Format for OpenAI API (only recent messages to stay under token limits)
      const recentMessages = currentMessages
        .slice(-10) // Keep last 10 messages for context
        .map(msg => {
          let messageContent = msg.content

          // Add file information to message content if files are attached
          if (msg.fileAttachments && msg.fileAttachments.length > 0) {
            const fileInfo = `\n\n[Files attached: ${msg.fileAttachments.length} file(s)]`
            messageContent = messageContent + fileInfo
          }

          return {
            role: msg.role,
            content: messageContent
          }
        })

      // 3. Initialize streaming state
      setStreamingContent('')
      setStreamingMessageId('streaming')

      // 4. Start streaming from OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: recentMessages
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      // 5. Handle streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'content' && data.content) {
                accumulatedContent += data.content
                setStreamingContent(accumulatedContent)
              } else if (data.type === 'done') {
                // Streaming finished successfully
                break
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Streaming error')
              }
            } catch (parseError) {
              // Skip invalid JSON lines
              continue
            }
          }
        }
      }

      // Final check - ensure we have content
      if (!accumulatedContent.trim()) {
        throw new Error('No content received from AI')
      }

      // 4. Save completed assistant message to database with metrics
      const responseTime = Date.now() - requestStartTime
      await addMessage(activeChatId, accumulatedContent, 'assistant', {
        contentType: 'text',
        tokenCount: accumulatedContent.length,
        responseTimeMs: responseTime,
        educationalTopics: extractEducationalTopics(accumulatedContent)
      })

      // Track API performance metrics
      PerformanceMonitor.trackAPIPerformance({
        endpoint: '/api/chat',
        method: 'POST',
        statusCode: 200,
        duration: responseTime,
        timestamp: Date.now()
      })

      setStreamingContent('')
      setStreamingMessageId(null)

    } catch (error) {
      console.error('Error sending message:', error)

      // Enhanced error handling with specific database error messages
      if (error instanceof DatabaseError) {
        setError(error.message)
      } else if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          setError('Network error. Please check your internet connection and try again.')
        } else if (error.message.includes('API')) {
          setError('AI service temporarily unavailable. Please try again in a moment.')
        } else {
          setError(error.message)
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }

      setStreamingContent('')
      setStreamingMessageId(null)
    } finally {
      setIsLoading(false)
      setRequestStartTime(0)
    }
  }

  // Extract educational topics from content (simple keyword matching)
  const extractEducationalTopics = (content: string): string[] => {
    const topics: string[] = []
    const contentLower = content.toLowerCase()

    const topicKeywords = {
      'lesson-planning': ['lesson', 'curriculum', 'objectives', 'standards', 'plan'],
      'classroom-management': ['behavior', 'classroom', 'management', 'discipline', 'rules'],
      'student-assessment': ['assessment', 'rubric', 'grading', 'evaluation', 'test'],
      'curriculum-design': ['curriculum', 'scope', 'sequence', 'standards', 'outcomes'],
      'differentiation': ['differentiate', 'diverse', 'needs', 'accommodation', 'modification'],
      'technology': ['technology', 'digital', 'online', 'computer', 'app']
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        topics.push(topic)
      }
    }

    return topics
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Teacher AI Assistant</h1>
            <p className="text-sm text-gray-500">Ask questions about teaching, lesson planning, and education</p>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-gray-400 font-mono">
              Chat ID: {currentChatId?.substring(0, 8)}...
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 && !streamingMessageId ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="bg-primary/10 rounded-full p-6 mb-4">
              <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to eduhu.ki!</h3>
            <p className="text-gray-600 max-w-md">
              I'm your AI teaching assistant. Ask me about lesson planning, teaching strategies,
              student engagement, or any educational topic. How can I help you today?
            </p>
          </div>
        ) : (
          <>
            {messagesWithAttachments.map((message) => (
              <ChatMessage
                key={message.id}
                id={message.id}
                content={message.content}
                role={message.role}
                timestamp={message.timestamp}
                isStreaming={false}
                attachments={message.attachments || []}
              />
            ))}
            {/* Show streaming message */}
            {streamingMessageId && (
              <ChatMessage
                key="streaming"
                id="streaming"
                content={streamingContent}
                role="assistant"
                timestamp={Date.now()}
                isStreaming={true}
              />
            )}
          </>
        )}

        {/* Typing Indicator - only show when waiting for first response */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start mb-4">
            <div className="bg-white rounded-lg px-4 py-2 border border-gray-200 max-w-sm shadow-sm">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-600">AI is typing...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex justify-center mb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm text-red-800 font-medium">Something went wrong</p>
                  <p className="text-xs text-red-600 mt-1">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <ChatInput onSendMessage={handleSendMessage} disabled={isLoading} />
    </div>
  )
}