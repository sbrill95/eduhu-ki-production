'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleStartChat = async () => {
    setIsLoading(true)
    // Generate a new session ID and navigate to it
    const newSessionId = crypto.randomUUID()
    router.push(`/chat/${newSessionId}`)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Welcome to eduhu.ki</h1>
            <p className="text-sm text-gray-500">Your AI-powered teaching assistant</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Welcome Section */}
          <div className="text-center">
            <div className="bg-primary/10 rounded-full p-8 mb-6 inline-block">
              <svg className="w-16 h-16 text-primary" fill="currentColor" viewBox="0 0 24 24">
                {/* Owl icon representation */}
                <path d="M12 2C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.8V19c0 .6.4 1 1 1h6c.6 0 1-.4 1-1v-4.2c1.8-1.3 3-3.4 3-5.8 0-3.9-3.1-7-7-7zM9 8.5C8.2 8.5 7.5 7.8 7.5 7S8.2 5.5 9 5.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm6 0c-.8 0-1.5-.7-1.5-1.5S14.2 5.5 15 5.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Hello, Teacher!</h2>
            <p className="text-lg text-gray-600 mb-8">
              Ready to enhance your teaching with AI-powered assistance? Get help with lesson planning,
              teaching strategies, student engagement, and more.
            </p>
            <button
              onClick={handleStartChat}
              disabled={isLoading}
              className="bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Starting...' : 'Start New Conversation'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center mb-3">
                <div className="bg-blue-100 rounded-lg p-3 mr-4">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Lesson Planning</h3>
                  <p className="text-sm text-gray-600">Create engaging lesson plans</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center mb-3">
                <div className="bg-green-100 rounded-lg p-3 mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Assessment Tools</h3>
                  <p className="text-sm text-gray-600">Design effective assessments</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center mb-3">
                <div className="bg-purple-100 rounded-lg p-3 mr-4">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Student Engagement</h3>
                  <p className="text-sm text-gray-600">Strategies to motivate students</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow">
              <div className="flex items-center mb-3">
                <div className="bg-orange-100 rounded-lg p-3 mr-4">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 21h10a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Curriculum Design</h3>
                  <p className="text-sm text-gray-600">Structure learning outcomes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Placeholder */}
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <h3 className="font-semibold text-gray-900 mb-2">Recent Activity</h3>
            <p className="text-gray-600">Your recent conversations and resources will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}
