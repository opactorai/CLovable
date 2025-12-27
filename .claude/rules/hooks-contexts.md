---
paths: "hooks/**/*.ts,hooks/**/*.tsx,contexts/**/*.ts,contexts/**/*.tsx"
---

# React Hooks & Context Development Rules

## Custom Hooks (`hooks/`)
Located in `/hooks` directory with `.ts` extension.

### Hook Naming
- Always prefix with `use`: `useUserRequests`, `useGlobalSettings`
- Name describes what data/behavior they provide
- Can use other hooks internally

### Hook Pattern
```typescript
export function useCustomHook(initialValue: string) {
  const [value, setValue] = useState(initialValue);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  return { value, handleChange };
}
```

### Side Effects
Use `useEffect` for:
- API calls
- Event listeners
- Subscriptions
- Timers

Always clean up:
```typescript
useEffect(() => {
  const timer = setTimeout(() => { /* ... */ }, 1000);
  return () => clearTimeout(timer);
}, [dependencies]);
```

### Performance
- Use `useMemo` for expensive computations
- Use `useCallback` for event handlers passed as props
- Include all dependencies in dependency arrays
- Use linter rule: `exhaustive-deps`

## Context API (`contexts/`)
Located in `/contexts` directory.

### Context Pattern
```typescript
import { createContext, useContext, type ReactNode } from 'react';

interface GlobalSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
}

const GlobalSettingsContext = createContext<GlobalSettings | undefined>(undefined);

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GlobalSettings>({
    theme: 'light',
    notifications: true
  });

  return (
    <GlobalSettingsContext.Provider value={settings}>
      {children}
    </GlobalSettingsContext.Provider>
  );
}

export function useGlobalSettings() {
  const context = useContext(GlobalSettingsContext);
  if (!context) {
    throw new Error('useGlobalSettings must be used within GlobalSettingsProvider');
  }
  return context;
}
```

### Context Placement
Wrap at appropriate level:
- Global settings at root layout
- Project settings at project layout
- Modal state near modal components

### Multiple Contexts
For related state, consider:
- Single context with multiple values
- Multiple contexts with provider composition
- Keep contexts focused on one concern

## Built-in Hooks Usage

### useState
```typescript
const [count, setCount] = useState(0);
const [state, setState] = useState<StateType>({ /* ... */ });
```

### useEffect
```typescript
// Run once on mount
useEffect(() => { /* ... */ }, []);

// Run when dependencies change
useEffect(() => { /* ... */ }, [dependency]);

// Cleanup
useEffect(() => {
  const cleanup = () => { /* ... */ };
  return cleanup;
}, []);
```

### useCallback
```typescript
const handleClick = useCallback(() => {
  // This function is memoized
}, [dependencies]);
```

### useMemo
```typescript
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);
```

### useRef
```typescript
const inputRef = useRef<HTMLInputElement>(null);

// Access DOM element
inputRef.current?.focus();
```

### useReducer
For complex state logic:
```typescript
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD': return { ...state, count: state.count + 1 };
    default: return state;
  }
}
```

## Hook Rules (ESLint rules-of-hooks)
1. Only call hooks at top level (not in conditions)
2. Only call hooks from React functions (components or custom hooks)
3. Use plugin `eslint-plugin-react-hooks` to enforce

## Context Performance
- Split contexts by update frequency
- Use separate contexts for rarely-changed data
- Consider custom hook wrapper for complex logic
- Don't put entire state tree in single context

## Testing Hooks
- Use `renderHook` from testing library
- Wrap with provider if context-dependent
- Test state updates and side effects
- Mock API calls with jest

## Anti-patterns to Avoid
- ❌ Calling hooks inside conditions
- ❌ Changing hook dependencies arbitrarily
- ❌ Creating context inside component (recreates on each render)
- ❌ Putting too much state in single context
- ❌ Missing dependency arrays in useEffect
