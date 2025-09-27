# Claudable Deployment Guide

## Automatic Vercel Deployment

Claudable is configured for automatic deployment to Vercel with GitHub integration.

### Prerequisites

1. **GitHub Repository**: Push your code to a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **API Keys**: Collect API keys for AI services (optional - can be set via UI)

### Environment Secrets

Configure the following secrets in your Vercel project settings:

#### Required Secrets
- `DATABASE_URL` - PostgreSQL connection string (Vercel provides this automatically)

#### Optional AI Service Secrets
- `CLAUDE_API_KEY` - Anthropic Claude API key
- `CURSOR_API_KEY` - Cursor API key  
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_API_KEY` - Google Gemini API key
- `QWEN_API_KEY` - Qwen API key

#### Optional Integration Secrets
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### Deployment Steps

1. **Connect Repository to Vercel**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the Next.js configuration

2. **Configure Environment Variables**:
   - In your Vercel project settings, go to "Environment Variables"
   - Add the secrets listed above
   - Set them for Production, Preview, and Development environments

3. **Deploy**:
   - Push to `main` branch for production deployment
   - Create pull requests for preview deployments
   - Vercel will automatically build and deploy

### GitHub Actions (Optional)

The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) for additional deployment automation.

### Manual Deployment

If you prefer manual deployment:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Post-Deployment

1. **Access Your App**: Visit the Vercel URL provided after deployment
2. **Configure API Keys**: Use the built-in API Keys page (`/api-keys`) to add your AI service credentials
3. **Test Functionality**: Create a test project to verify all features work

### Troubleshooting

#### Build Failures
- Check that all environment variables are set
- Ensure Node.js version is 18+ (configured in `package.json`)
- Verify all dependencies are installed

#### Runtime Errors
- Check Vercel function logs in the dashboard
- Verify API keys are correctly configured
- Ensure database connection is working

#### API Key Issues
- Use the web UI at `/api-keys` to manage API keys
- API keys are stored securely in the database
- No need to set environment variables for API keys if using the UI

### Production Checklist

- [ ] All environment secrets configured
- [ ] Database connection working
- [ ] API keys added via UI
- [ ] Test project creation works
- [ ] AI agents respond correctly
- [ ] File operations work
- [ ] WebSocket connections stable
- [ ] Error handling working

### Support

For deployment issues:
1. Check Vercel function logs
2. Review GitHub Actions logs (if using)
3. Verify environment variable configuration
4. Test locally first with `npm run dev`

## Features Included

✅ **MCP Support**: Multi-Context Protocol enabled for all AI agents
✅ **Sandbox Execution**: Safe code execution with isolated environments  
✅ **API Key Management**: Secure UI for managing all AI service credentials
✅ **Multiple AI Agents**: Claude, Cursor, Codex, Qwen, and Gemini support
✅ **Automatic Deployment**: GitHub + Vercel integration
✅ **Production Ready**: Error handling, logging, and monitoring