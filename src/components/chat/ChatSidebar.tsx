'use client'

import { useChats, createChat } from '@/lib/database'
import { useState } from 'react'
import type { Chat } from '@/lib/instant'

interface ChatSidebarProps {
  currentChatId?: string | null
  onChatSelect: (chatId: string) => void
}

export default function ChatSidebar({ currentChatId, onChatSelect }: ChatSidebarProps) {
  const { data: chatsData, isLoading } = useChats(20) // Get last 20 chats
  const [isCreatingChat, setIsCreatingChat] = useState(false)

  const chats = chatsData?.chats || []

  const handleNewChat = async () => {
    setIsCreatingChat(true)
    try {
      const newChatId = await createChat('New Conversation')
      onChatSelect(newChatId)
    } catch (error) {
      console.error('Failed to create new chat:', error)
      // TODO: Add toast notification for error
    } finally {
      setIsCreatingChat(false)
    }
  }

  const formatChatTitle = (chat: Chat) => {
    if (chat.title && chat.title !== 'New Conversation') {
      return chat.title.length > 30 ? chat.title.substring(0, 30) + '...' : chat.title
    }
    return 'New Conversation'
  }

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
  }

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Conversations</h2>
          <button
            onClick={handleNewChat}
            disabled={isCreatingChat}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Start new conversation"
          >
            {isCreatingChat ? (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <div className="mb-2">
              <svg className="w-8 h-8 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p>No conversations yet.</p>
            <p className="text-xs mt-1">Start a new chat to begin!</p>
          </div>
        ) : (
          <div className="p-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onChatSelect(chat.id)}
                className={`w-full p-3 rounded-lg text-left transition-colors mb-1 ${
                  currentChatId === chat.id
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-medium text-sm mb-1">
                    {formatChatTitle(chat)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(chat.updated_at || chat.created_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-center space-x-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>eduhu.ki</span>
        </div>
      </div>
    </div>
  )
}