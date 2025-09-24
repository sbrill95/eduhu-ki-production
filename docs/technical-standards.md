# Technical Standards & Guidelines: eduhu.ki

## Current Tech Stack (Phase 2 Completed)

### Core Technologies - **MANDATORY**
- **Frontend Framework**: Next.js 15 with App Router
- **Language**: TypeScript (strict mode required)
- **Database**: InstantDB (App ID: 39f14e13-9afb-4222-be45-3d2c231be3a1)
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI API (future: MCP protocol)
- **PWA**: Service workers, manifest, offline capabilities
- **Deployment**: Vercel

### Package Management
- **Node.js**: Version 18+
- **Package Manager**: npm (consistent across all environments)
- **Dependencies**: All additions require Technical Product Manager approval

---

## Development Standards

### Code Quality Requirements - **ALL TEAMS**

#### TypeScript Standards
```typescript
// REQUIRED: Strict TypeScript configuration
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}

// REQUIRED: Proper interface definitions
interface ChatMessage {
  id: string
  chat_id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: number
}

// REQUIRED: Explicit return types for functions
export async function createChat(title: string): Promise<Chat> {
  // Implementation
}
```

#### Error Handling Standards
```typescript
// REQUIRED: Consistent error handling pattern
class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

// REQUIRED: Try-catch with specific error types
try {
  await db.transact([...])
} catch (error) {
  if (error instanceof DatabaseError && error.retryable) {
    // Retry logic
  }
  throw new DatabaseError('Failed to save message', 'DB_SAVE_ERROR')
}
```

### Security Standards - **MANDATORY**

#### Environment Variables
```bash
# REQUIRED: .env.local structure
NEXT_PUBLIC_INSTANTDB_APP_ID=39f14e13-9afb-4222-be45-3d2c231be3a1
OPENAI_API_KEY=your-openai-api-key-here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# FORBIDDEN: Never commit actual API keys
# REQUIRED: Use .env.example for templates
```

#### Input Validation
```typescript
// REQUIRED: Input validation for all user inputs
import { z } from 'zod'

const ChatMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  role: z.enum(['user', 'assistant'])
})

export function validateMessage(input: unknown): ChatMessage {
  return ChatMessageSchema.parse(input)
}
```

---

## Backend Standards - **Backend Task Manager & Senior Backend Architect**

### InstantDB Patterns
```typescript
// REQUIRED: Consistent schema patterns
interface DatabaseSchema {
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
  }
}

// REQUIRED: Optimistic updates pattern
export async function addMessage(chatId: string, content: string, role: 'user' | 'assistant') {
  const tempId = generateTempId()

  // Optimistic UI update first
  optimisticUpdate(tempId, { chat_id: chatId, content, role, timestamp: Date.now() })

  try {
    // Database transaction
    const result = await db.transact([
      db.tx.messages[generateId()].update({
        chat_id: chatId,
        content,
        role,
        timestamp: Date.now()
      })
    ])

    // Update with real ID
    replaceOptimisticUpdate(tempId, result.id)
  } catch (error) {
    // Rollback optimistic update
    rollbackOptimisticUpdate(tempId)
    throw error
  }
}
```

### Real-time Subscription Patterns
```typescript
// REQUIRED: Consistent useQuery patterns
export function useMessages(chatId: string) {
  const { data: messages, isLoading, error } = useQuery({
    messages: {
      $: {
        where: { chat_id: chatId },
        order: { timestamp: 'asc' },
        limit: 100
      }
    }
  })

  return {
    messages: messages?.messages || [],
    isLoading,
    error
  }
}
```

---

## Frontend Standards - **Frontend Task Executor**

### Next.js App Router Patterns
```typescript
// REQUIRED: Server components for data fetching
export default async function ChatPage({ params }: { params: { id: string } }) {
  const chatData = await getChatData(params.id)

  return (
    <div>
      <ChatHeader chat={chatData} />
      <ChatContainer chatId={params.id} initialMessages={chatData.messages} />
    </div>
  )
}

// REQUIRED: Client components for interactivity
'use client'
export default function ChatInput({ onSend }: { onSend: (message: string) => void }) {
  const [message, setMessage] = useState('')

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      onSend(message)
      setMessage('')
    }}>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask a question..."
      />
    </form>
  )
}
```

### Component Architecture
```typescript
// REQUIRED: Consistent component patterns
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost'
  size: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
  onClick?: () => void
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  loading,
  children,
  onClick
}) => {
  return (
    <button
      className={cn(
        'rounded-lg font-medium transition-colors',
        variants[variant],
        sizes[size],
        loading && 'opacity-50 cursor-not-allowed'
      )}
      onClick={onClick}
      disabled={loading}
    >
      {loading && <Spinner className="mr-2" />}
      {children}
    </button>
  )
}
```

### PWA Standards
```typescript
// REQUIRED: Service worker registration
export function PWASetup() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError)
        })
    }
  }, [])

  return null
}
```

---

## Testing Standards - **QA Development Lead & Pre-deployment Tester**

### Unit Testing Requirements
```typescript
// REQUIRED: Test coverage for all utility functions
import { describe, it, expect } from 'vitest'
import { addMessage, validateMessage } from '../database'

describe('addMessage', () => {
  it('should create message with correct structure', async () => {
    const result = await addMessage('chat-123', 'Hello', 'user')

    expect(result).toMatchObject({
      chat_id: 'chat-123',
      content: 'Hello',
      role: 'user',
      timestamp: expect.any(Number)
    })
  })

  it('should handle database errors gracefully', async () => {
    // Mock database failure
    mockDatabaseError()

    await expect(addMessage('invalid-chat', 'Hello', 'user'))
      .rejects.toThrow('Failed to save message')
  })
})
```

### Integration Testing
```typescript
// REQUIRED: End-to-end chat flow testing
import { test, expect } from '@playwright/test'

test('complete chat workflow', async ({ page }) => {
  await page.goto('/chat')

  // Send message
  await page.fill('[data-testid="chat-input"]', 'What is photosynthesis?')
  await page.click('[data-testid="send-button"]')

  // Verify message appears
  await expect(page.locator('[data-testid="user-message"]')).toContainText('What is photosynthesis?')

  // Verify AI response
  await expect(page.locator('[data-testid="ai-message"]')).toBeVisible({ timeout: 10000 })

  // Verify persistence across page reload
  await page.reload()
  await expect(page.locator('[data-testid="user-message"]')).toContainText('What is photosynthesis?')
})
```

---

## DevOps Standards - **DevOps Specialist**

### Environment Configuration
```javascript
// REQUIRED: next.config.js structure
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

### Deployment Checklist
```bash
# REQUIRED: Pre-deployment validation
npm run build          # Build must succeed
npm run test          # All tests must pass
npm run lint          # No linting errors
npm run type-check    # TypeScript compilation must succeed

# REQUIRED: Environment validation
echo $NEXT_PUBLIC_INSTANTDB_APP_ID  # Must be production App ID
echo $OPENAI_API_KEY                # Must be set but not echoed in logs

# REQUIRED: Security scan
npm audit             # No high/critical vulnerabilities
```

---

## Communication Standards

### Code Review Requirements

#### All Pull Requests Must Include
1. **Clear Description**: What changes were made and why
2. **Testing Notes**: How the changes were tested
3. **Breaking Changes**: Any API or interface changes
4. **Performance Impact**: Any performance considerations

#### Review Checklist
- [ ] TypeScript compilation passes
- [ ] Tests added for new functionality
- [ ] Security considerations reviewed
- [ ] Performance impact assessed
- [ ] Documentation updated if needed

### Commit Message Standards
```
feat: add real-time message streaming to chat interface
fix: resolve database connection timeout in production
refactor: improve error handling in chat message validation
test: add integration tests for PWA installation flow
docs: update API documentation for message endpoints
```

---

## Performance Standards

### Core Web Vitals Requirements
- **LCP (Largest Contentful Paint)**: < 2.5 seconds
- **FID (First Input Delay)**: < 100 milliseconds
- **CLS (Cumulative Layout Shift)**: < 0.1

### Bundle Size Limits
- **Initial Bundle**: < 200KB gzipped
- **Route Bundles**: < 100KB gzipped each
- **Dynamic Imports**: Required for large dependencies

### Database Query Standards
```typescript
// REQUIRED: Pagination for large datasets
export function useMessages(chatId: string, limit = 50) {
  return useQuery({
    messages: {
      $: {
        where: { chat_id: chatId },
        order: { timestamp: 'desc' },
        limit
      }
    }
  })
}

// REQUIRED: Debouncing for search
const debouncedSearch = useMemo(
  () => debounce((query: string) => {
    // Search implementation
  }, 300),
  []
)
```

---

## Compliance & Approval Process

### Technical Decision Approval Matrix
- **Minor Changes**: Team member discretion
- **Component Changes**: Team lead approval
- **Architecture Changes**: Senior Backend Architect + Technical Product Manager approval
- **Stack Changes**: Full team discussion + Technical Product Manager approval

### Quality Gates
1. **Development Phase**: Unit tests pass, TypeScript compiles
2. **Integration Phase**: Integration tests pass, security scan clean
3. **Pre-deployment**: End-to-end tests pass, performance benchmarks met
4. **Production**: Monitoring confirms all systems operational

These standards ensure consistency, quality, and maintainability across the eduhu.ki codebase while enabling efficient collaboration between all team members.