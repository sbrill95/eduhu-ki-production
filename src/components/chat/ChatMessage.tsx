import { useEffect, useState } from 'react'

interface ChatMessageProps {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  isStreaming?: boolean
}

export default function ChatMessage({ content, role, timestamp, isStreaming = false }: ChatMessageProps) {
  const isUser = role === 'user'
  const [displayContent, setDisplayContent] = useState(content)
  const [showCursor, setShowCursor] = useState(false)

  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Handle streaming animation for assistant messages
  useEffect(() => {
    if (isUser || !isStreaming) {
      setDisplayContent(content)
      setShowCursor(false)
      return
    }

    // Show cursor while streaming
    setShowCursor(true)
    setDisplayContent(content)

    // Hide cursor after streaming stops (no new content for a bit)
    const cursorTimeout = setTimeout(() => {
      setShowCursor(false)
    }, 1000)

    return () => clearTimeout(cursorTimeout)
  }, [content, isUser, isStreaming])

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className="flex flex-col max-w-xs md:max-w-md">
        <div
          className={
            isUser
              ? 'chat-message-user'
              : 'chat-message-assistant'
          }
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {displayContent}
            {!isUser && showCursor && (
              <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse"></span>
            )}
          </div>
        </div>
        <span className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {timeString}
        </span>
      </div>
    </div>
  )
}