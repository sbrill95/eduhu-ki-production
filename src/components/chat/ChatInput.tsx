'use client'

import { useState, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  disabled?: boolean
}

export default function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = () => {
    if (!message.trim() || disabled) return

    onSendMessage(message.trim())
    setMessage('')
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={disabled ? "AI is responding..." : "Ask a question about teaching..."}
            className={`w-full resize-none border rounded-lg px-4 py-3 text-sm max-h-32 transition-all duration-200 ${
              disabled
                ? 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'
                : 'border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent hover:border-gray-400'
            }`}
            rows={1}
            disabled={disabled}
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className={`p-3 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
            !message.trim() || disabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary-dark hover:scale-105 active:scale-95'
          }`}
        >
          {disabled ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {disabled
          ? "Please wait while the AI is responding..."
          : "Press Enter to send, Shift+Enter for new line"
        }
      </p>
    </div>
  )
}