'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function NewChatPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Generate a new session ID and redirect
    const newSessionId = crypto.randomUUID()
    router.replace(`/chat/${newSessionId}`)
  }, [router])

  return (
    <div className="h-full flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
}
