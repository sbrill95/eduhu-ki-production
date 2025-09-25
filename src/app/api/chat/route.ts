import { OpenAIProvider, type ChatMessage } from '@/lib/ai'
import { NextRequest } from 'next/server'
import { addMessageToSession, getChatSession, validateSessionAccess } from '@/lib/database'
import { getContextualConversation } from '@/lib/session-context'
import { extractMemoriesFromMessage, saveMemory } from '@/lib/memory'
import { db } from '@/lib/instant'

export const runtime = 'edge' // For low latency
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, sessionId, teacherId, fileAttachments } = body

    // Process file attachments if provided
    let processedFileAttachments: any[] = []
    if (fileAttachments && Array.isArray(fileAttachments) && fileAttachments.length > 0) {
      // Fetch full file details from database using file IDs
      try {
        const fileQuery = await db.useQuery({
          file_uploads: {
            $: {
              where: {
                id: { in: fileAttachments.map((f: any) => f.id || f.fileId) },
                teacher_id: teacherId
              }
            }
          }
        })

        if (fileQuery.data?.file_uploads) {
          processedFileAttachments = Object.values(fileQuery.data.file_uploads)
            .filter(file => file.processing_status === 'completed')
        }

        console.log(`Processed ${processedFileAttachments.length} file attachments for chat`)
      } catch (fileError) {
        console.warn('Failed to fetch file attachments:', fileError)
        // Continue without file attachments rather than failing the entire request
      }
    }

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 })
    }

    // Validate session parameters for multi-session support
    if (sessionId && !teacherId) {
      return new Response('Teacher ID required when session ID provided', { status: 400 })
    }

    // Validate session access if session ID is provided
    if (sessionId && teacherId) {
      const hasAccess = await validateSessionAccess(sessionId, teacherId)
      if (!hasAccess) {
        return new Response('Unauthorized access to session', { status: 403 })
      }
    }

    // Security: Basic rate limiting check (in production, use proper rate limiting)
    if (messages.length > 50) {
      return new Response('Too many messages', { status:429 })
    }

    // Validate message format and handle file attachments
    const validMessages: ChatMessage[] = messages.map((msg: any, index: number) => {
      if (!msg.content || !msg.role || !['user', 'assistant'].includes(msg.role)) {
        throw new Error('Invalid message format')
      }

      // Handle file attachments for the last user message if provided
      if (msg.role === 'user' && index === messages.length - 1 && processedFileAttachments && processedFileAttachments.length > 0) {
        return OpenAIProvider.createMessageWithFiles(
          String(msg.content).trim(),
          msg.role,
          processedFileAttachments
        )
      }

      return {
        role: msg.role,
        content: String(msg.content).trim()
      }
    })

    // Get contextual conversation if session ID provided
    let contextualMessages = validMessages
    let responseMetadata: any = {
      hasFileAttachments: processedFileAttachments.length > 0,
      fileAttachmentCount: processedFileAttachments.length
    }

    if (sessionId && teacherId) {
      try {
        const contextResult = await getContextualConversation(sessionId, {
          includeMemories: true,
          maxMessages: 20, // Limit context for token management
          includeSystemPrompts: true
        })

        // Use contextual messages instead of raw messages
        if (contextResult.messages.length > 0) {
          contextualMessages = contextResult.messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content
          }))
        }

        responseMetadata = {
          sessionType: contextResult.contextMetadata.sessionType,
          hasMemories: contextResult.contextMetadata.hasMemories,
          hasFileAttachments: processedFileAttachments.length > 0,
          fileAttachmentCount: processedFileAttachments.length
        }

        console.log(`Using contextual conversation for session ${sessionId}:`, {
          originalMessages: validMessages.length,
          contextualMessages: contextualMessages.length,
          hasMemories: contextResult.contextMetadata.hasMemories
        })
      } catch (contextError) {
        console.warn('Failed to load contextual conversation, using original messages:', contextError)
        // Continue with original messages if context loading fails
      }
    }

    // Get streaming response from OpenAI with contextual messages
    const startTime = Date.now()
    const stream = await OpenAIProvider.streamMessage(contextualMessages)

    const encoder = new TextEncoder()

    // Track response content for database storage
    let fullResponse = ''
    let totalTokens = 0

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''

            if (content) {
              fullResponse += content

              // Send chunk as Server-Sent Event
              const data = JSON.stringify({
                content,
                type: 'content',
                metadata: responseMetadata
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            // Track token usage if available
            if (chunk.usage) {
              totalTokens = chunk.usage.total_tokens || 0
            }

            // Check if stream is done
            if (chunk.choices[0]?.finish_reason === 'stop') {
              const endTime = Date.now()
              const responseTime = endTime - startTime

              // Save messages to database if session provided
              if (sessionId && teacherId && validMessages.length > 0) {
                try {
                  // Save user message (last message should be from user)
                  const userMessage = validMessages[validMessages.length - 1]
                  if (userMessage && userMessage.role === 'user') {
                    // Extract text content from message (handling both string and array formats)
                    const textContent = typeof userMessage.content === 'string'
                      ? userMessage.content
                      : userMessage.content.find(part => part.type === 'text')?.text || ''

                    const userMessageId = await addMessageToSession(
                      sessionId,
                      textContent,
                      'user',
                      {
                        teacherId,
                        contentType: processedFileAttachments.length > 0 ? 'file_attachment' : 'text',
                        metadata: processedFileAttachments.length > 0 ? {
                          fileAttachments: processedFileAttachments.map(f => ({
                            id: f.id,
                            filename: f.original_filename,
                            fileType: f.file_type,
                            fileUrl: f.file_url,
                            hasExtractedText: !!f.extracted_text
                          }))
                        } : undefined
                      }
                    )

                    // Update file attachments to link to this message
                    if (processedFileAttachments.length > 0) {
                      try {
                        const fileUpdates = processedFileAttachments.map(file =>
                          db.tx.file_uploads[file.id].update({
                            message_id: userMessageId,
                            session_id: sessionId
                          })
                        )

                        await db.transact(fileUpdates)
                        console.log(`Linked ${processedFileAttachments.length} files to message ${userMessageId}`)
                      } catch (linkError) {
                        console.warn('Failed to link files to message:', linkError)
                      }
                    }

                    // Extract and save memories from user message
                    try {
                      const memoryExtraction = await extractMemoriesFromMessage({
                        id: userMessageId,
                        session_id: sessionId,
                        teacher_id: teacherId,
                        content: userMessage.content,
                        role: 'user',
                        timestamp: Date.now(),
                        content_type: 'text'
                      }, teacherId)

                      // Save extracted memories
                      for (const memory of memoryExtraction.extracted) {
                        await saveMemory(
                          teacherId,
                          memory.key,
                          memory.value,
                          memory.type,
                          {
                            confidenceScore: memory.confidence,
                            sourceSessionId: sessionId
                          }
                        )
                      }

                      if (memoryExtraction.extracted.length > 0) {
                        console.log(`Extracted ${memoryExtraction.extracted.length} memories from message`)
                      }
                    } catch (memoryError) {
                      console.warn('Failed to extract memories:', memoryError)
                    }
                  }

                  // Save assistant response
                  if (fullResponse) {
                    await addMessageToSession(
                      sessionId,
                      fullResponse,
                      'assistant',
                      {
                        teacherId,
                        contentType: 'text',
                        tokenCount: totalTokens,
                        responseTimeMs: responseTime
                      }
                    )
                  }

                  console.log(`Saved conversation to session ${sessionId}`, {
                    responseTime,
                    tokens: totalTokens,
                    responseLength: fullResponse.length
                  })
                } catch (dbError) {
                  console.error('Failed to save messages to database:', dbError)
                  // Don't fail the response if database save fails
                }
              }

              const endData = JSON.stringify({
                type: 'done',
                finish_reason: 'stop',
                metadata: {
                  ...responseMetadata,
                  responseTime,
                  tokens: totalTokens,
                  saved: sessionId ? true : false
                }
              })
              controller.enqueue(encoder.encode(`data: ${endData}\n\n`))
              break
            }
          }
        } catch (error) {
          console.error('Streaming error:', error)
          const errorData = JSON.stringify({
            type: 'error',
            error: 'Streaming failed'
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Chat API error:', error)

    // Determine appropriate error status and message
    let status = 500
    let message = 'Internal server error'

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        status = 403
        message = 'Unauthorized access'
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        status = 400
        message = error.message
      } else {
        message = error.message
      }
    }

    // Return proper error response
    return new Response(
      JSON.stringify({
        error: message,
        type: 'api_error',
        timestamp: new Date().toISOString()
      }),
      {
        status,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}