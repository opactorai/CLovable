# 🚀 Claudable - Complete Standalone Application

**AI-powered web application builder with bilateral approval system - Ready to run without any prerequisites!**

## ✨ What is Claudable?

Claudable is a powerful, production-ready web application builder that combines AI agent capabilities with a simple, intuitive building experience. Just describe your app idea and watch as Claudable generates the code and shows you a live preview of your working application.

## 🎯 Key Features

- **🤖 AI-Powered Development**: Leverage Claude Code, OpenAI, Anthropic, and other AI services
- **🔐 Bilateral Approval System**: Secure external service integration with admin approval workflow
- **🛡️ Production-Ready Security**: Comprehensive security middleware, rate limiting, and audit logging
- **⚡ Real-Time Preview**: See changes instantly with hot-reload functionality
- **🌐 Zero Configuration**: Works immediately without any setup or API keys
- **📊 Comprehensive Monitoring**: Health checks, usage analytics, and error tracking
- **🔧 Automatic Configuration**: Smart API URL detection and bearer token management

## 🚀 Quick Start (Zero Prerequisites)

### Option 1: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-repo/Claudable.git
cd Claudable

# Run the complete setup script
./setup-complete-application.sh
```

**That's it!** The script will:
- Install all system dependencies
- Set up Python and Node.js environments
- Configure all services
- Create production-ready deployment
- Start the application automatically

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

## 🌐 Access Your Application

After setup, access your application at:

- **🌐 Web Application**: http://localhost
- **📚 API Documentation**: http://localhost/api/docs
- **❤️ Health Check**: http://localhost/health
- **⚙️ API Configuration**: http://localhost/api/config/

## 🔧 API Configuration

The application includes automatic API URL configuration and bearer token support:

### Browser Session Configuration

1. **Access Configuration**: Click the settings icon in the web application
2. **Set API URL**: Enter your backend API base URL (fallback if server env is not configured)
3. **Set Bearer Token**: Optional - if your API requires Authorization

### Programmatic Configuration

```typescript
import { apiClient } from '@/lib/api-client';

// Set API URL
apiClient.setAPIURL('https://your-api.example.com');

// Set bearer token
apiClient.setBearerToken('your-bearer-token');

// Get current configuration
const config = await apiClient.getConfig();
```

## 🏗️ Architecture

### Backend (FastAPI)
- **API Server**: Production-ready FastAPI with comprehensive middleware
- **Database**: SQLite (development) / PostgreSQL (production)
- **Security**: Rate limiting, CORS, security headers, audit logging
- **AI Integration**: OpenAI, Anthropic, Claude Code support
- **Service Approvals**: Bilateral approval workflow for external services

### Frontend (Next.js)
- **React Application**: Modern React with TypeScript
- **API Client**: Automatic configuration and bearer token support
- **UI Components**: Beautiful, responsive interface
- **Real-time Updates**: WebSocket integration for live updates

### Infrastructure
- **Nginx**: Reverse proxy and load balancer
- **Systemd**: Service management
- **Redis**: Caching and session storage
- **Supervisor**: Process management

## 🔐 Security Features

### Bilateral Approval System
- **Service Requests**: Users request access to external services
- **Admin Approval**: Administrators review and approve requests
- **Token Management**: Secure token storage and usage tracking
- **Audit Logging**: Complete audit trail of all service usage

### Production Security
- **Rate Limiting**: 1000 requests/minute with burst protection
- **Security Headers**: XSS protection, content type options, frame options
- **CORS Protection**: Environment-specific origin validation
- **Error Handling**: Structured error responses with request IDs
- **Request Logging**: Complete audit trail with IP and user agent tracking

## 📊 Monitoring & Observability

### Health Checks
- **API Health**: `/health` endpoint for service status
- **Database Health**: Automatic database connectivity monitoring
- **Service Status**: Real-time service status monitoring

### Usage Analytics
- **Service Usage**: Track usage of all external services
- **Performance Metrics**: Request duration and response size tracking
- **Error Tracking**: Comprehensive error logging with stack traces

### Logging
- **Structured Logging**: JSON format for production
- **Request Tracing**: Unique request IDs for debugging
- **Audit Logs**: Complete audit trail of all operations

## 🔧 Configuration

### Environment Variables

#### Backend (`apps/api/.env`)
```bash
# API Configuration
API_PORT=8080
API_WORKERS=4

# Security
JWT_SECRET_KEY=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# External Services
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GITHUB_TOKEN=your-github-token
VERCEL_TOKEN=your-vercel-token
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Frontend (`apps/web/.env.local`)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# External Services
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## 🚀 Deployment

### Production Deployment

```bash
# Run the production deployment script
cd apps/api
./deploy-production.sh
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment

```bash
# Start services
sudo systemctl start claudable-api
sudo systemctl start claudable-web
sudo systemctl reload nginx
```

## 📚 API Documentation

### Service Approval Endpoints

```bash
# Request service access
POST /api/service-approvals/request
{
  "service_type": "openai",
  "service_name": "My OpenAI Integration",
  "description": "Using OpenAI for chat completions",
  "risk_level": "medium"
}

# Approve service access (admin)
POST /api/service-approvals/{id}/approve
{
  "reason": "Approved for production use"
}

# Get user's approvals
GET /api/service-approvals/my-approvals

# Get usage statistics
GET /api/service-approvals/tokens/{id}/usage-stats
```

### AI Integration Endpoints

```bash
# Check AI service status
GET /api/ai/status

# Send chat message
POST /api/ai/chat
{
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "model": "gpt-4o-mini"
}
```

### Configuration Endpoints

```bash
# Get API configuration
GET /api/config/

# Set API URL
POST /api/config/set-api-url
{
  "api_url": "https://your-api.example.com"
}

# Set bearer token
POST /api/config/set-bearer-token
{
  "token": "your-bearer-token"
}
```

## 🛠️ Development

### Local Development

```bash
# Start backend
cd apps/api
source .venv/bin/activate
python -m uvicorn app.main:app --reload --port 8080

# Start frontend
cd apps/web
npm run dev
```

### Testing

```bash
# Run backend tests
cd apps/api
python -m pytest

# Run frontend tests
cd apps/web
npm test
```

## 📋 Management Commands

```bash
# Start application
./start-claudable.sh

# Check service status
sudo systemctl status claudable-api claudable-web

# View logs
sudo journalctl -u claudable-api -f
sudo journalctl -u claudable-web -f

# Restart services
sudo systemctl restart claudable-api claudable-web

# Stop services
sudo systemctl stop claudable-api claudable-web
```

## 🔍 Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   # Check service status
   sudo systemctl status claudable-api
   
   # View logs
   sudo journalctl -u claudable-api --no-pager -l
   ```

2. **Database issues**
   ```bash
   # Recreate database
   cd apps/api
   rm data/claudable.db
   python -c "from app.db.session import engine; from app.db.base import Base; import app.models; Base.metadata.create_all(bind=engine)"
   ```

3. **Permission issues**
   ```bash
   # Fix permissions
   sudo chown -R $USER:$USER /workspace
   chmod +x /workspace/setup-complete-application.sh
   ```

### Health Checks

```bash
# API health
curl http://localhost/health

# Web application
curl http://localhost/

# API configuration
curl http://localhost/api/config/
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: Check this README and API docs
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join GitHub Discussions for questions

## 🎉 What's Next?

After setup, you can:

1. **Configure External Services**: Add your API keys in the environment files
2. **Request Service Approvals**: Use the web interface to request access to external services
3. **Start Building**: Describe your app idea and watch Claudable generate the code
4. **Deploy**: Push your applications to production with one click

**Happy Building! 🚀**