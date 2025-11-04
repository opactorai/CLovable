import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { githubClient } from '@/lib/github-client';
import { config } from '@/lib/config';
import {
  clearStoredRefreshToken,
  setStoredRefreshToken,
} from '@/lib/auth-storage';
import type { UserProfile } from '@/types/user';
import {
  normalizeUserProfile,
  parseStoredUserProfile,
} from '../utils/user-profile';
import { trackLogout } from '@/lib/analytics';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  const clearAuthState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearStoredRefreshToken();

    // Clear GitHub connection cache when logging out
    githubClient.invalidateConnectionStatusCache();

    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const checkAuthStatus = async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true }));

    try {
      const token = localStorage.getItem('token');
      const storedUser = parseStoredUserProfile(localStorage.getItem('user'));

      if (!token || !storedUser) {
        clearAuthState();
        return;
      }

      // Fetch fresh user data from API
      const freshUserData = await apiClient.getCurrentUserProfile();
      const normalizedUser = normalizeUserProfile(freshUserData);

      // Update localStorage with fresh data
      localStorage.setItem('user', JSON.stringify(normalizedUser));

      setAuthState({
        user: normalizedUser,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.warn('Auth verification failed:', error);
      const tokenStillExists = localStorage.getItem('token');

      if (!tokenStillExists) {
        clearAuthState();
      } else {
        const fallbackUser = parseStoredUserProfile(
          localStorage.getItem('user'),
        );
        if (fallbackUser) {
          setAuthState({
            user: fallbackUser,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          clearAuthState();
        }
      }
    }
  };

  const login = (
    token: string,
    refreshToken: string | null | undefined,
    user: Partial<UserProfile> & { id?: string; email?: string },
  ) => {
    const normalizedUser = normalizeUserProfile(user);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    setStoredRefreshToken(refreshToken);

    // Clear GitHub connection cache when logging in as a new user
    githubClient.invalidateConnectionStatusCache();

    setAuthState({
      user: normalizedUser,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  const logout = async () => {
    // Track logout event before clearing state
    trackLogout();

    try {
      await fetch(`${config.apiUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    try {
      // Clear all authentication state
      clearAuthState();

      // Force reload to completely clear any cached state
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force page refresh to clear state
      window.location.reload();
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  return {
    ...authState,
    login,
    logout,
    refreshAuth: checkAuthStatus,
  };
};
