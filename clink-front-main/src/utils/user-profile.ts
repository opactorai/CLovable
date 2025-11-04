import type { UserPlan, UserProfile } from '@/types/user';

export const isUserPlan = (value: unknown): value is UserPlan =>
  value === 'free' || value === 'pro' || value === 'full';

export const normalizeUserProfile = (
  input: Partial<UserProfile> & { id?: string; email?: string },
): UserProfile => {
  const planValue = isUserPlan(input.plan) ? input.plan : 'free';

  return {
    id: input.id ?? '',
    email: input.email ?? '',
    name: input.name ?? undefined,
    avatar: input.avatar ?? null,
    plan: planValue,
    role: input.role ?? 'user',
    planActivatedAt: input.planActivatedAt ?? null,
    planExpiresAt: input.planExpiresAt ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
  };
};

export const parseStoredUserProfile = (
  raw: string | null,
): UserProfile | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserProfile> & {
      id?: string;
      email?: string;
    };
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return normalizeUserProfile(parsed);
  } catch (error) {
    console.error('Failed to parse stored user profile:', error);
    return null;
  }
};
