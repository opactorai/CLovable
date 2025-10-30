"use client";
import { createContext, ReactNode } from 'react';

/**
 * Simplified AuthContext for token-based authentication
 * OAuth functionality has been removed since we migrated to token-based auth
 */
interface AuthContextType {
  // Empty for now - only provides basic auth context structure
  // Token management is handled directly by individual components
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Token-based auth only - OAuth functionality removed
  // Authentication state is managed locally in components that need it
  
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
}
