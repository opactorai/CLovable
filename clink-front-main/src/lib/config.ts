import { env, resolveApiBaseUrl, resolveAppBaseUrl } from './env';

export const config = {
  apiUrl: resolveApiBaseUrl(),
  appUrl: resolveAppBaseUrl(),
  deploymentStage: env.deploymentStage,
  stripePublishableKey: env.stripePublishableKey ?? '',
  githubClientId: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
} as const;
