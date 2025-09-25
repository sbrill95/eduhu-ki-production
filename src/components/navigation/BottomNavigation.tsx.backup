'use client'

import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  action?: () => void
}

export default function BottomNavigation() {
  const router = useRouter()
  const pathname = usePathname()

  const handleNewChat = () => {
    // Generate a new session ID and navigate to it
    const newSessionId = crypto.randomUUID()
    router.push(`/chat/${newSessionId}`)
  }

  const navigationItems: NavigationItem[] = [
    {
      id: 'home',
      label: 'Home',
      href: '/',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'chat',
      label: 'New Chat',
      href: '/chat/new',
      action: handleNewChat,
      icon: (
        <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            {/* Owl icon representation */}
            <path d="M12 2C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.8V19c0 .6.4 1 1 1h6c.6 0 1-.4 1-1v-4.2c1.8-1.3 3-3.4 3-5.8 0-3.9-3.1-7-7-7zM9 8.5C8.2 8.5 7.5 7.8 7.5 7S8.2 5.5 9 5.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm6 0c-.8 0-1.5-.7-1.5-1.5S14.2 5.5 15 5.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
          </svg>
        </div>
      ),
    },
    {
      id: 'library',
      label: 'Library',
      href: '/library',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C20.832 18.477 19.246 18 17.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ]

  const handleNavigation = (item: NavigationItem) => {
    if (item.action) {
      item.action()
    } else {
      router.push(item.href)
    }
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    if (href === '/library') {
      return pathname.startsWith('/library')
    }
    if (href === '/chat/new') {
      return pathname.startsWith('/chat')
    }
    return false
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 pb-safe z-50">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navigationItems.map((item) => {
          const active = isActive(item.href)

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item)}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-w-0 flex-1',
                'hover:bg-gray-50 active:scale-95',
                active
                  ? 'text-primary'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              aria-label={item.label}
            >
              <div className={cn(
                'transition-all duration-200',
                active ? 'scale-110' : 'scale-100',
                item.id === 'chat' ? 'mb-1' : 'mb-2'
              )}>
                {item.icon}
              </div>
              <span className={cn(
                'text-xs font-medium transition-colors duration-200',
                active ? 'text-primary' : 'text-gray-500'
              )}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}