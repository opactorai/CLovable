import { clientLogger } from './client-logger';

const REFRESH_TOKEN_KEY = 'clink_refresh_token';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch (error) {
    clientLogger.warn('Refresh token storage unavailable', error);
    return null;
  }
}

export function setStoredRefreshToken(token: string | null | undefined) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    if (token) {
      storage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      storage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    clientLogger.warn('Failed to persist refresh token', error);
  }
}

export function getStoredRefreshToken(): string | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    clientLogger.warn('Failed to read refresh token from storage', error);
    return null;
  }
}

export function clearStoredRefreshToken() {
  setStoredRefreshToken(null);
}
