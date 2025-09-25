import type { Metadata } from 'next'
import './globals.css'
import PWASetup from '@/components/PWASetup'
import AppLayout from '@/components/layout/AppLayout'

export const metadata: Metadata = {
  title: 'eduhu.ki - Teacher AI Assistant',
  description: 'AI-powered assistant for teachers',
  manifest: '/manifest.json',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="min-h-screen">
        <PWASetup />
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  )
}
