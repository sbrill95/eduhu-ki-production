# Context Engineering Workflow Rules: eduhu.ki

## Overview
This document defines how to use the Context Engineering system for the eduhu.ki project. Each file serves a specific purpose in providing AI assistants with the right context at the right time.

## File Hierarchy & Purpose

### 1. `claude.md` - Project Hub
**Purpose**: Central context file that provides immediate project orientation
**When to Read**: ALWAYS read first when starting any task
**Contains**:
- Current project status and phase
- Quick links to other documentation
- Key technology decisions
- Development principles
- Most important context for AI assistance

**Usage Pattern**:
```
Assistant: *reads claude.md first*
"I understand this is a PWA for teachers using Next.js + InstantDB. Let me check the specific requirements..."
```

### 2. `docs/prd.md` - Product Requirements
**Purpose**: Define what we're building and why
**When to Read**:
- Before implementing any new feature
- When questions arise about user needs or scope
- When making product decisions

**Contains**:
- Target users and use cases
- Feature requirements and specifications
- Success metrics and non-goals
- Business context and constraints

**Usage Pattern**:
```
User: "Should we add student collaboration features?"
Assistant: *checks prd.md* "According to the PRD, student-facing functionality is explicitly listed as a non-goal for the current phase..."
```

### 3. `docs/implementation-plan.md` - Technical Roadmap
**Purpose**: Guide technical implementation decisions
**When to Read**:
- Before starting development work
- When planning task sequences
- When making architectural decisions
- When estimating work or setting up development environment

**Contains**:
- Development phases and timeline
- Technical architecture decisions
- Database schema and API design
- Testing strategy and deployment approach

**Usage Pattern**:
```
User: "Let's implement the chat feature"
Assistant: *reads implementation-plan.md* "According to the implementation plan, chat is Phase 2. We need to complete the foundation setup first, which includes..."
```

### 4. `docs/ui-ux.md` - Design Guidelines
**Purpose**: Ensure consistent, accessible, teacher-focused design
**When to Read**:
- Before creating any UI components
- When making design decisions
- When implementing responsive layouts
- When addressing accessibility requirements

**Contains**:
- Design system (colors, typography, spacing)
- Component patterns and layouts
- Responsive design guidelines
- Accessibility requirements

**Usage Pattern**:
```
User: "Create the chat message component"
Assistant: *reads ui-ux.md* "I'll create the component following the chat interface design pattern specified, using the primary blue color (#2563eb) for user messages and light gray background for AI responses..."
```

### 5. `docs/project-structure.md` - Codebase Architecture
**Purpose**: Guide code organization and technical implementation
**When to Read**:
- Before writing any code
- When creating new files or components
- When setting up integrations
- When making architectural decisions

**Contains**:
- Directory structure and file organization
- Component architecture and data flow
- Technology stack details and configurations
- Security and performance patterns

**Usage Pattern**:
```
User: "Add a new library search feature"
Assistant: *reads project-structure.md* "I'll create the SearchBar component in src/components/library/ and use the InstantDB query patterns defined in the data architecture section..."
```

## Workflow Rules

### Rule 1: Always Start with claude.md
- **EVERY** task begins by reading `claude.md`
- This provides immediate context and current project status
- Identifies which other docs are most relevant for the task

### Rule 2: Read Context Before Action
- Never implement features without checking the PRD
- Never write code without reviewing the project structure
- Never create UI without consulting the design guidelines

### Rule 3: Context-Driven Decision Making
```
Decision Type → Primary Reference → Secondary References
─────────────────────────────────────────────────────
Product Feature → prd.md → ui-ux.md, implementation-plan.md
Technical Implementation → project-structure.md → implementation-plan.md
UI/UX Design → ui-ux.md → prd.md
Development Planning → implementation-plan.md → project-structure.md
```

### Rule 4: Update Context When Learning
- If you discover important information about the project, update the relevant docs
- Keep claude.md current with project status changes
- Update implementation-plan.md if technical decisions change

### Rule 5: Reference Context in Responses
- Cite specific files when making decisions: "According to docs/prd.md..."
- Explain how context influenced your approach
- Help users understand the reasoning behind recommendations

## AI Assistant Guidelines

### Reading Patterns by Task Type

**New Feature Implementation**:
1. `claude.md` (project context)
2. `docs/prd.md` (feature requirements)
3. `docs/ui-ux.md` (design patterns)
4. `docs/project-structure.md` (implementation approach)

**Bug Fixes**:
1. `claude.md` (current status)
2. `docs/project-structure.md` (codebase understanding)
3. `docs/implementation-plan.md` (testing approach)

**Design Questions**:
1. `claude.md` (project goals)
2. `docs/ui-ux.md` (design system)
3. `docs/prd.md` (user needs)

**Architecture Decisions**:
1. `claude.md` (current tech stack)
2. `docs/project-structure.md` (existing patterns)
3. `docs/implementation-plan.md` (technical requirements)

### Communication Patterns

**Good Context Usage**:
```
"Based on the PRD (docs/prd.md), this feature should prioritize teacher workflows. I'll implement it using the chat component pattern from the UI guidelines (docs/ui-ux.md) and place it in src/components/chat/ per the project structure."
```

**Poor Context Usage**:
```
"I'll create a generic chat component with some styling."
```

### Context Maintenance

**When to Update Files**:
- `claude.md`: After major milestones, tech stack changes, or status updates
- `docs/prd.md`: When requirements change or new user insights emerge
- `docs/ui-ux.md`: When design patterns evolve or new components are standardized
- `docs/project-structure.md`: When architecture changes or new patterns are established
- `docs/implementation-plan.md`: When timelines change or technical approach shifts

**Update Triggers**:
- Completing a major development phase
- Making significant architectural decisions
- Learning important information about users or requirements
- Changing development approach or tooling

## Success Metrics

### Context Effectiveness Indicators
- Decisions reference appropriate documentation
- Implementation follows established patterns
- New code fits architectural guidelines
- UI components follow design system
- Features align with user needs from PRD

### Red Flags (Poor Context Usage)
- Creating components that don't follow design system
- Implementing features not in PRD without justification
- Making architectural decisions that conflict with project-structure.md
- Ignoring established development phases from implementation-plan.md

## Quick Reference

**Starting Any Task**: Read `claude.md`
**Building UI**: Check `docs/ui-ux.md`
**Writing Code**: Review `docs/project-structure.md`
**Planning Features**: Consult `docs/prd.md`
**Technical Questions**: Reference `docs/implementation-plan.md`

This workflow ensures consistent, informed development that aligns with project goals and maintains code quality throughout the eduhu.ki development process.