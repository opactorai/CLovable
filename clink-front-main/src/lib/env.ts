const isBrowser = typeof window !== 'undefined';

type PublicEnvVar =
  | 'NEXT_PUBLIC_API_URL'
  | 'NEXT_PUBLIC_APP_URL'
  | 'NEXT_PUBLIC_PREVIEW_URL'
  | 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY';

const clientEnv: Record<PublicEnvVar, string | undefined> = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_PREVIEW_URL: process.env.NEXT_PUBLIC_PREVIEW_URL,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

const getEnv = (name: PublicEnvVar): string | undefined => {
  if (isBrowser) {
    return (window as any).__FR_CONFIG__?.[name] ?? clientEnv[name];
  }
  return process.env[name];
};

const detectDeploymentStage = (): 'development' | 'preview' | 'production' => {
  const nodeEnv = (process.env.NODE_ENV ?? 'development').toLowerCase();
  if (nodeEnv === 'development') {
    return 'development';
  }

  const explicitAppUrl = getEnv('NEXT_PUBLIC_APP_URL') ?? '';
  const explicitApiUrl = getEnv('NEXT_PUBLIC_API_URL') ?? '';

  if (
    explicitAppUrl.includes('preview.clink.new') ||
    explicitApiUrl.includes('api-preview.clink.new') ||
    nodeEnv === 'preview'
  ) {
    return 'preview';
  }

  return 'production';
};

const deploymentStage = detectDeploymentStage();

export const env = {
  nodeEnv: process.env.NODE_ENV,
  deploymentStage,
  isDevelopment: deploymentStage === 'development',
  isProduction: deploymentStage === 'production',
  apiUrl: getEnv('NEXT_PUBLIC_API_URL'),
  appUrl: getEnv('NEXT_PUBLIC_APP_URL'),
  previewUrl: getEnv('NEXT_PUBLIC_PREVIEW_URL'),
  stripePublishableKey: getEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
};

export const resolveAppBaseUrl = () => {
  if (env.appUrl) {
    return env.appUrl;
  }

  switch (deploymentStage) {
    case 'production':
      return 'https://clink.new';
    case 'preview':
      return 'https://preview.clink.new';
    default: {
      if (env.previewUrl) {
        return env.previewUrl;
      }
      const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
      if (vercelUrl) {
        return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
      }
      return 'http://localhost:3000';
    }
  }
};

export const resolveAuthRedirectUrl = () => resolveAppBaseUrl();

export const resolveApiBaseUrl = () => {
  if (env.apiUrl) {
    return env.apiUrl;
  }

  switch (deploymentStage) {
    case 'production':
      return 'https://api.clink.new';
    case 'preview':
      return 'https://api-preview.clink.new';
    default:
      return 'http://localhost:8080';
  }
};
