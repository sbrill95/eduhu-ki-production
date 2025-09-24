# UI/UX Design Guidelines: eduhu.ki

## Design Philosophy

### Core Principles
- **Simplicity First**: Clean, uncluttered interface that doesn't overwhelm teachers
- **Educational Context**: Design patterns familiar to educators
- **Accessibility**: WCAG 2.1 AA compliance for inclusive education
- **Mobile-First**: Responsive design optimized for tablet and phone usage
- **Performance**: Fast, smooth interactions that respect users' time

### User-Centered Approach
- **Teacher Workflows**: Design around actual teaching patterns and schedules
- **Cognitive Load**: Minimize mental effort required to use the app
- **Quick Access**: Common actions should be one-tap away
- **Context Preservation**: Maintain user's place and progress across sessions

## Visual Design System

### Color Palette
```css
/* Primary Colors */
--primary: #2563eb      /* Professional blue for actions */
--primary-light: #3b82f6
--primary-dark: #1d4ed8

/* Secondary Colors */
--secondary: #059669    /* Green for success states */
--accent: #7c3aed      /* Purple for highlights */
--warning: #d97706     /* Orange for warnings */
--error: #dc2626       /* Red for errors */

/* Neutral Colors */
--gray-50: #f9fafb     /* Lightest background */
--gray-100: #f3f4f6    /* Light background */
--gray-500: #6b7280    /* Medium text */
--gray-900: #111827    /* Dark text */
```

### Typography Scale
```css
/* Font Family */
font-family: 'Inter', system-ui, sans-serif;

/* Scale */
--text-xs: 0.75rem     /* 12px - Labels, captions */
--text-sm: 0.875rem    /* 14px - Body small */
--text-base: 1rem      /* 16px - Body text */
--text-lg: 1.125rem    /* 18px - Emphasized text */
--text-xl: 1.25rem     /* 20px - Small headings */
--text-2xl: 1.5rem     /* 24px - Section headings */
--text-3xl: 1.875rem   /* 30px - Page headings */
```

### Spacing System
```css
/* Based on 4px grid */
--space-1: 0.25rem     /* 4px */
--space-2: 0.5rem      /* 8px */
--space-3: 0.75rem     /* 12px */
--space-4: 1rem        /* 16px */
--space-6: 1.5rem      /* 24px */
--space-8: 2rem        /* 32px */
--space-12: 3rem       /* 48px */
```

## Component Design Patterns

### Chat Interface
```
┌─────────────────────────────────────┐
│ Chat: Lesson Planning               │ ← Header with context
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────┐       │ ← User message (right)
│  │ How can I teach fractions│       │   - Rounded corners
│  │ to 4th graders?          │       │   - Blue background
│  └─────────────────────────┘       │   - White text
│                                     │
│ ┌─────────────────────────────────┐ │ ← AI response (left)
│ │ Here are some effective       │ │   - Light gray background
│ │ methods for teaching...       │ │   - Dark text
│ │                               │ │   - More space for content
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│ [Type your message...]        [📤] │ ← Input area
└─────────────────────────────────────┘
```

### Home Feed Layout
```
┌─────────────────────────────────────┐
│ Good morning, Sarah! 👋             │ ← Personalized greeting
├─────────────────────────────────────┤
│ Quick Actions                       │
│ [💬 New Chat] [📚 Library] [⚙️ Set] │ ← Action buttons
├─────────────────────────────────────┤
│ Recent Activity                     │
│ ┌─────────────────────────────────┐ │ ← Activity cards
│ │ 📝 Lesson Plan: Fractions      │ │   - Preview content
│ │ 2 hours ago                     │ │   - Timestamp
│ └─────────────────────────────────┘ │   - Quick actions
│ ┌─────────────────────────────────┐ │
│ │ 💬 Chat: Science Project Ideas │ │
│ │ Yesterday                       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Navigation Pattern
```
Mobile (Bottom Navigation):
┌─────────────────────────────────────┐
│                                     │
│           Main Content              │
│                                     │
├─────────────────────────────────────┤
│ [🏠 Home] [💬 Chat] [📚 Library]   │ ← Fixed bottom nav
└─────────────────────────────────────┘

Desktop (Sidebar):
┌─────┬───────────────────────────────┐
│ 🏠  │                               │
│ 💬  │         Main Content          │
│ 📚  │                               │
│     │                               │
└─────┴───────────────────────────────┘
```

## Interaction Design

### Micro-Interactions
- **Button Press**: 0.1s scale down animation
- **Loading States**: Skeleton screens, not spinners
- **Success Actions**: Green checkmark with subtle bounce
- **Transitions**: 200ms ease-out for most transitions
- **Focus States**: Clear, accessible focus rings

### Gesture Support
- **Swipe to Delete**: Chat history items
- **Pull to Refresh**: Home feed and library
- **Long Press**: Context menus for advanced actions
- **Pinch to Zoom**: Text scaling accessibility

### Loading States
- **Initial Load**: Progressive skeleton loading
- **Chat Messages**: Typing indicator with dots animation
- **Background Updates**: Subtle progress indicators
- **Offline Mode**: Clear offline indicators and queued actions

## Responsive Design

### Breakpoints
```css
/* Mobile First */
@media (min-width: 640px)  { /* sm: tablets */ }
@media (min-width: 768px)  { /* md: small laptops */ }
@media (min-width: 1024px) { /* lg: laptops */ }
@media (min-width: 1280px) { /* xl: desktops */ }
```

### Layout Adaptations
- **Mobile (320-640px)**: Single column, bottom navigation
- **Tablet (640-768px)**: Comfortable touch targets, side navigation option
- **Desktop (768px+)**: Sidebar navigation, multi-column layouts

## Accessibility Guidelines

### WCAG Compliance
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Keyboard Navigation**: Full keyboard support with logical tab order
- **Screen Readers**: Semantic HTML with proper ARIA labels
- **Focus Management**: Clear focus indicators and logical focus flow

### Inclusive Design
- **Text Scaling**: Support up to 200% text zoom
- **Reduced Motion**: Respect prefers-reduced-motion settings
- **High Contrast**: Support for high contrast mode
- **Touch Targets**: Minimum 44px tap targets

## Content Strategy

### Voice and Tone
- **Professional yet Approachable**: Respectful of educators' expertise
- **Helpful, not Condescending**: Assume intelligence and experience
- **Clear and Concise**: Busy teachers appreciate brevity
- **Encouraging**: Positive reinforcement for user actions

### Content Patterns
- **Error Messages**: Clear, actionable, blame-free language
- **Empty States**: Helpful guidance for getting started
- **Success Messages**: Brief confirmations that build confidence
- **Loading Text**: Contextual messages about what's happening

## Performance UX

### Perceived Performance
- **Optimistic Updates**: Show changes immediately, sync in background
- **Smart Preloading**: Anticipate user needs and preload content
- **Progressive Loading**: Show content as it becomes available
- **Graceful Degradation**: Maintain functionality on slower connections

### Offline Experience
- **Clear Indicators**: Show online/offline status
- **Offline Actions**: Queue actions for when connection returns
- **Cached Content**: Show recently viewed content when offline
- **Sync Feedback**: Clear indication when data syncs