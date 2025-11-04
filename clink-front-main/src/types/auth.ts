import type { UserPlan } from '@/types/user';

export interface AuthUserPayload {
  id?: string;
  email?: string;
  name?: string;
  avatar?: string | null;
  plan?: UserPlan;
  planActivatedAt?: string | null;
  planExpiresAt?: string | null;
  stripeCustomerId?: string | null;
}

export interface AuthTransferSession {
  token?: string;
  accessToken?: string;
  refreshToken?: string | null;
  refresh_token?: string | null;
  expiresIn?: number;
  expires_in?: number;
  user?: AuthUserPayload | null;
  id?: string;
  email?: string;
  name?: string;
  environment?: 'development' | 'production' | 'test';
  pairingToken?: string | null;
  connectMode?: boolean;
}
