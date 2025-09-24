# Agent Roles & Responsibilities

## Project Context
- **Tech Stack**: Next.js 15, TypeScript, InstantDB (App ID: 39f14e13-9afb-4222-be45-3d2c231be3a1), OpenAI API, Tailwind CSS
- **Status**: Phase 2 completed, database persistence working, ready for deployment
- **Target**: Teacher-focused PWA with AI chat capabilities

## Core Agents (4)

### 1. Project Manager
**Role**: Strategic oversight, coordination, documentation
**Tech Requirements**:
- Understanding of Next.js and InstantDB architecture
- Vercel deployment pipeline knowledge
- Task prioritization and team coordination

### 2. Backend Specialist
**Role**: Database, APIs, server-side logic
**Tech Requirements**:
- InstantDB schema design and queries
- API route implementation in Next.js
- Environment variable security
- Database performance optimization

### 3. Frontend Specialist
**Role**: UI/UX, components, PWA features
**Tech Requirements**:
- Next.js 15 app router
- TypeScript React components
- Tailwind CSS styling
- PWA manifest and service workers

### 4. Testing Specialist
**Role**: Quality assurance, validation, deployment testing
**Tech Requirements**:
- End-to-end testing workflows
- Security vulnerability scanning
- PWA installation testing
- Performance and accessibility validation

## Specialized Agents (4)

### 5. Security Specialist
**Role**: API key management, environment security, vulnerability assessment
**Tech Requirements**:
- Environment variable best practices
- OpenAI API key rotation
- Vercel environment configuration
- Code security auditing

### 6. Performance Specialist
**Role**: Optimization, Core Web Vitals, loading performance
**Tech Requirements**:
- Next.js performance optimization
- InstantDB query performance
- PWA caching strategies
- Bundle size optimization

### 7. UX Specialist
**Role**: User experience design, teacher workflow optimization
**Tech Requirements**:
- Mobile-first responsive design
- Teacher-specific UI patterns
- Accessibility standards (WCAG)
- Progressive enhancement principles

### 8. Deployment Specialist
**Role**: Vercel configuration, CI/CD, production monitoring
**Tech Requirements**:
- Vercel deployment configuration
- Environment variable management
- Domain configuration and SSL
- Production monitoring and logging

## Agent Interaction Protocols

### Development Workflow
1. **Project Manager** coordinates tasks and priorities
2. **Backend/Frontend Specialists** execute technical implementation
3. **Testing Specialist** validates each phase completion
4. **Specialized Agents** provide targeted expertise as needed

### Critical Decision Points
- Security: All environment variables and API keys
- Performance: InstantDB query optimization
- UX: Teacher-specific workflow requirements
- Deployment: Vercel configuration and monitoring

### Communication Standards
- Update PROJECT_DEVELOPMENT_LOG.md for all major changes
- Reference current InstantDB App ID in all database discussions
- Maintain focus on teacher user experience
- Document all technical decisions for future reference

## Current Priority Areas
1. **Deployment Readiness**: Vercel configuration and environment setup
2. **Security Validation**: Final API key and environment audit
3. **Performance Testing**: InstantDB query performance under load
4. **UX Refinement**: Teacher-specific workflow optimization