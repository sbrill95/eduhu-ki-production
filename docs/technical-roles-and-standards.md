# Technical Roles & Standards: eduhu.ki

## Technical Product Manager Authority & Responsibilities

### Technical Architecture Authority
As Technical Product Manager, I have **final authority** on:
- Major technology stack decisions and changes
- API design standards and integration protocols
- Performance benchmarks and scalability requirements
- Technical debt prioritization and resolution strategies
- Technology adoption and migration paths

### Technical Decision-Making Framework

#### Level 1 Decisions (TPM Authority Required)
- Changes to core technology stack (Next.js, InstantDB, OpenAI API)
- New external service integrations or dependencies
- Database schema modifications affecting multiple features
- API design patterns and breaking changes
- Performance optimization strategies affecting architecture

#### Level 2 Decisions (Senior Backend Architect Authority)
- Database query optimization and indexing strategies
- Internal API endpoint design within existing patterns
- Data model refinements within established schema
- Backend service architecture within current stack
- Integration implementation details

#### Level 3 Decisions (Agent Team Autonomy)
- Component implementation details
- UI/UX refinements within design system
- Bug fixes and minor optimizations
- Testing strategies and implementation
- DevOps workflow improvements

## Current Tech Stack Standards (MANDATORY)

### Established Technology Foundation
```yaml
Core Stack:
  - Frontend: Next.js 15 + React + Tailwind CSS
  - Database: InstantDB (App ID: 39f14e13-9afb-4222-be45-3d2c231be3a1)
  - AI: OpenAI API with streaming support
  - Deployment: Vercel
  - PWA: Service workers with offline capabilities

Architecture Patterns:
  - Real-time data: InstantDB useQuery() hooks
  - Database operations: db.transact() with proper error handling
  - AI streaming: Server-sent events with streaming UI
  - State management: React + InstantDB (no additional state libraries)
  - Type safety: TypeScript with strict mode
```

### Non-Negotiable Technical Standards

#### Database Operations
```typescript
// REQUIRED: All database operations must use these patterns
- Queries: const { data, isLoading, error } = useQuery(...)
- Mutations: await db.transact([db.tx.table[id].update(data)])
- Error handling: try/catch with user-friendly messages
- Performance: Limit queries (max 100 messages per chat)
```

#### API Integration Standards
```typescript
// REQUIRED: All API calls must follow this pattern
- Environment variables: process.env.NEXT_PUBLIC_* for client-side
- Error boundaries: Graceful degradation for API failures
- Streaming: Server-sent events for real-time AI responses
- Type safety: Proper TypeScript interfaces for all API responses
```

#### Performance Requirements (Core Web Vitals)
- First Contentful Paint: < 1.5s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms
- Time to Interactive: < 3s

## Expanded Team Technical Responsibilities

### Senior Backend Architect (NEW)
**Primary Focus**: Database architecture, performance optimization, and backend service design

#### Technical Responsibilities
- **Database Architecture**: Design and optimize InstantDB schema for educational workflows
- **Performance Optimization**: Ensure sub-200ms query response times
- **Data Migration**: Plan and execute schema changes without downtime
- **Integration Architecture**: Design MCP integration patterns for future AI capabilities
- **API Design**: Create consistent, RESTful API patterns within Next.js structure

#### Decision Authority
- Database indexing and query optimization strategies
- Backend service architecture within established stack
- Data model refinements and relationship design
- Performance monitoring and alerting strategies
- Integration protocols for educational AI features

#### Collaboration Requirements
- **With TPM**: Architecture decisions affecting multiple services
- **With Backend Task Manager**: Implementation coordination and task distribution
- **With DevOps Specialist**: Deployment strategies and database migrations

### DevOps Specialist (NEW)
**Primary Focus**: Deployment automation, monitoring, and infrastructure reliability

#### Technical Responsibilities
- **CI/CD Pipeline**: Automated testing, building, and deployment via Vercel
- **Environment Management**: Secure environment variable handling across deployments
- **Monitoring & Alerting**: Application performance and error tracking
- **Security Auditing**: Regular security scans and dependency updates
- **Backup & Recovery**: Database backup strategies and disaster recovery

#### Technical Standards to Enforce
- **Security**: No hardcoded secrets, proper .gitignore, environment isolation
- **Deployment**: Zero-downtime deployments with rollback capabilities
- **Monitoring**: 99.9% uptime target with sub-5-minute incident response
- **Performance**: Automated Core Web Vitals monitoring and alerting
- **Dependencies**: Weekly security updates and vulnerability scanning

#### Integration Requirements
- **Vercel Deployment**: Seamless integration with existing Vercel configuration
- **InstantDB**: Monitoring database performance and connection health
- **OpenAI API**: Rate limiting and error handling for AI service calls

### QA Development Lead (NEW)
**Primary Focus**: Testing strategy, quality gates, and user acceptance validation

#### Testing Framework Requirements
- **Unit Testing**: Jest + React Testing Library for component testing
- **Integration Testing**: End-to-end database persistence and AI streaming
- **Performance Testing**: Lighthouse CI for Core Web Vitals validation
- **Security Testing**: API security, XSS prevention, and data privacy
- **User Acceptance**: Teacher-focused workflow validation

#### Quality Gates (MANDATORY)
```yaml
Pre-Deployment Checklist:
  - All unit tests passing (90%+ coverage)
  - Integration tests passing (database + AI)
  - Performance tests meeting Core Web Vitals
  - Security scan with zero critical issues
  - Manual UAT with teacher personas
```

#### Teacher-Focused Testing Standards
- **Workflow Testing**: Complete teacher journey from question to artifact storage
- **Mobile Testing**: iOS/Android PWA installation and offline functionality
- **Accessibility**: WCAG 2.1 AA compliance for educational accessibility
- **Content Validation**: AI response accuracy for educational contexts

### Backend Task Manager (EXISTING - ENHANCED ROLE)
**Primary Focus**: Feature implementation, bug fixes, and technical task coordination

#### Enhanced Responsibilities
- **Feature Implementation**: Transform requirements into technical tasks
- **Code Quality**: Ensure adherence to technical standards during implementation
- **Task Coordination**: Interface between Senior Backend Architect and implementation
- **Bug Triage**: Categorize and prioritize technical issues
- **Documentation**: Maintain technical documentation and implementation guides

#### Collaboration with Senior Backend Architect
- **Architecture Implementation**: Execute architectural decisions designed by Senior Backend Architect
- **Performance Monitoring**: Report performance issues and optimization opportunities
- **Code Review**: Ensure consistency with architectural patterns
- **Technical Debt**: Track and prioritize technical debt items

### Frontend Task Executor (EXISTING - ENHANCED ROLE)
**Primary Focus**: UI/UX implementation and PWA optimization

#### Enhanced Responsibilities
- **Component Development**: Implement React components following design system
- **PWA Optimization**: Maintain service worker and offline capabilities
- **Performance Optimization**: Frontend performance and bundle size management
- **Responsive Design**: Mobile-first implementation for teacher workflows
- **Accessibility**: Frontend accessibility implementation and testing

### Pre-deployment Tester (EXISTING - ENHANCED COORDINATION)
**Primary Focus**: Final validation and deployment readiness

#### Enhanced Testing Coordination
- **Integration with QA Lead**: Follow comprehensive testing framework established by QA Lead
- **Teacher Persona Testing**: Execute specific educational workflow scenarios
- **Cross-device Validation**: Test across teacher-common devices (iPad, Chromebook, mobile)
- **Performance Validation**: Final Core Web Vitals validation before deployment

## Technical Quality Gates by Phase

### Phase Planning (TPM + Senior Backend Architect)
- Technical feasibility assessment
- Performance impact analysis
- Architecture consistency review
- Integration complexity evaluation

### Phase Implementation (Backend Task Manager + Frontend Task Executor)
- Code review with architectural compliance
- Unit testing with 90%+ coverage
- Performance benchmarking against standards
- Security vulnerability scanning

### Phase Testing (QA Development Lead + Pre-deployment Tester)
- Comprehensive testing framework execution
- Teacher workflow validation
- Cross-device compatibility testing
- Performance and security validation

### Phase Deployment (DevOps Specialist + TPM Approval)
- Automated deployment pipeline execution
- Performance monitoring activation
- Rollback capability verification
- Success metrics validation

## Technical Debt Management Strategy

### Technical Debt Classification
1. **Critical**: Blocks deployment or creates security vulnerabilities
2. **High**: Impacts performance or user experience significantly
3. **Medium**: Reduces development velocity or code maintainability
4. **Low**: Minor improvements or optimizations

### Technical Debt Resolution Authority
- **Critical/High**: TPM prioritization with immediate sprint inclusion
- **Medium**: Senior Backend Architect evaluation and timeline planning
- **Low**: Backend Task Manager coordination with regular sprint inclusion

### Technical Debt Prevention
- **Code Reviews**: All code changes require architectural compliance review
- **Automated Testing**: Comprehensive test coverage prevents regression debt
- **Performance Monitoring**: Proactive identification of performance debt
- **Security Scanning**: Regular dependency and security vulnerability audits

## API and Integration Standards

### InstantDB Integration Standards
```typescript
// REQUIRED: Database query patterns
const useMessagesQuery = (chatId: string) => {
  const { data, isLoading, error } = useQuery({
    messages: { $: { where: { chatId } }, limit: 100 }
  });

  return { messages: data?.messages || [], isLoading, error };
};

// REQUIRED: Database mutation patterns
const addMessage = async (chatId: string, content: string, role: 'user' | 'assistant') => {
  try {
    await db.transact([
      db.tx.messages[id()].update({
        chatId,
        content,
        role,
        timestamp: new Date().toISOString()
      })
    ]);
  } catch (error) {
    // REQUIRED: User-friendly error handling
    throw new DatabaseError('Failed to save message. Please try again.');
  }
};
```

### OpenAI API Integration Standards
```typescript
// REQUIRED: AI streaming implementation
const streamAIResponse = async (messages: Message[]) => {
  const stream = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });

  // REQUIRED: Error handling for AI failures
  if (!stream.ok) {
    throw new AIError('AI service unavailable. Please try again.');
  }

  return stream;
};
```

### Future MCP Integration Preparation
- **Protocol Compatibility**: Design current APIs to support MCP protocol extension
- **Context Management**: Prepare educational context handling for enhanced AI capabilities
- **Extensibility**: Ensure current architecture supports MCP server integration
- **Performance Scaling**: Design for increased AI interaction volume

## Communication Protocols

### Technical Decision Communication
1. **Architecture Changes**: TPM communicates to all team members via documentation update
2. **Implementation Decisions**: Senior Backend Architect coordinates with Backend Task Manager
3. **Quality Issues**: QA Development Lead escalates to TPM with impact assessment
4. **Deployment Issues**: DevOps Specialist coordinates with TPM for resolution strategy

### Progress Reporting
- **Daily**: Backend Task Manager reports implementation progress
- **Weekly**: Senior Backend Architect reports architectural health and technical debt
- **Pre-Deployment**: QA Development Lead provides comprehensive quality assessment
- **Post-Deployment**: DevOps Specialist provides performance and stability metrics

## Success Metrics and KPIs

### Technical Performance KPIs
- **Database Performance**: < 200ms average query response time
- **AI Response Time**: < 2s for streaming start, < 30s for complete response
- **Core Web Vitals**: All metrics in "Good" range (green)
- **Uptime**: 99.9% availability with < 5-minute MTTR
- **Security**: Zero critical vulnerabilities, weekly dependency updates

### Team Efficiency KPIs
- **Development Velocity**: Story points per sprint with consistent delivery
- **Quality Metrics**: < 5% post-deployment bug rate
- **Technical Debt**: < 20% of sprint capacity allocated to debt resolution
- **Code Coverage**: > 90% test coverage across all new features

This technical role definition establishes clear authority, responsibilities, and standards while maintaining the successful foundation we've built. The Senior Backend Architect will enhance our database architecture capabilities, the DevOps Specialist will ensure reliable deployment and monitoring, and the QA Development Lead will establish comprehensive quality standards - all while preserving the proven Next.js + InstantDB + OpenAI integration that's currently working in production.