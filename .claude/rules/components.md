---
paths: components/**/*.tsx
---

# React Components Development Rules

## Component Structure
All components are in `/components` using TypeScript (`.tsx`). Use functional components with hooks.

## Client vs Server Components
- Add `"use client"` at the top of components that use browser APIs or hooks
- Server components should not import client-only libraries
- Components in `components/` are typically client components

## Animation & Motion
- Use Framer Motion components for animations
- Import from `@/lib/motion`: `MotionDiv`, `MotionButton`, `MotionP`, etc.
- These wrap standard elements with animation capabilities

## Icon Usage
Components use react-icons, but imports are stubbed:
- `react-icons/fa` - Font Awesome icons (stubbed in `stubs/react-icons-fa.tsx`)
- `react-icons/si` - Simple Icons (stubbed in `stubs/react-icons-si.tsx`)
- `react-icons/vsc` - VS Code icons (stubbed in `stubs/react-icons-vsc.tsx`)
- Import specific icons: `import { FaCode, FaDesktop } from 'react-icons/fa'`

## State Management
- Use React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
- Use Context API for global state (e.g., GlobalSettingsContext)
- Avoid prop drilling; extract common state to Context

## Type Safety
- Type all props explicitly
- Use discriminated unions for conditional rendering
- Import types from `/types`: shared, client, or backend as needed

## Common Component Patterns

### Modal Components
Located in `/components/modals/`:
- Accept `isOpen` and `onClose` props
- Use AnimatePresence for enter/exit animations
- Include form validation before submission

### Settings Components
Located in `/components/settings/`:
- Fetch current settings on mount
- Implement save/cancel workflow
- Show loading and error states

### Chat Components
Located in `/components/chat/`:
- ChatLog displays message history
- ChatInput handles user input
- ToolResultItem renders tool execution results
- ThinkingSection shows AI thinking process

## Styling
- Use Tailwind CSS for styling
- Follow existing color/spacing patterns
- Ensure responsive design (mobile-first)
- Test at different viewport sizes

## Accessibility
- Use semantic HTML elements
- Include alt text for images
- Ensure keyboard navigation works
- Use ARIA labels for complex components
