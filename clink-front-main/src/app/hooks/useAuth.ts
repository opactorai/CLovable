import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { UserProfile } from '@/types/user';
import { parseStoredUserProfile } from '../../utils/user-profile';
import { identifyUser } from '@/lib/analytics';

export interface AIConnections {
  openai: boolean;
  claude: boolean;
  gemini: boolean;
  zai: boolean;
}

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [aiConnections, setAiConnections] = useState<AIConnections>({
    openai: false,
    claude: false,
    gemini: false,
    zai: false,
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = parseStoredUserProfile(localStorage.getItem('user'));
    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
      fetchAiConnections(storedUser.id);

      // Identify user in Amplitude
      const userProps: Record<string, string | number | boolean> = {
        plan: storedUser.plan,
      };
      if (storedUser.email) userProps.email = storedUser.email;
      if (storedUser.name) userProps.name = storedUser.name;

      identifyUser(storedUser.id, userProps);
    }
  }, []);

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (event: CustomEvent) => {
      const updatedUser = event.detail;
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    window.addEventListener('userProfileUpdated', handleProfileUpdate as EventListener);
    return () => {
      window.removeEventListener('userProfileUpdated', handleProfileUpdate as EventListener);
    };
  }, []);

  const fetchAiConnections = async (userId?: string) => {
    try {
    const result = await apiClient.getActiveTokens();
      if (result.success) {
        const connections = {
          openai: result.data.codex || false,
          claude: result.data.claude || false,
          gemini: result.data.gemini || false,
          zai: result.data.zai || false,
        };
        setAiConnections(connections);
        return connections;
      }
    } catch (error) {
      console.error('Failed to fetch AI connections:', error);
      const connections = {
        openai: false,
        claude: false,
        gemini: false,
        zai: false,
      };
      setAiConnections(connections);
      return connections;
    }

    const connections = {
      openai: false,
      claude: false,
      gemini: false,
      zai: false,
    };
    return connections;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return {
    isAuthenticated,
    user,
    aiConnections,
    fetchAiConnections,
    handleLogout,
  };
};
