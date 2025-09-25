# Backend Modernization Tasks for backend-todo-executor Agent

## Critical Database Migration & API Modernization

### Context
The application has been modernized with a dual-client InstantDB architecture for Edge Runtime compatibility. The backend-todo-executor agent needs to complete the database migration and optimize API routes.

### High-Priority Tasks

#### 1. Database Client Migration Strategy
**File**: `src/lib/database.ts`
**Status**: Partially implemented, needs completion

**Tasks**:
- [ ] **Complete dual-client implementation** for all database functions
- [ ] **Add migration utilities** to safely transition existing data
- [ ] **Implement connection pooling** for server-side operations
- [ ] **Add error handling** with automatic fallback between clients

**Specific Functions to Modernize**:
```typescript
// These functions need dual-client support:
- getChatSessions()
- getMessagesForSession()
- updateChatSession()
- generateContextualTitle()
- getSessionStatistics()
```

**Implementation Pattern**:
```typescript
export const functionName = async (...args) => {
  if (typeof window === 'undefined') {
    // Server-side: Edge Runtime compatible
    return await serverDb.operation(...)
  } else {
    // Client-side: React hooks enabled
    return await db.operation(...)
  }
}
```

#### 2. API Route Edge Runtime Optimization
**Priority**: CRITICAL - Required for deployment

**Files to Review**:
- `src/app/api/chat/route.ts` ✅ (Updated)
- `src/app/api/files/[...path]/route.ts` ⚠️ (Needs review)
- `src/app/api/upload/route.ts` ⚠️ (Needs review)
- `src/app/api/storage/*/route.ts` ⚠️ (Needs review)

**Required Changes**:
1. **Replace React hook imports** with server-side equivalents
2. **Update file processing** to use modern image processing
3. **Ensure Edge Runtime compatibility** for all operations

#### 3. File Processing Modernization
**File**: `src/lib/file-processing.ts`
**Status**: Partially migrated, needs completion

**Tasks**:
- [ ] **Complete migration** from canvas to modern image processing
- [ ] **Integrate modern-image-processing.ts** throughout
- [ ] **Add Edge Runtime optimized** file handling
- [ ] **Implement progressive enhancement** for different environments

#### 4. Memory Management System Update
**File**: `src/lib/memory.ts`
**Status**: Needs Edge Runtime compatibility

**Tasks**:
- [ ] **Update memory operations** to use server-side client
- [ ] **Add Edge Runtime compatible** memory extraction
- [ ] **Implement caching strategy** for serverless environments

### Medium-Priority Tasks

#### 5. Session Context Migration
**File**: `src/lib/session-context.ts`
**Status**: Currently disabled, needs modernization

**Tasks**:
- [ ] **Separate React hooks** from core logic
- [ ] **Create server-side context** management
- [ ] **Re-enable contextual conversation** with Edge Runtime support

#### 6. Database Performance Optimization
**Files**: `src/lib/database.ts`, `src/lib/instant-server.ts`

**Tasks**:
- [ ] **Implement query optimization** for serverless
- [ ] **Add connection caching** strategies
- [ ] **Create performance monitoring** hooks
- [ ] **Optimize batch operations** for Edge Runtime

#### 7. Error Handling Enhancement
**Scope**: All database operations

**Tasks**:
- [ ] **Standardize error responses** across both clients
- [ ] **Add retry logic** for transient failures
- [ ] **Implement circuit breaker** pattern for unreliable connections
- [ ] **Create error reporting** for production monitoring

### Technical Specifications

#### Database Client Selection Logic
```typescript
const getDatabaseClient = () => {
  // Server-side (API routes, middleware)
  if (typeof window === 'undefined') {
    return {
      client: serverDb,
      type: 'server',
      capabilities: ['edge_runtime', 'transactions', 'batch_ops']
    }
  }

  // Client-side (React components)
  return {
    client: db,
    type: 'client',
    capabilities: ['react_hooks', 'real_time', 'optimistic_ui']
  }
}
```

#### Migration Safety Checks
```typescript
const validateMigration = async () => {
  const serverCheck = await serverDb.testConnection()
  const clientCheck = await db.query({})

  return {
    serverReady: serverCheck,
    clientReady: !!clientCheck,
    migrationSafe: serverCheck && !!clientCheck
  }
}
```

### Testing Requirements

#### Unit Tests Needed
- [ ] **Database client selection** logic
- [ ] **Dual-client operations** with mocked environments
- [ ] **Error handling** and fallback scenarios
- [ ] **Migration utilities** functionality

#### Integration Tests Required
- [ ] **API routes** with Edge Runtime simulation
- [ ] **File processing** with modern approach
- [ ] **Session management** across environments
- [ ] **Memory operations** server-side compatibility

### Success Criteria

#### Functional Requirements
1. **All database operations** work in both environments
2. **No React hooks** in API routes
3. **Edge Runtime compatible** file processing
4. **Graceful degradation** when features unavailable

#### Performance Requirements
1. **API response times** under 200ms for simple operations
2. **Database queries** optimized for serverless cold starts
3. **Memory usage** minimized for Edge Runtime limits
4. **Error rates** below 0.1% in production

### Implementation Timeline

#### Phase 1 (Immediate - 1-2 days)
- [ ] Complete database function dual-client implementation
- [ ] Review and fix all API routes for Edge Runtime compatibility
- [ ] Complete file processing migration

#### Phase 2 (Medium-term - 3-5 days)
- [ ] Re-enable session context with server-side support
- [ ] Implement performance optimizations
- [ ] Add comprehensive error handling

#### Phase 3 (Long-term - 1 week)
- [ ] Create migration utilities for production deployment
- [ ] Implement monitoring and observability
- [ ] Performance tuning and optimization

### Dependencies & Integration Points

#### Requires Coordination With
- **DevOps Agent**: Environment configuration, deployment setup
- **QA Agent**: Test coverage for new implementations
- **Project Lead**: Architecture decisions and timeline management

#### External Dependencies
- InstantDB Core library compatibility
- Edge Runtime environment capabilities
- Next.js App Router requirements
- TypeScript type definitions

### Risk Mitigation

#### Technical Risks
1. **InstantDB Core limitations** - Fallback to client-side operations
2. **Edge Runtime constraints** - Progressive enhancement approach
3. **Migration complexity** - Gradual rollout with feature flags

#### Business Risks
1. **Data consistency** - Dual-client validation mechanisms
2. **Performance regression** - Continuous monitoring and optimization
3. **Deployment failures** - Comprehensive testing and rollback procedures