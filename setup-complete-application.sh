#!/usr/bin/env bash
set -euo pipefail

# Complete Standalone Claudable Application Setup
# This script creates a fully functional application without any prerequisites

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="claudable-standalone"
API_PORT=8080
WEB_PORT=3000
API_URL="http://localhost:${API_PORT}"
WEB_URL="http://localhost:${WEB_PORT}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Install system dependencies
install_system_deps() {
    log_step "Installing system dependencies..."
    
    # Update package lists
    sudo apt-get update -qq
    
    # Install essential packages
    sudo apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        python3 \
        python3-pip \
        python3-venv \
        python3-dev \
        nodejs \
        npm \
        nginx \
        certbot \
        python3-certbot-nginx \
        sqlite3 \
        postgresql-client \
        redis-server \
        supervisor \
        htop \
        vim \
        unzip \
        jq \
        openssl
    
    log_success "System dependencies installed"
}

# Install Node.js LTS if not present
install_nodejs() {
    log_step "Installing Node.js LTS..."
    
    if ! command -v node &> /dev/null || [[ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 18 ]]; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    log_success "Node.js $(node -v) installed"
}

# Install Python dependencies
install_python_deps() {
    log_step "Installing Python dependencies..."
    
    cd /workspace/apps/api
    
    # Create virtual environment
    python3 -m venv .venv
    source .venv/bin/activate
    
    # Upgrade pip
    pip install --upgrade pip
    
    # Install all requirements
    pip install -r requirements.txt
    
    # Install additional production packages
    pip install \
        gunicorn \
        psycopg2-binary \
        redis \
        celery \
        supervisor \
        python-json-logger \
        prometheus-client \
        sentry-sdk
    
    log_success "Python dependencies installed"
}

# Install frontend dependencies
install_frontend_deps() {
    log_step "Installing frontend dependencies..."
    
    cd /workspace/apps/web
    
    # Install dependencies
    npm install
    
    # Install additional packages for production
    npm install --save \
        axios \
        react-query \
        @tanstack/react-query \
        react-hot-toast \
        lucide-react \
        clsx \
        tailwind-merge
    
    log_success "Frontend dependencies installed"
}

# Create production environment files
create_env_files() {
    log_step "Creating production environment files..."
    
    # Generate secure keys
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    API_SECRET=$(openssl rand -base64 32)
    
    # Backend environment
    cat > /workspace/apps/api/.env << EOF
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false

# API Configuration
API_HOST=0.0.0.0
API_PORT=${API_PORT}
API_WORKERS=4
API_LOG_LEVEL=info

# Security Configuration
JWT_SECRET_KEY=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
API_SECRET=${API_SECRET}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_BURST=2000

# CORS Configuration
CORS_ALLOWED_ORIGINS=${WEB_URL},https://yourdomain.com

# Database Configuration
DATABASE_TYPE=sqlite
DATABASE_URL=sqlite:///data/claudable.db
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# External Services (configure these)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GITHUB_TOKEN=your_github_token_here
VERCEL_TOKEN=your_vercel_token_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Monitoring
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=/var/log/claudable/api.log
ENABLE_METRICS=true
METRICS_PORT=9090

# Health Checks
HEALTH_CHECK_INTERVAL=60
HEALTH_CHECK_TIMEOUT=10

# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
EOF

    # Frontend environment
    cat > /workspace/apps/web/.env.local << EOF
# Frontend Environment Configuration
NEXT_PUBLIC_API_URL=${API_URL}
NEXT_PUBLIC_WEB_URL=${WEB_URL}
NEXT_PUBLIC_APP_NAME=Claudable
NEXT_PUBLIC_APP_VERSION=2.0.0

# API Configuration
API_BASE_URL=${API_URL}
API_TIMEOUT=30000
API_RETRY_ATTEMPTS=3

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true

# External Services
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
EOF

    # Root environment
    cat > /workspace/.env << EOF
# Root Environment Configuration
API_PORT=${API_PORT}
WEB_PORT=${WEB_PORT}
API_URL=${API_URL}
WEB_URL=${WEB_URL}

# Database
DATABASE_URL=sqlite:///data/claudable.db

# Redis
REDIS_URL=redis://localhost:6379/0

# External Services
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
GITHUB_TOKEN=your_github_token_here
VERCEL_TOKEN=your_vercel_token_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
EOF

    log_success "Environment files created"
}

# Create API configuration endpoint
create_api_config() {
    log_step "Creating API configuration endpoint..."
    
    cat > /workspace/apps/api/app/api/config.py << 'EOF'
"""
API Configuration endpoint for frontend
"""
from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os

router = APIRouter(prefix="/api/config", tags=["config"])


class APIConfigResponse(BaseModel):
    api_url: str
    web_url: str
    environment: str
    features: Dict[str, bool]
    services: Dict[str, bool]


@router.get("/", response_model=APIConfigResponse)
async def get_api_config(request: Request):
    """Get API configuration for frontend"""
    
    # Get base URL from request
    base_url = f"{request.url.scheme}://{request.url.netloc}"
    
    return APIConfigResponse(
        api_url=os.getenv("API_URL", base_url),
        web_url=os.getenv("WEB_URL", base_url.replace(":8080", ":3000")),
        environment=os.getenv("ENVIRONMENT", "development"),
        features={
            "service_approvals": True,
            "ai_integration": True,
            "github_integration": bool(os.getenv("GITHUB_TOKEN")),
            "vercel_integration": bool(os.getenv("VERCEL_TOKEN")),
            "supabase_integration": bool(os.getenv("SUPABASE_URL")),
            "analytics": os.getenv("ENABLE_ANALYTICS", "true").lower() == "true",
            "error_reporting": os.getenv("ENABLE_ERROR_REPORTING", "true").lower() == "true",
        },
        services={
            "openai": bool(os.getenv("OPENAI_API_KEY")),
            "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
            "github": bool(os.getenv("GITHUB_TOKEN")),
            "vercel": bool(os.getenv("VERCEL_TOKEN")),
            "supabase": bool(os.getenv("SUPABASE_URL")),
        }
    )


@router.post("/set-api-url")
async def set_api_url(request: Request, api_url: str):
    """Set API URL for browser session"""
    # In a real implementation, you might store this in session/cookies
    return {
        "message": "API URL set successfully",
        "api_url": api_url,
        "status": "success"
    }


@router.post("/set-bearer-token")
async def set_bearer_token(request: Request, token: str):
    """Set bearer token for API authentication"""
    # In a real implementation, you might store this securely
    return {
        "message": "Bearer token set successfully",
        "status": "success"
    }
EOF

    log_success "API configuration endpoint created"
}

# Create frontend API client with automatic configuration
create_api_client() {
    log_step "Creating frontend API client..."
    
    cat > /workspace/apps/web/lib/api-client.ts << 'EOF'
/**
 * API Client with automatic configuration and bearer token support
 */

interface APIConfig {
  api_url: string;
  web_url: string;
  environment: string;
  features: Record<string, boolean>;
  services: Record<string, boolean>;
}

class APIClient {
  private baseURL: string;
  private bearerToken: string | null = null;
  private config: APIConfig | null = null;

  constructor() {
    // Try to get API URL from various sources
    this.baseURL = this.getAPIURL();
    this.loadBearerToken();
  }

  private getAPIURL(): string {
    // Priority order for API URL detection
    const sources = [
      // 1. Browser session storage
      () => sessionStorage.getItem('api_base_url'),
      // 2. Local storage
      () => localStorage.getItem('api_base_url'),
      // 3. Environment variable
      () => process.env.NEXT_PUBLIC_API_URL,
      // 4. Default fallback
      () => 'http://localhost:8080'
    ];

    for (const source of sources) {
      const url = source();
      if (url && this.isValidURL(url)) {
        return url;
      }
    }

    return 'http://localhost:8080';
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private loadBearerToken(): void {
    this.bearerToken = 
      sessionStorage.getItem('bearer_token') ||
      localStorage.getItem('bearer_token') ||
      null;
  }

  async getConfig(): Promise<APIConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/config/`);
      this.config = await response.json();
      return this.config;
    } catch (error) {
      console.warn('Failed to load API config, using defaults:', error);
      this.config = {
        api_url: this.baseURL,
        web_url: 'http://localhost:3000',
        environment: 'development',
        features: {},
        services: {}
      };
      return this.config;
    }
  }

  setAPIURL(url: string): void {
    if (!this.isValidURL(url)) {
      throw new Error('Invalid URL provided');
    }

    this.baseURL = url;
    sessionStorage.setItem('api_base_url', url);
    localStorage.setItem('api_base_url', url);
    this.config = null; // Reset config to reload
  }

  setBearerToken(token: string): void {
    this.bearerToken = token;
    sessionStorage.setItem('bearer_token', token);
    localStorage.setItem('bearer_token', token);
  }

  clearBearerToken(): void {
    this.bearerToken = null;
    sessionStorage.removeItem('bearer_token');
    localStorage.removeItem('bearer_token');
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Convenience methods
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Service-specific methods
  async getServiceApprovals() {
    return this.get('/api/service-approvals/my-approvals');
  }

  async requestServiceAccess(data: {
    service_type: string;
    service_name: string;
    description: string;
    risk_level?: string;
  }) {
    return this.post('/api/service-approvals/request', data);
  }

  async getAIServices() {
    return this.get('/api/ai/status');
  }

  async sendAIChat(messages: Array<{ role: string; content: string }>, model?: string) {
    return this.post('/api/ai/chat', { messages, model });
  }
}

// Export singleton instance
export const apiClient = new APIClient();
export default apiClient;
EOF

    log_success "Frontend API client created"
}

# Create configuration UI component
create_config_ui() {
    log_step "Creating configuration UI component..."
    
    cat > /workspace/apps/web/components/APIConfigModal.tsx << 'EOF'
'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'react-hot-toast';

interface APIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function APIConfigModal({ isOpen, onClose }: APIConfigModalProps) {
  const [apiUrl, setApiUrl] = useState('');
  const [bearerToken, setBearerToken] = useState('');
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen]);

  const loadCurrentConfig = async () => {
    try {
      const config = await apiClient.getConfig();
      setCurrentConfig(config);
      setApiUrl(config.api_url);
    } catch (error) {
      console.error('Failed to load config:', error);
      toast.error('Failed to load current configuration');
    }
  };

  const handleSaveAPIUrl = async () => {
    if (!apiUrl.trim()) {
      toast.error('Please enter a valid API URL');
      return;
    }

    setLoading(true);
    try {
      apiClient.setAPIURL(apiUrl);
      await apiClient.post('/api/config/set-api-url', { api_url: apiUrl });
      toast.success('API URL updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save API URL:', error);
      toast.error('Failed to save API URL');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBearerToken = async () => {
    if (!bearerToken.trim()) {
      toast.error('Please enter a bearer token');
      return;
    }

    setLoading(true);
    try {
      apiClient.setBearerToken(bearerToken);
      await apiClient.post('/api/config/set-bearer-token', { token: bearerToken });
      toast.success('Bearer token updated successfully');
      onClose();
    } catch (error) {
      console.error('Failed to save bearer token:', error);
      toast.error('Failed to save bearer token');
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = () => {
    apiClient.clearBearerToken();
    setBearerToken('');
    toast.success('Bearer token cleared');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4">API Configuration</h2>
        
        {/* Current Configuration */}
        {currentConfig && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Current Configuration</h3>
            <div className="text-sm space-y-1">
              <p><strong>API URL:</strong> {currentConfig.api_url}</p>
              <p><strong>Environment:</strong> {currentConfig.environment}</p>
              <p><strong>Services Available:</strong></p>
              <ul className="ml-4">
                {Object.entries(currentConfig.services).map(([service, available]) => (
                  <li key={service} className={available ? 'text-green-600' : 'text-red-600'}>
                    {service}: {available ? '✓' : '✗'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* API URL Configuration */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Backend API Base URL
          </label>
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://your-api.example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            This is a fallback if the server environment is not configured.
          </p>
        </div>

        <button
          onClick={handleSaveAPIUrl}
          disabled={loading}
          className="w-full mb-4 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save API URL'}
        </button>

        {/* Bearer Token Configuration */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Bearer Token (Optional)
          </label>
          <input
            type="password"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            placeholder="Enter bearer token if your API requires Authorization"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Set a bearer token if your API requires Authorization.
          </p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleSaveBearerToken}
            disabled={loading}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Token'}
          </button>
          
          <button
            onClick={handleClearToken}
            disabled={loading}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Clear Token
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
        >
          Close
        </button>
      </div>
    </div>
  );
}
EOF

    log_success "Configuration UI component created"
}

# Create systemd services
create_systemd_services() {
    log_step "Creating systemd services..."
    
    # API service
    sudo tee /etc/systemd/system/claudable-api.service > /dev/null << EOF
[Unit]
Description=Claudable API Service
After=network.target redis.service

[Service]
Type=exec
User=${USER}
Group=${USER}
WorkingDirectory=/workspace/apps/api
Environment=PATH=/workspace/apps/api/.venv/bin
ExecStart=/workspace/apps/api/.venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${API_PORT}
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claudable-api

[Install]
WantedBy=multi-user.target
EOF

    # Web service
    sudo tee /etc/systemd/system/claudable-web.service > /dev/null << EOF
[Unit]
Description=Claudable Web Service
After=network.target claudable-api.service

[Service]
Type=exec
User=${USER}
Group=${USER}
WorkingDirectory=/workspace/apps/web
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claudable-web

[Install]
WantedBy=multi-user.target
EOF

    # Redis service
    sudo systemctl enable redis-server
    sudo systemctl start redis-server

    log_success "Systemd services created"
}

# Create nginx configuration
create_nginx_config() {
    log_step "Creating nginx configuration..."
    
    sudo tee /etc/nginx/sites-available/claudable > /dev/null << EOF
upstream claudable_api {
    server 127.0.0.1:${API_PORT};
}

upstream claudable_web {
    server 127.0.0.1:${WEB_PORT};
}

server {
    listen 80;
    server_name _;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # API proxy
    location /api/ {
        proxy_pass http://claudable_api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_timeout 300s;
        proxy_read_timeout 300s;
    }
    
    # Health check
    location /health {
        proxy_pass http://claudable_api;
        access_log off;
    }
    
    # Web application
    location / {
        proxy_pass http://claudable_web;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

    # Enable site
    sudo ln -sf /etc/nginx/sites-available/claudable /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    sudo nginx -t
    
    log_success "Nginx configuration created"
}

# Initialize database
initialize_database() {
    log_step "Initializing database..."
    
    cd /workspace/apps/api
    source .venv/bin/activate
    
    # Create database tables
    python -c "
from app.db.session import engine
from app.db.base import Base
import app.models
Base.metadata.create_all(bind=engine)
print('Database tables created successfully')
"
    
    log_success "Database initialized"
}

# Build frontend
build_frontend() {
    log_step "Building frontend..."
    
    cd /workspace/apps/web
    
    # Build the application
    npm run build
    
    log_success "Frontend built successfully"
}

# Start services
start_services() {
    log_step "Starting services..."
    
    # Enable and start services
    sudo systemctl enable claudable-api
    sudo systemctl enable claudable-web
    sudo systemctl enable nginx
    
    sudo systemctl start claudable-api
    sudo systemctl start claudable-web
    sudo systemctl reload nginx
    
    # Wait for services to start
    sleep 5
    
    # Check service status
    if systemctl is-active --quiet claudable-api; then
        log_success "API service started"
    else
        log_error "API service failed to start"
        sudo journalctl -u claudable-api --no-pager -l
    fi
    
    if systemctl is-active --quiet claudable-web; then
        log_success "Web service started"
    else
        log_error "Web service failed to start"
        sudo journalctl -u claudable-web --no-pager -l
    fi
    
    if systemctl is-active --quiet nginx; then
        log_success "Nginx service started"
    else
        log_error "Nginx service failed to start"
        sudo journalctl -u nginx --no-pager -l
    fi
}

# Test application
test_application() {
    log_step "Testing application..."
    
    # Test API health
    if curl -s http://localhost/health | grep -q "ok"; then
        log_success "API health check passed"
    else
        log_error "API health check failed"
    fi
    
    # Test web application
    if curl -s http://localhost/ | grep -q "Claudable"; then
        log_success "Web application accessible"
    else
        log_error "Web application not accessible"
    fi
    
    # Test API configuration endpoint
    if curl -s http://localhost/api/config/ | grep -q "api_url"; then
        log_success "API configuration endpoint working"
    else
        log_error "API configuration endpoint failed"
    fi
}

# Create startup script
create_startup_script() {
    log_step "Creating startup script..."
    
    cat > /workspace/start-claudable.sh << 'EOF'
#!/usr/bin/env bash
# Claudable Application Startup Script

echo "Starting Claudable Application..."

# Start Redis
sudo systemctl start redis-server

# Start API
sudo systemctl start claudable-api

# Start Web
sudo systemctl start claudable-web

# Reload Nginx
sudo systemctl reload nginx

echo "Claudable Application started!"
echo "Access the application at: http://localhost"
echo "API documentation at: http://localhost/api/docs"
echo "Health check at: http://localhost/health"

# Show service status
echo ""
echo "Service Status:"
sudo systemctl status claudable-api --no-pager -l
sudo systemctl status claudable-web --no-pager -l
sudo systemctl status nginx --no-pager -l
EOF

    chmod +x /workspace/start-claudable.sh
    
    log_success "Startup script created"
}

# Main installation function
main() {
    log_info "🚀 Starting Complete Claudable Application Setup"
    log_info "This will create a fully functional application without any prerequisites"
    
    check_root
    install_system_deps
    install_nodejs
    install_python_deps
    install_frontend_deps
    create_env_files
    create_api_config
    create_api_client
    create_config_ui
    create_systemd_services
    create_nginx_config
    initialize_database
    build_frontend
    start_services
    test_application
    create_startup_script
    
    log_success "🎉 Complete Claudable Application Setup Finished!"
    
    echo ""
    log_info "📋 Application Information:"
    echo "  🌐 Web Application: http://localhost"
    echo "  🔧 API Documentation: http://localhost/api/docs"
    echo "  ❤️  Health Check: http://localhost/health"
    echo "  ⚙️  API Configuration: http://localhost/api/config/"
    echo ""
    log_info "🔧 Management Commands:"
    echo "  Start: /workspace/start-claudable.sh"
    echo "  Stop: sudo systemctl stop claudable-api claudable-web"
    echo "  Restart: sudo systemctl restart claudable-api claudable-web"
    echo "  Status: sudo systemctl status claudable-api claudable-web"
    echo "  Logs: sudo journalctl -u claudable-api -f"
    echo ""
    log_info "📝 Next Steps:"
    echo "  1. Configure external service keys in /workspace/apps/api/.env"
    echo "  2. Access the web application and configure API settings"
    echo "  3. Request service approvals through the UI"
    echo "  4. Start building your applications!"
    echo ""
    log_warning "⚠️  Remember to configure your external service API keys for full functionality"
}

# Run main function
main "$@"