'use client'

import { useState } from 'react'
import ChatContainer from '@/components/chat/ChatContainer'
import ChatSidebar from '@/components/chat/ChatSidebar'
import { createChat } from '@/lib/database'
import { useMetricsDashboard } from '@/components/dev/MetricsDashboard'

export default function ChatPage() {
  const [chatId, setChatId] = useState<string | null>(null)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const { component: MetricsDashboard } = useMetricsDashboard()

  const handleChatSelect = (newChatId: string) => {
    setChatId(newChatId)
  }

  const handleNewChat = async () => {
    try {
      const newChatId = await createChat('New Conversation')
      setChatId(newChatId)
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  // If no chat is selected, show a welcome screen with option to create first chat
  if (!chatId) {
    return (
      <div className="h-full flex">
        <ChatSidebar currentChatId={chatId} onChatSelect={handleChatSelect} />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md">
            <div className="bg-primary/10 rounded-full p-8 mb-6 inline-block">
              <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Welcome to eduhu.ki</h2>
            <p className="text-gray-600 mb-6">
              Your AI-powered teaching assistant. Start a conversation to get help with lesson planning,
              teaching strategies, or any educational questions.
            </p>
            <button
              onClick={handleNewChat}
              className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Your First Conversation
            </button>
          </div>
        </div>
        {MetricsDashboard}
      </div>
    )
  }

  return (
    <div className="h-full flex">
      {!isSidebarCollapsed && (
        <ChatSidebar currentChatId={chatId} onChatSelect={handleChatSelect} />
      )}

      <div className="flex-1 flex flex-col">
        {/* Mobile/collapsed sidebar toggle */}
        <div className="lg:hidden flex items-center p-4 border-b border-gray-200 bg-white">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-medium text-gray-900">eduhu.ki</span>
        </div>

        <ChatContainer chatId={chatId} />
      </div>
      {MetricsDashboard}
    </div>
  )
}