'use client'

import { use } from 'react'
import ChatContainer from '@/components/chat/ChatContainer'

interface ChatSessionPageProps {
  params: Promise<{ sessionId: string }>
}

export default function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { sessionId } = use(params)

  return <ChatContainer sessionId={sessionId} />
}
