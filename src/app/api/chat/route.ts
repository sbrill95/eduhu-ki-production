import { OpenAIProvider, type ChatMessage } from '@/lib/ai'
import { NextRequest } from 'next/server'

export const runtime = 'edge' // For low latency
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages } = body

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 })
    }

    // Security: Basic rate limiting check (in production, use proper rate limiting)
    if (messages.length > 50) {
      return new Response('Too many messages', { status:429 })
    }

    // Validate message format
    const validMessages: ChatMessage[] = messages.map((msg: any) => {
      if (!msg.content || !msg.role || !['user', 'assistant'].includes(msg.role)) {
        throw new Error('Invalid message format')
      }
      return {
        role: msg.role,
        content: String(msg.content).trim()
      }
    })

    // Get streaming response from OpenAI
    const stream = await OpenAIProvider.streamMessage(validMessages)

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''

            if (content) {
              // Send chunk as Server-Sent Event
              const data = JSON.stringify({
                content,
                type: 'content'
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }

            // Check if stream is done
            if (chunk.choices[0]?.finish_reason === 'stop') {
              const endData = JSON.stringify({
                type: 'done',
                finish_reason: 'stop'
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

    // Return proper error response
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
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