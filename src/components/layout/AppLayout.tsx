'use client'

import BottomNavigation from '@/components/navigation/BottomNavigation'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      {/* Main content area */}
      <main className="flex-1 overflow-hidden pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}