# Project Architecture: eduhu.ki

## Technology Stack Overview

### Core Technologies
- **Framework**: Next.js 14+ (App Router)
- **Database**: InstantDB (Real-time, client-side)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **PWA**: Next-PWA plugin

### Supporting Libraries
- **UI Components**: Headless UI + Custom components
- **Icons**: Lucide React
- **State Management**: React Context + InstantDB subscriptions
- **Testing**: Vitest + React Testing Library
- **E2E Testing**: Playwright

## Directory Structure

```
eduhu-test/
├── src/                           # Source code
│   ├── app/                      # Next.js 13+ App Router
│   │   ├── globals.css           # Global styles
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page (feed)
│   │   ├── chat/                 # Chat interface
│   │   │   ├── page.tsx          # Chat list/new chat
│   │   │   └── [id]/page.tsx     # Individual chat
│   │   ├── library/              # History & artifacts
│   │   │   ├── page.tsx          # Library overview
│   │   │   ├── chats/            # Chat history
│   │   │   └── artifacts/        # Saved artifacts
│   │   └── settings/             # User preferences
│   │       └── page.tsx          # Settings page
│   ├── components/               # Reusable components
│   │   ├── ui/                   # Generic UI components
│   │   │   ├── button.tsx        # Button variants
│   │   │   ├── input.tsx         # Input components
│   │   │   ├── card.tsx          # Card layouts
│   │   │   └── index.ts          # Component exports
│   │   ├── chat/                 # Chat-specific components
│   │   │   ├── ChatMessage.tsx   # Message display
│   │   │   ├── ChatInput.tsx     # Message input
│   │   │   ├── ChatHistory.tsx   # Message history
│   │   │   └── TypingIndicator.tsx
│   │   ├── feed/                 # Home feed components
│   │   │   ├── ActivityCard.tsx  # Activity items
│   │   │   ├── QuickActions.tsx  # Action buttons
│   │   │   └── PersonalizedGreeting.tsx
│   │   ├── library/              # Library components
│   │   │   ├── SearchBar.tsx     # Search functionality
│   │   │   ├── FilterTabs.tsx    # Filter options
│   │   │   └── ItemGrid.tsx      # Content grid
│   │   └── layout/               # Layout components
│   │       ├── Navigation.tsx    # Main navigation
│   │       ├── Header.tsx        # Page headers
│   │       └── PWAPrompt.tsx     # Install prompt
│   ├── lib/                      # Utilities and services
│   │   ├── instantdb.ts          # Database configuration
│   │   ├── ai.ts                 # AI integration layer
│   │   ├── auth.ts               # Authentication utilities
│   │   ├── pwa.ts                # PWA utilities
│   │   ├── utils.ts              # Generic utilities
│   │   └── types.ts              # TypeScript definitions
│   ├── hooks/                    # Custom React hooks
│   │   ├── useChat.ts            # Chat functionality
│   │   ├── useInstantDB.ts       # Database operations
│   │   ├── useOffline.ts         # Offline detection
│   │   └── usePWA.ts             # PWA features
│   └── styles/                   # Styling
│       ├── globals.css           # Global CSS
│       └── components.css        # Component-specific styles
├── public/                       # Static assets
│   ├── icons/                    # PWA icons
│   │   ├── icon-192x192.png      # PWA icon sizes
│   │   ├── icon-512x512.png
│   │   └── apple-touch-icon.png
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker
├── docs/                         # Project documentation
│   ├── prd.md                    # Product requirements
│   ├── implementation-plan.md    # Technical plan
│   ├── ui-ux.md                  # Design guidelines
│   └── project-structure.md      # This file
├── tests/                        # Test files
│   ├── components/               # Component tests
│   ├── pages/                    # Page tests
│   ├── utils/                    # Utility tests
│   └── e2e/                      # End-to-end tests
├── claude.md                     # AI context file
├── workflow-rules.md             # Context Engineering rules
├── next.config.js                # Next.js configuration
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies
└── README.md                     # Project readme
```

## Data Architecture

### InstantDB Schema
```typescript
// Database schema definition
export interface Database {
  users: {
    id: string
    email: string
    name: string
    created_at: number
    preferences: UserPreferences
  }

  chats: {
    id: string
    user_id: string
    title: string
    created_at: number
    updated_at: number
    status: 'active' | 'archived'
  }

  messages: {
    id: string
    chat_id: string
    content: string
    role: 'user' | 'assistant'
    timestamp: number
    metadata?: MessageMetadata
  }

  artifacts: {
    id: string
    user_id: string
    title: string
    content: string
    type: ArtifactType
    tags: string[]
    created_at: number
    source_chat_id?: string
  }
}

// Supporting types
interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  feed_settings: FeedSettings
}

interface MessageMetadata {
  tokens?: number
  model?: string
  processing_time?: number
}

type ArtifactType = 'lesson-plan' | 'resource' | 'note' | 'template'

interface FeedSettings {
  show_recent_chats: boolean
  show_artifacts: boolean
  max_items: number
}
```

### Data Flow Patterns
```typescript
// Real-time subscriptions
const { data: chats, isLoading } = useQuery({
  chats: {
    $: {
      where: { user_id: currentUserId },
      order: { updated_at: 'desc' }
    }
  }
})

// Optimistic updates
const createMessage = (content: string) => {
  // Optimistically add to UI
  setMessages(prev => [...prev, {
    id: generateTempId(),
    content,
    role: 'user',
    timestamp: Date.now()
  }])

  // Persist to database
  db.transact([
    db.tx.messages[generateId()].update({
      chat_id: currentChatId,
      content,
      role: 'user',
      timestamp: Date.now()
    })
  ])
}
```

## Component Architecture

### Component Hierarchy
```
App
├── Layout
│   ├── Navigation
│   └── PWAPrompt
├── HomePage
│   ├── PersonalizedGreeting
│   ├── QuickActions
│   └── ActivityFeed
│       └── ActivityCard[]
├── ChatPage
│   ├── ChatHeader
│   ├── ChatHistory
│   │   └── ChatMessage[]
│   ├── TypingIndicator
│   └── ChatInput
└── LibraryPage
    ├── SearchBar
    ├── FilterTabs
    └── ItemGrid
        └── LibraryItem[]
```

### State Management Strategy
```typescript
// Global state structure
interface AppState {
  user: User | null
  currentChat: string | null
  offline: boolean
  pwaInstallPrompt: BeforeInstallPromptEvent | null
}

// Context providers
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <InstantDBProvider>
        {children}
      </InstantDBProvider>
    </AppContext.Provider>
  )
}
```

## Service Architecture

### AI Integration Layer
```typescript
// lib/ai.ts - Abstract AI interface
export interface AIProvider {
  sendMessage(messages: Message[]): Promise<string>
  generateTitle(messages: Message[]): Promise<string>
  extractArtifacts(content: string): Promise<Artifact[]>
}

// Future MCP integration
export class MCPProvider implements AIProvider {
  async sendMessage(messages: Message[]) {
    // MCP integration logic
  }
}

// Current placeholder implementation
export class OpenAIProvider implements AIProvider {
  async sendMessage(messages: Message[]) {
    // OpenAI API integration
  }
}
```

### PWA Service Layer
```typescript
// lib/pwa.ts - PWA utilities
export class PWAManager {
  static async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js')
    }
  }

  static async checkForUpdates() {
    // Update detection and notification
  }

  static async handleOfflineSync() {
    // Background sync for offline actions
  }
}
```

## Build and Deployment Architecture

### Next.js Configuration
```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
      }
    }
  ]
})

module.exports = withPWA({
  experimental: {
    appDir: true,
  },
  typescript: {
    strict: true,
  }
})
```

### Environment Configuration
```typescript
// Environment variables structure
interface Environment {
  NEXT_PUBLIC_INSTANTDB_APP_ID: string
  INSTANTDB_ADMIN_TOKEN: string
  NEXT_PUBLIC_APP_URL: string
  NEXT_PUBLIC_AI_PROVIDER: 'openai' | 'mcp'
  OPENAI_API_KEY?: string
  NODE_ENV: 'development' | 'production'
}
```

## Security Architecture

### Data Protection
- **Client-side encryption** for sensitive user data
- **InstantDB security rules** for access control
- **Environment variable protection** for API keys
- **Content Security Policy** headers

### Authentication Flow
```typescript
// lib/auth.ts - Authentication utilities
export class AuthManager {
  static async signIn(email: string): Promise<User> {
    // InstantDB authentication
  }

  static async signOut(): Promise<void> {
    // Clear local state and tokens
  }

  static getCurrentUser(): User | null {
    // Get current authenticated user
  }
}
```

This architecture provides a scalable foundation for the eduhu.ki PWA while maintaining simplicity and performance focus.