# Claudable - Vercel Deployment

## 🚀 Deploy to Vercel

This application is configured to work seamlessly with Vercel. Follow these steps to deploy:

### 1. Prerequisites

- Vercel account
- GitHub repository with your code
- Environment variables ready

### 2. Deploy Steps

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

2. **Configure Build Settings**:
   - Framework Preset: `Next.js`
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Set Environment Variables**:
   ```
   NEXT_PUBLIC_API_BASE=https://your-app.vercel.app
   NEXT_PUBLIC_WS_BASE=wss://your-app.vercel.app
   BACKEND_BASE_URL=https://your-app.vercel.app
   
   # AI Service Keys
   OPENAI_API_KEY=sk-your-openai-key-here
   ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
   
   # External Service Keys
   GITHUB_TOKEN=ghp_your-github-token-here
   VERCEL_TOKEN=your-vercel-token-here
   
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   
   # Security
   JWT_SECRET_KEY=your-jwt-secret-key-here
   ENCRYPTION_KEY=your-encryption-key-here
   
   # CORS
   CORS_ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-domain.com
   
   # Environment
   NODE_ENV=production
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait for deployment to complete
   - Your app will be available at `https://your-app.vercel.app`

### 3. Features Available on Vercel

✅ **API Routes**:
- `/api/api-keys` - API Keys management
- `/api/config` - Application configuration
- `/api/ai/status` - AI service status
- `/api/projects` - Project management
- `/api/users` - User management

✅ **Frontend Pages**:
- `/` - Home page
- `/api-keys` - API Keys management
- `/users` - User management

✅ **Mock Data**:
- The app includes mock data for demonstration
- All API endpoints work with sample data
- Perfect for testing and demonstration

### 4. Database Options

For production use, consider these database options:

1. **Vercel Postgres** (Recommended):
   - Built-in with Vercel
   - Easy setup and scaling
   - Automatic backups

2. **Supabase**:
   - PostgreSQL with real-time features
   - Built-in authentication
   - Easy integration

3. **PlanetScale**:
   - MySQL-compatible
   - Serverless scaling
   - Branching for databases

### 5. Custom Domain

To use a custom domain:

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update environment variables with new domain

### 6. Monitoring and Analytics

Vercel provides built-in:
- Performance monitoring
- Analytics
- Error tracking
- Real-time logs

### 7. Troubleshooting

**Common Issues**:

1. **Build Failures**:
   - Check Node.js version (>=18)
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **API Routes Not Working**:
   - Verify environment variables are set
   - Check function timeout settings
   - Review Vercel logs

3. **Environment Variables**:
   - Ensure all required variables are set
   - Check variable names match exactly
   - Redeploy after adding new variables

### 8. Production Checklist

- [ ] All environment variables set
- [ ] Database configured
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] Backup strategy in place

### 9. Support

For issues with Vercel deployment:
- Check [Vercel Documentation](https://vercel.com/docs)
- Review [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- Contact Vercel Support

---

**Your app is now ready for production on Vercel! 🎉**