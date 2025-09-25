import { useEffect, useState } from 'react'
import { FileUpload } from '@/lib/instant'

interface ChatMessageProps {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  isStreaming?: boolean
  attachments?: FileUpload[]
}

export default function ChatMessage({ content, role, timestamp, isStreaming = false, attachments = [] }: ChatMessageProps) {
  const isUser = role === 'user'
  const [displayContent, setDisplayContent] = useState(content)
  const [showCursor, setShowCursor] = useState(false)

  const timeString = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Get file type icon
  const getFileIcon = (fileType: string, size = 'w-6 h-6') => {
    if (fileType.startsWith('image/')) {
      return (
        <svg className={`${size} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    } else if (fileType === 'application/pdf') {
      return (
        <svg className={`${size} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return (
        <svg className={`${size} text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    } else {
      return (
        <svg className={`${size} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  }

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
    return Math.round(bytes / (1024 * 1024)) + ' MB'
  }

  // Handle file download/preview
  const handleFileAction = (file: FileUpload) => {
    if (file.file_url) {
      window.open(file.file_url, '_blank')
    }
  }

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
      <div className="flex flex-col max-w-xs md:max-w-md lg:max-w-lg">
        <div
          className={
            isUser
              ? 'chat-message-user'
              : 'chat-message-assistant'
          }
        >
          {/* File Attachments */}
          {attachments.length > 0 && (
            <div className="mb-3 space-y-2">
              {attachments.map((file) => (
                <div
                  key={file.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 hover:shadow-sm cursor-pointer ${
                    isUser
                      ? 'bg-white/10 border-white/20 hover:bg-white/20'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleFileAction(file)}
                >
                  <div className="flex-shrink-0">
                    {file.thumbnail_url ? (
                      <img
                        src={file.thumbnail_url}
                        alt={file.original_filename}
                        className="w-12 h-12 object-cover rounded border"
                      />
                    ) : (
                      getFileIcon(file.file_type, 'w-8 h-8')
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${
                      isUser ? 'text-white' : 'text-gray-900'
                    }`}>
                      {file.original_filename}
                    </div>
                    <div className={`text-xs mt-1 flex items-center space-x-2 ${
                      isUser ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      <span>{formatFileSize(file.file_size)}</span>
                      {file.processing_status && (
                        <>
                          <span>•</span>
                          <span className={`capitalize ${
                            file.processing_status === 'completed' ? 'text-green-600' :
                            file.processing_status === 'pending' ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {file.processing_status}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <svg
                      className={`w-4 h-4 ${isUser ? 'text-white/50' : 'text-gray-400'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Content */}
          {displayContent && (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {displayContent}
              {!isUser && showCursor && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse"></span>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {timeString}
          {attachments.length > 0 && (
            <span className="ml-2">
              📎 {attachments.length} file{attachments.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}