import { resolveApiBaseUrl } from './env';
import { clientLogger } from './client-logger';
import {
  clearStoredRefreshToken,
  setStoredRefreshToken,
} from './auth-storage';
import type { AssistantKey } from './assistant-options';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface ApiClientOptions {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  skipAuth?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<string | null> | null = null;
  private hasScheduledLogout = false;
  private readonly responseCache = new Map<string, unknown>();

  constructor() {
    this.baseUrl = resolveApiBaseUrl();
  }

  private resolveUrl(endpoint: string): string {
    if (/^https?:/i.test(endpoint)) {
      return endpoint;
    }
    return `${this.baseUrl}${endpoint}`;
  }

  private getCurrentUser(): User | null {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        return null;
      }
    }
    return null;
  }

  private clearAuthState() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearStoredRefreshToken();
  }

  private scheduleLogoutRedirect() {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.hasScheduledLogout) {
      this.hasScheduledLogout = true;
      // Clear auth state before redirect
      this.clearAuthState();

      // Redirect to login with clear message
      const message = encodeURIComponent('Your session has expired. Please log in again.');
      window.location.href = `/login?expired=true&message=${message}`;
    }
  }

  private decodeJwtPayload(token: string): { exp?: number } | null {
    try {
      const [, payload] = token.split('.');
      if (!payload) {
        return null;
      }

      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddingLength = (4 - (normalized.length % 4)) % 4;
      const padded = normalized.padEnd(normalized.length + paddingLength, '=');

      const decoded =
        typeof atob === 'function'
          ? atob(padded)
          : typeof globalThis !== 'undefined' &&
              (globalThis as any).Buffer
            ? (globalThis as any).Buffer.from(padded, 'base64').toString('utf8')
            : null;

      if (!decoded) {
        return null;
      }

      return JSON.parse(decoded) as { exp?: number };
    } catch (error) {
      clientLogger.warn('Failed to decode JWT payload for refresh check', error);
      return null;
    }
  }

  private isTokenExpiringSoon(token: string, thresholdMs = 60_000): boolean {
    const payload = this.decodeJwtPayload(token);
    if (!payload?.exp) {
      return false;
    }

    const expiryMs = payload.exp * 1000;
    const now = Date.now();
    return expiryMs - now <= thresholdMs;
  }

  async ensureFreshAccessToken(forceRefresh = false): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }

    const existingToken = localStorage.getItem('token');
    if (!existingToken) {
      return null;
    }

    if (!forceRefresh && !this.isTokenExpiringSoon(existingToken)) {
      return existingToken;
    }

    const refreshed = await this.refreshAccessToken();
    if (refreshed) {
      return refreshed;
    }

    return forceRefresh ? null : localStorage.getItem('token');
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({}),
        });

        if (!response.ok) {
          clientLogger.warn(
            'Refresh token request failed with status:',
            response.status,
          );
          return null;
        }

        const refreshData: { accessToken?: string; refreshToken?: string } =
          await response.json();
        if (!refreshData?.accessToken) {
          clientLogger.warn(
            'Refresh response did not include a new access token.',
          );
          return null;
        }

        localStorage.setItem('token', refreshData.accessToken);
        if (refreshData.refreshToken) {
          setStoredRefreshToken(refreshData.refreshToken);
        }

        this.hasScheduledLogout = false;
        clientLogger.info('Token refreshed successfully');
        return refreshData.accessToken as string;
      } catch (error) {
        clientLogger.warn('Token refresh failed:', error);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private prepareRequest(
    endpoint: string,
    init: RequestInit = {},
    tokenOverride?: string,
    skipAuth = false,
  ): Request {
    const url = this.resolveUrl(endpoint);
    const headers = new Headers(init.headers ?? {});
    const body = init.body;
    const isFormData =
      typeof FormData !== 'undefined' && body instanceof FormData;

    if (!skipAuth) {
      const token = tokenOverride ?? localStorage.getItem('token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.delete('Authorization');
      }
    }

    if (body && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const credentials: RequestCredentials =
      (init.credentials ?? 'include') as RequestCredentials;

    return new Request(url, {
      ...init,
      headers,
      body: body ?? undefined,
      credentials,
    });
  }

  async fetch(
    endpoint: string,
    init: RequestInit = {},
    options: { skipAuth?: boolean } = {},
  ): Promise<Response> {
    const { skipAuth = false } = options;
    const makeRequest = (tokenOverride?: string) =>
      this.prepareRequest(endpoint, init, tokenOverride, skipAuth);

    let response = await fetch(makeRequest());

    if (skipAuth || response.status !== 401) {
      return response;
    }

    clientLogger.info('Token expired, attempting refresh...');
    const newToken = await this.refreshAccessToken();

    if (newToken) {
      response = await fetch(makeRequest(newToken));
      if (response.status !== 401) {
        return response;
      }
    }

    clientLogger.warn('Auto-refresh failed or token expired, redirecting to login');
    this.scheduleLogoutRedirect();
    throw new Error('Authentication expired. Please log in again.');
  }

  private async readErrorPayload(response: Response): Promise<string | null> {
    try {
      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data && typeof data === 'object') {
          if (typeof data.message === 'string') {
            return data.message;
          }
          return JSON.stringify(data);
        }
      }

      const text = await response.text();
      return text || null;
    } catch (error) {
      clientLogger.warn('Failed to parse error response:', error);
      return null;
    }
  }

  async request<T = unknown>(
    endpoint: string,
    options: ApiClientOptions = {},
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      headers: customHeaders = {},
      skipAuth = false,
    } = options;

    const normalizedMethod = method.toUpperCase();
    const cacheKey =
      normalizedMethod === 'GET' ? this.resolveUrl(endpoint) : null;

    const init: RequestInit = {
      method,
      headers: customHeaders,
    };

    if (body !== undefined) {
      init.body =
        typeof body === 'string' ||
        body instanceof FormData ||
        body instanceof Blob
          ? body
          : JSON.stringify(body);
    }

    try {
      let response = await this.fetch(endpoint, init, { skipAuth });

      if (response.status === 304) {
        if (cacheKey && this.responseCache.has(cacheKey)) {
          clientLogger.info('API request returned 304 (not modified)', {
            endpoint,
          });
          return this.responseCache.get(cacheKey) as T;
        }

        clientLogger.info(
          'API request returned 304 with no cached value, refetching without cache',
          { endpoint },
        );
        const refetchInit: RequestInit = {
          ...init,
          cache: 'no-store',
        };
        response = await this.fetch(endpoint, refetchInit, { skipAuth });
      }

      if (response.status === 304) {
        clientLogger.warn(
          'API request returned 304 after cache bypass; falling back to undefined result',
          { endpoint },
        );
        return undefined as T;
      }

      if (response.status === 204) {
        if (cacheKey) {
          this.responseCache.delete(cacheKey);
        }
        return undefined as T;
      }

      if (!response.ok) {
        // Parse error response once to avoid consuming body stream multiple times
        let errorData: any = null;
        let message: string | null = null;

        try {
          const contentType = response.headers.get('content-type') ?? '';
          if (contentType.includes('application/json')) {
            errorData = await response.json();

            // Extract message from various possible structures
            if (errorData && typeof errorData === 'object') {
              if (typeof errorData.message === 'string') {
                message = errorData.message;
              } else if (errorData.message && typeof errorData.message === 'object') {
                // NestJS BadRequestException: { message: { message: '...', details: {...} } }
                message = errorData.message.message || JSON.stringify(errorData.message);
              } else {
                message = JSON.stringify(errorData);
              }
            }
          } else {
            message = await response.text();
          }
        } catch (error) {
          clientLogger.warn('Failed to parse error response:', error);
        }

        const error: any = new Error(
          `API Error: ${response.status} ${response.statusText}${
            message ? ` - ${message}` : ''
          }`,
        );

        // Attach response data to error for structured error handling
        error.response = {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
        };

        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = (await response.json()) as T;
        if (cacheKey) {
          this.responseCache.set(cacheKey, data);
        }
        return data;
      }

      const text = (await response.text()) as T;
      if (cacheKey) {
        this.responseCache.set(cacheKey, text);
      }
      return text;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // AI Providers endpoints
  async getActiveTokens(): Promise<{
    success: boolean;
    data: Record<string, boolean>;
  }> {
    return this.request('/api/ai-providers/tokens/active');
  }

  async getUserTokens(): Promise<{ success: boolean; data: unknown[] }> {
    return this.request('/api/ai-providers/tokens');
  }

  async getCurrentUserProfile(): Promise<any> {
    return this.request('/api/users/me');
  }

  async storeToken(tokenData: {
    provider: string;
    tokenData: string;
    originalPath?: string;
    format?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; data: unknown }> {
    return this.request('/api/ai-providers/tokens', {
      method: 'POST',
      body: tokenData,
    });
  }

  async manualTokenInsert(tokenData: {
    provider: string;
    tokenData: unknown;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ success: boolean; data: unknown }> {
    return this.request('/api/ai-providers/tokens/manual', {
      method: 'POST',
      body: tokenData,
    });
  }

  // Projects endpoints
  async createProject(projectData: {
    name: string;
    description: string;
    initialPrompt: string;
    preset?: string;
    cli?: string;
    model?: string;
    projectType?: 'base' | 'dev';
    githubRepoUrl?: string;
    branch?: string;
    githubInstallationId?: number;
    images?: Array<{
      url: string;
      filename: string;
      originalName: string;
      size: number;
      mimeType: string;
      uploadedAt: string;
      base64?: string;
    }>;
  }): Promise<{ id: string } & Record<string, unknown>> {
    return this.request('/api/projects', {
      method: 'POST',
      body: projectData,
    });
  }

  async getProjects(): Promise<unknown[]> {
    return this.request('/api/projects');
  }

  async getProject(projectId: string): Promise<{
    id: string;
    name: string;
    badgeEnabled: boolean;
    isPublic: boolean;
    projectType?: string;
    githubRepoUrl?: string | null;
    defaultBranch?: string;
    importedRepoUrl?: string | null;
    importedRepoBranch?: string | null;
    createdAt?: string;
    websiteTitle?: string;
    websiteDescription?: string;
    faviconUrl?: string;
    previewImageUrl?: string;
    [key: string]: unknown;
  }> {
    return this.request(`/api/projects/${projectId}`);
  }

  async updateProject(projectId: string, data: {
    name?: string;
    description?: string;
    badgeEnabled?: boolean;
    isPublic?: boolean;
  }): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: data,
    });
  }

  async deleteProject(projectId: string): Promise<{ success: boolean }> {
    return this.request(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async createSubscriptionCheckout(params: {
    plan: 'pro' | 'full';
    projectId?: string;
  }): Promise<
    | { checkoutUrl: string; sessionId: string }
    | { upgraded: true; message: string; plan: string }
  > {
    return this.request('/api/billing/subscriptions/checkout', {
      method: 'POST',
      body: params,
    });
  }

  async createBillingPortalSession(params: {
    returnUrl?: string;
  }): Promise<{ url: string }> {
    return this.request('/api/billing/subscriptions/portal', {
      method: 'POST',
      body: params,
    });
  }

  async getCurrentSubscription(): Promise<any> {
    return this.request('/api/billing/subscriptions/current');
  }

  async getInvoices(): Promise<any> {
    return this.request('/api/billing/subscriptions/invoices');
  }

  async syncSubscription(): Promise<any> {
    return this.request('/api/billing/subscriptions/sync', {
      method: 'POST',
    });
  }

  // Downloads endpoints
  async getAppVersion(): Promise<{
    success: boolean;
    data: { version: string; source: string };
  }> {
    return this.request('/api/downloads/clink-connect/version');
  }

  async createActivation(
    platform: string,
  ): Promise<{ success: boolean; data: Record<string, unknown> }> {
    return this.request('/api/connect/activation', {
      method: 'POST',
      body: { platform },
    });
  }

  async getDownloadUrl(
    platform: string,
  ): Promise<{ success: boolean; data: { downloadUrl: string } }> {
    return this.request(
      `/api/downloads/clink-connect/${platform}?redirect=false`,
    );
  }

  // Analytics endpoints
  async getProjectAnalytics(
    projectId: string,
    window: string = '24h',
    skipCache: boolean = false,
  ): Promise<{
    deployed: boolean;
    message?: string;
    deployedAt?: string;
    hostname: string | null;
    totals: {
      visitors: number;
    };
    timeseries: Array<{
      timestamp: string;
      visitors: number;
    }>;
    countryBreakdown?: Array<{
      country: string;
      visitors: number;
      percentage: number;
    }>;
    deviceBreakdown?: Array<{
      deviceType: string;
      visitors: number;
      percentage: number;
    }>;
  }> {
    const skipCacheParam = skipCache ? '&skipCache=true' : '';
    return this.request(
      `/api/projects/${projectId}/analytics?window=${window}${skipCacheParam}`,
    );
  }

  async getProjectWebAnalytics(
    projectId: string,
    window: string = '24h',
    skipCache: boolean = false,
  ): Promise<{
    deployed: boolean;
    message?: string;
    deployedAt?: string;
    siteId: string | null;
    hostname: string;
    metrics: {
      pageViews: number;
      visits: number;
      bounceRate: number;
      avgVisitDuration: number;
      topPages: Array<{
        path: string;
        views: number;
        percentage: number;
      }>;
      topReferrers: Array<{
        referrer: string;
        visits: number;
        percentage: number;
      }>;
      deviceTypes: Array<{
        device: string;
        visits: number;
        percentage: number;
      }>;
      browsers: Array<{
        browser: string;
        visits: number;
        percentage: number;
      }>;
      countries: Array<{
        country: string;
        visits: number;
        percentage: number;
      }>;
    };
    timeseries: Array<{
      timestamp: string;
      pageViews: number;
      visits: number;
    }>;
  }> {
    const skipCacheParam = skipCache ? '&skipCache=true' : '';
    return this.request(
      `/api/projects/${projectId}/web-analytics?window=${window}${skipCacheParam}`,
    );
  }

  async getAppRoutes(projectId: string): Promise<{
    routes: string[];
    error?: string;
  }> {
    return this.request(`/api/projects/${projectId}/app-routes`);
  }

  async getUsageLimit(
    projectId: string,
    cli: AssistantKey,
  ): Promise<{
    success: boolean;
    cli: string;
    data?: {
      currentSession?: {
        percentage: number;
        resetTime: string;
      };
      currentWeekAllModels?: {
        percentage: number;
        resetTime: string;
      };
      currentWeekOpus?: {
        percentage: number;
        resetTime: string;
      };
      primary?: {
        usedPercent: number;
        windowMinutes: number;
        resetsInSeconds: number;
        resetsAt: string;
        label: string;
      };
      secondary?: {
        usedPercent: number;
        windowMinutes: number;
        resetsInSeconds: number;
        resetsAt: string;
        label: string;
      };
      lastUpdatedAt: number;
    };
    error?: string;
    statusCode?: number;
  }> {
    return this.request(`/api/projects/${projectId}/usage-limit`, {
      method: 'POST',
      body: { cli },
    });
  }

  // Domains endpoints
  async addDomain(
    domain: string,
    projectId: string,
  ): Promise<{
    domain: {
      id: string;
      domain: string;
      status: 'pending' | 'active' | 'failed';
      createdAt: string;
      cloudflareCustomHostnameId?: string;
      sslStatus?: string;
    };
    dnsInstructions: {
      records: Array<{
        type: string;
        host: string;
        value: string;
        ttl: number;
        description?: string;
      }>;
      instructions: string[];
    };
  }> {
    return this.request('/api/domains/add', {
      method: 'POST',
      body: { domain, projectId },
    });
  }

  async verifyDomain(domainId: string): Promise<{
    verified: boolean;
    status: 'pending' | 'active' | 'failed';
    message: string;
    details?: Record<string, unknown>;
  }> {
    return this.request(`/api/domains/${domainId}/verify`, {
      method: 'POST',
    });
  }

  async getProjectDomains(projectId: string): Promise<
    Array<{
      id: string;
      domain: string;
      status: 'pending' | 'active' | 'failed';
      verifiedIp?: string;
      lastVerifiedAt?: string;
      verificationError?: string;
      createdAt: string;
      cloudflareCustomHostnameId?: string;
      sslStatus?: string;
      verifiedAt?: string;
      isDeployed?: boolean;
      lastDeployedAt?: string;
      dnsInstructions?: {
        records: Array<{
          type: string;
          host: string;
          value: string;
          ttl: number;
          description?: string;
        }>;
        instructions: string[];
      };
    }>
  > {
    return this.request(`/api/domains/project/${projectId}`);
  }

  async removeDomain(domainId: string): Promise<{ success: boolean }> {
    return this.request(`/api/domains/${domainId}`, {
      method: 'DELETE',
    });
  }

  // Deployment endpoints
  async checkSubdomainAvailability(
    subdomainName: string,
  ): Promise<{ available: boolean }> {
    return this.request(`/api/projects/check-subdomain/${subdomainName}`);
  }

  async unpublishProject(
    projectId: string,
    options?: {
      unpublishSubdomain?: boolean;
      customDomainId?: string;
    },
  ): Promise<{ success: boolean; message: string; warnings?: string[] }> {
    return this.request(`/api/projects/${projectId}/unpublish`, {
      method: 'POST',
      body: options,
    });
  }

  // Railway deployment endpoints (Import mode)
  async deployRailway(projectId: string): Promise<{
    success: boolean;
    projectId: string;
    serviceId: string;
    message: string;
    estimatedTime: string;
  }> {
    return this.request(`/api/projects/${projectId}/deploy-railway`, {
      method: 'POST',
    });
  }

  async getRailwayDeploymentStatus(projectId: string): Promise<{
    status: 'PENDING' | 'BUILDING' | 'SUCCESS' | 'FAILED' | 'CRASHED';
    url?: string;
    message?: string;
    logs?: string;
  }> {
    return this.request(`/api/projects/${projectId}/railway-deployment-status`);
  }

  async unpublishRailway(projectId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return this.request(`/api/projects/${projectId}/unpublish-railway`, {
      method: 'POST',
    });
  }

  // Upload endpoints
  async uploadImage(file: File): Promise<{
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
    base64: string; // Base64-encoded image data
  }> {
    const formData = new FormData();
    formData.append('image', file);

    return this.request('/api/uploads/image', {
      method: 'POST',
      body: formData,
    });
  }

  // Integrations endpoints
  async getIntegrationsStatus(projectId: string): Promise<{
    supabaseConnected: boolean;
    githubConnected: boolean;
  }> {
    return this.request(`/api/integrations/${projectId}/status`);
  }

  // --- Git utilities for restore flow ---
  async getGitCommits(
    projectId: string,
    limit = 1,
  ): Promise<{ success: boolean; data: Array<{ hash: string; message: string; author: string; date: string }> }> {
    return this.request(`/api/projects/${projectId}/git/commits?limit=${limit}`);
  }

  async restoreTemp(
    projectId: string,
    commitHash: string,
    hard = true,
  ): Promise<{ success: boolean; output?: string; error?: string; baselineHead?: string; targetHead?: string }> {
    return this.request(`/api/chat/${projectId}/restore/temp`, {
      method: 'POST',
      body: { commitHash, hard },
    });
  }

  async getParentCommit(
    projectId: string,
    commitHash: string,
  ): Promise<string | null> {
    try {
      // Fetch more commits to find older turns (500 should cover most cases)
      const result = await this.getGitCommits(projectId, 500);
      if (!result.success || !result.data) {
        return null;
      }

      // Find the target commit in the list
      const targetIndex = result.data.findIndex(c => c.hash === commitHash);
      if (targetIndex === -1 || targetIndex === result.data.length - 1) {
        // Commit not found or it's the oldest in history (no parent available)
        return null;
      }

      // Return the next commit (parent is the one after in the list)
      return result.data[targetIndex + 1].hash;
    } catch (error) {
      console.error('Failed to get parent commit:', error);
      return null;
    }
  }

  async restoreConfirm(
    projectId: string,
    params: { commitHash: string; sessionId?: string | null; chatRoomId?: number | null },
  ): Promise<{ success: boolean }> {
    return this.request(`/api/chat/${projectId}/restore/confirm`, {
      method: 'POST',
      body: params,
    });
  }

  async restoreCancel(
    projectId: string,
    params?: { restoreId?: string | null },
  ): Promise<{ success: boolean; restoredTo?: string }> {
    return this.request(`/api/chat/${projectId}/restore/cancel`, {
      method: 'POST',
      body: params ?? {},
    });
  }
}

// Create a singleton instance
export const apiClient = new ApiClient();
export default apiClient;
