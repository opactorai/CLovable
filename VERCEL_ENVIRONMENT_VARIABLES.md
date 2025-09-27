# Vercel Environment Variables Configuration
# Copy these to your Vercel project settings

# ===========================================
# REQUIRED: Core Application Settings
# ===========================================
NODE_ENV=production
NEXT_PUBLIC_API_BASE=https://your-app.vercel.app
NEXT_PUBLIC_WEB_URL=https://your-app.vercel.app

# ===========================================
# REQUIRED: Vercel KV Database
# ===========================================
# Get these from Vercel Dashboard > Storage > KV
KV_REST_API_URL=https://your-kv-url.upstash.io
KV_REST_API_TOKEN=your-kv-token
KV_REST_API_READ_ONLY_TOKEN=your-readonly-token

# ===========================================
# AI SERVICE API KEYS
# ===========================================
# OpenAI API Key (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic API Key (get from https://console.anthropic.com/)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# ===========================================
# EXTERNAL SERVICE INTEGRATIONS
# ===========================================
# GitHub Personal Access Token (get from https://github.com/settings/tokens)
GITHUB_TOKEN=ghp_your-github-token-here

# Vercel API Token (get from https://vercel.com/account/tokens)
VERCEL_TOKEN=your-vercel-token-here

# ===========================================
# SUPABASE CONFIGURATION (Optional)
# ===========================================
# Supabase Project URL (get from https://supabase.com/dashboard)
SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon Key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Service Role Key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# ===========================================
# SECURITY CONFIGURATION
# ===========================================
# JWT Secret Key (generate a secure random string)
JWT_SECRET_KEY=your-super-secure-jwt-secret-key-here

# Encryption Key (generate a secure random string)
ENCRYPTION_KEY=your-super-secure-encryption-key-here

# ===========================================
# CORS CONFIGURATION
# ===========================================
# Allowed origins (comma-separated)
CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-domain.com

# ===========================================
# OPTIONAL: Analytics and Monitoring
# ===========================================
# Vercel Analytics (automatically enabled)
# VERCEL_ANALYTICS_ID=your-analytics-id

# Sentry (if using error tracking)
# SENTRY_DSN=your-sentry-dsn

# ===========================================
# DEPLOYMENT INFORMATION
# ===========================================
# These are automatically set by Vercel
# VERCEL_ENV=production
# VERCEL_REGION=iad1
# VERCEL_GIT_COMMIT_SHA=your-commit-sha
# VERCEL_GIT_REPO_OWNER=your-username
# VERCEL_GIT_REPO_SLUG=your-repo-name

# ===========================================
# INSTRUCTIONS FOR SETUP
# ===========================================
# 1. Go to your Vercel project dashboard
# 2. Navigate to Settings > Environment Variables
# 3. Add each variable above with its corresponding value
# 4. Make sure to set the environment to "Production"
# 5. Redeploy your application after adding variables
# 6. Test the application to ensure all features work

# ===========================================
# TESTING YOUR SETUP
# ===========================================
# After deployment, test these endpoints:
# - GET /api/config - Check configuration
# - GET /api/ai/status - Check AI connectivity
# - POST /api/api-keys - Add an API key
# - GET /api/api-keys - List API keys
# - POST /api/ai/chat - Test AI chat functionality