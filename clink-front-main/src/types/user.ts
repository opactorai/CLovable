export type UserPlan = 'free' | 'pro' | 'full';
export type UserRole = 'user' | 'admin' | 'super_admin';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatar?: string | null;
  plan: UserPlan;
  role: UserRole;
  planActivatedAt?: string | null;
  planExpiresAt?: string | null;
  stripeCustomerId?: string | null;
}
