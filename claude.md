# eduhu.ki - Project Context

## Project Overview
eduhu.ki is a Progressive Web App designed specifically for teachers, providing AI-powered assistance through a clean chat interface with personalized content management.

## Current Status
- **Phase**: Initial Setup & Planning
- **Tech Stack**: Next.js + InstantDB
- **Architecture**: PWA with offline capabilities

## Key Files & Documentation
- `docs/prd.md` - Product Requirements Document
- `docs/implementation-plan.md` - Technical implementation roadmap
- `docs/ui-ux.md` - User interface and experience guidelines
- `docs/project-structure.md` - Codebase architecture and organization
- `workflow-rules.md` - Context Engineering workflow instructions

## Specialized Agents
- `agents/frontend-specialist.md` - Frontend expert (Next.js, PWA, UI/UX)
- `agents/backend-specialist.md` - Backend expert (InstantDB, APIs, data models)

## TypeScript & Build Verification

### Pre-Deployment Checklist
**ALWAYS** run these commands before committing/pushing:

```bash
# 1. Verify build locally
npm run verify-build

# 2. If build fails, fix errors before proceeding
# 3. Only commit after verification passes
git add .
git commit -m "your message"
git push
```

### Common TypeScript Error Patterns

1. **Missing Property Errors**
   - When adding new properties to function parameters
   - **Fix**: Update both function signature AND interface/type definition
   - **Example**: Adding `fileAttachments` requires updating both `addMessage` options AND implementation

2. **Type Import Issues**
   - Node.js modules don't have default exports
   - **Fix**: Use `import * as moduleName from 'module'` instead of `import moduleName from 'module'`
   - **Common modules**: crypto, path, fs

3. **Enum/Union Type Mismatches**
   - Adding new values to contentType enums
   - **Fix**: Update ALL type definitions in the chain, not just the first one

### Verification Commands

```bash
# Quick TypeScript check (fastest)
npx tsc --noEmit --skipLibCheck

# Full build verification (comprehensive)
npm run verify-build

# Manual build (what Vercel runs)
npm run build
```

### Emergency Fix Workflow
If deployment fails:
1. **DON'T** push another "fix" without local verification
2. Run `npm run verify-build` locally
3. Fix ALL errors shown
4. Re-run verification until it passes
5. THEN commit and push

## Core Features (MVP)
1. **Chat Interface** - Simple, clean AI chat for teachers
2. **Personalized Home Feed** - Curated content and recent activity
3. **Library System** - Chat history and artifact storage
4. **PWA Capabilities** - Installable, offline-capable

## Development Principles
- Start simple, expand later
- Teacher-focused user experience
- Mobile-first responsive design
- Performance-optimized (Core Web Vitals)

## Technology Decisions
- **Frontend**: Next.js (for React ecosystem and SSR)
- **Database**: InstantDB (for real-time capabilities)
- **PWA**: Service workers for offline functionality
- **Future**: MCP integration for enhanced AI capabilities

## Project Goals
- Create intuitive tool for teacher workflows
- Provide personalized AI assistance for education
- Build foundation for future educational AI features
- Maintain simplicity while enabling powerful functionality

## Context for AI Assistance
This project aims to be a practical, teacher-focused tool that enhances educational workflows without overwhelming users with complexity. The emphasis is on clean UX, reliable performance, and educational value.

## Quick Commands
- Refer to `workflow-rules.md` for file usage guidelines
- Check `docs/prd.md` for feature requirements
- Review `docs/implementation-plan.md` for technical approach
- Use `agents/frontend-specialist.md` for UI/UX and Next.js questions
- Use `agents/backend-specialist.md` for data architecture and InstantDB questions