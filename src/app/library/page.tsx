'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LibraryPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('chats')

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Your Library</h1>
        <p className="text-sm text-gray-500">Access your chat history and saved resources</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Library Coming Soon</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Your chat history and saved resources will appear here.
          </p>
        </div>
      </div>
    </div>
  )
}
