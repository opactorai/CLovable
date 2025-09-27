#!/usr/bin/env bash
set -euo pipefail

# Production deployment script for Claudable API
# This script handles all aspects of production deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_DIR="/workspace/apps/api"
PROJECT_ROOT="/workspace"
ENV_FILE="${API_DIR}/.env"
BACKUP_DIR="${PROJECT_ROOT}/data/backups"
LOG_DIR="${PROJECT_ROOT}/logs"

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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        exit 1
    fi
}

# Check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Python version
    if ! python3 --version | grep -q "Python 3.1[0-9]"; then
        log_error "Python 3.10+ is required"
        exit 1
    fi
    
    # Check if virtual environment exists
    if [[ ! -d "${API_DIR}/.venv" ]]; then
        log_error "Virtual environment not found. Run 'npm install' first."
        exit 1
    fi
    
    # Check if required packages are installed
    if ! command -v uvicorn &> /dev/null; then
        log_error "uvicorn not found. Installing dependencies..."
        cd "${API_DIR}"
        source .venv/bin/activate
        pip install -r requirements.txt
    fi
    
    log_success "System requirements check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${LOG_DIR}"
    mkdir -p "${PROJECT_ROOT}/data"
    
    log_success "Directories created"
}

# Backup existing data
backup_data() {
    log_info "Creating backup of existing data..."
    
    BACKUP_FILE="${BACKUP_DIR}/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    
    if [[ -d "${PROJECT_ROOT}/data" ]]; then
        tar -czf "${BACKUP_FILE}" -C "${PROJECT_ROOT}" data/
        log_success "Backup created: ${BACKUP_FILE}"
    else
        log_warning "No existing data to backup"
    fi
}

# Generate production environment file
generate_env() {
    log_info "Generating production environment file..."
    
    # Generate secure keys
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    
    cat > "${ENV_FILE}" << EOF
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false

# API Configuration
API_HOST=0.0.0.0
API_PORT=8080
API_WORKERS=4
API_LOG_LEVEL=info

# Security Configuration
JWT_SECRET_KEY=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=100
RATE_LIMIT_BURST=200

# CORS Configuration
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database Configuration
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/claudable
DATABASE_POOL_SIZE=10
DATABASE_MAX_OVERFLOW=20

# External Services (configure these with your actual keys)
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here
# GITHUB_TOKEN=your_github_token_here
# VERCEL_TOKEN=your_vercel_token_here
# SUPABASE_URL=your_supabase_url_here
# SUPABASE_ANON_KEY=your_supabase_anon_key_here
# SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Monitoring
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_FILE=${LOG_DIR}/api.log
ENABLE_METRICS=true
METRICS_PORT=9090

# Health Checks
HEALTH_CHECK_INTERVAL=60
HEALTH_CHECK_TIMEOUT=10
EOF

    log_success "Environment file generated: ${ENV_FILE}"
    log_warning "Please update the external service keys in ${ENV_FILE}"
}

# Install production dependencies
install_dependencies() {
    log_info "Installing production dependencies..."
    
    cd "${API_DIR}"
    source .venv/bin/activate
    
    # Install additional production packages
    pip install gunicorn psycopg2-binary python-json-logger prometheus-client
    
    log_success "Dependencies installed"
}

# Create systemd service file
create_systemd_service() {
    log_info "Creating systemd service file..."
    
    SERVICE_FILE="/tmp/claudable-api.service"
    
    cat > "${SERVICE_FILE}" << EOF
[Unit]
Description=Claudable API Service
After=network.target

[Service]
Type=exec
User=${USER}
Group=${USER}
WorkingDirectory=${API_DIR}
Environment=PATH=${API_DIR}/.venv/bin
ExecStart=${API_DIR}/.venv/bin/gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8080
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=claudable-api

[Install]
WantedBy=multi-user.target
EOF

    log_info "Systemd service file created: ${SERVICE_FILE}"
    log_warning "To install the service, run: sudo cp ${SERVICE_FILE} /etc/systemd/system/"
    log_warning "Then run: sudo systemctl enable claudable-api && sudo systemctl start claudable-api"
}

# Create nginx configuration
create_nginx_config() {
    log_info "Creating nginx configuration..."
    
    NGINX_CONFIG="/tmp/claudable-nginx.conf"
    
    cat > "${NGINX_CONFIG}" << EOF
upstream claudable_api {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (update paths)
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
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
    
    # Static files (if serving frontend from nginx)
    location / {
        root /path/to/your/frontend/build;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

    log_info "Nginx configuration created: ${NGINX_CONFIG}"
    log_warning "Update the domain names and SSL certificate paths"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    cd "${API_DIR}"
    source .venv/bin/activate
    
    # Create database tables
    python -c "
from app.db.session import engine
from app.db.base import Base
import app.models
Base.metadata.create_all(bind=engine)
print('Database tables created successfully')
"
    
    log_success "Database migrations completed"
}

# Test the deployment
test_deployment() {
    log_info "Testing deployment..."
    
    cd "${API_DIR}"
    source .venv/bin/activate
    
    # Test imports
    python -c "
from app.main import app
from app.core.enhanced_config import settings
print('✅ Application imports successfully')
print(f'Environment: {settings.environment.value}')
print(f'Database: {settings.database.database_type.value}')
"
    
    # Test database connection
    python -c "
from app.db.session import engine
with engine.connect() as conn:
    result = conn.execute('SELECT 1')
    print('✅ Database connection successful')
"
    
    log_success "Deployment test passed"
}

# Main deployment function
main() {
    log_info "Starting Claudable API production deployment..."
    
    check_root
    check_requirements
    create_directories
    backup_data
    generate_env
    install_dependencies
    create_systemd_service
    create_nginx_config
    run_migrations
    test_deployment
    
    log_success "Production deployment completed!"
    
    echo ""
    log_info "Next steps:"
    echo "1. Update external service keys in ${ENV_FILE}"
    echo "2. Install systemd service: sudo cp /tmp/claudable-api.service /etc/systemd/system/"
    echo "3. Enable service: sudo systemctl enable claudable-api"
    echo "4. Start service: sudo systemctl start claudable-api"
    echo "5. Configure nginx: sudo cp /tmp/claudable-nginx.conf /etc/nginx/sites-available/"
    echo "6. Enable nginx site: sudo ln -s /etc/nginx/sites-available/claudable-nginx.conf /etc/nginx/sites-enabled/"
    echo "7. Test nginx config: sudo nginx -t"
    echo "8. Reload nginx: sudo systemctl reload nginx"
    echo ""
    log_info "Monitor the service with: sudo systemctl status claudable-api"
    log_info "View logs with: sudo journalctl -u claudable-api -f"
}

# Run main function
main "$@"