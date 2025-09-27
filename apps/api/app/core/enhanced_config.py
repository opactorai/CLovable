"""
Enhanced configuration system for production deployment
"""
import os
import json
from pathlib import Path
from typing import Optional, Dict, Any, List
from pydantic_settings import BaseSettings
from pydantic import Field, validator
from enum import Enum


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class DatabaseType(str, Enum):
    SQLITE = "sqlite"
    POSTGRESQL = "postgresql"
    MYSQL = "mysql"


class SecurityConfig(BaseSettings):
    """Security configuration"""
    
    # JWT Configuration
    jwt_secret_key: str = Field(default="dev-secret-key-change-in-production", env="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(30, env="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    
    # Encryption
    encryption_key: str = Field(default="dev-encryption-key-change-in-production", env="ENCRYPTION_KEY")
    encryption_algorithm: str = Field("AES-256-GCM", env="ENCRYPTION_ALGORITHM")
    
    # Rate Limiting
    rate_limit_requests_per_minute: int = Field(100, env="RATE_LIMIT_REQUESTS_PER_MINUTE")
    rate_limit_burst: int = Field(200, env="RATE_LIMIT_BURST")
    
    # CORS
    cors_allowed_origins: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:8080"],
        env="CORS_ALLOWED_ORIGINS"
    )
    
    @validator('cors_allowed_origins', pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class DatabaseConfig(BaseSettings):
    """Database configuration"""
    
    database_type: DatabaseType = Field(DatabaseType.SQLITE, env="DATABASE_TYPE")
    database_url: str = Field(default="sqlite:///data/claudable.db", env="DATABASE_URL")
    database_pool_size: int = Field(10, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(20, env="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(30, env="DATABASE_POOL_TIMEOUT")
    database_pool_recycle: int = Field(3600, env="DATABASE_POOL_RECYCLE")
    
    class Config:
        extra = "ignore"  # Ignore extra fields
    
    # SQLite specific
    sqlite_wal_mode: bool = Field(True, env="SQLITE_WAL_MODE")
    sqlite_foreign_keys: bool = Field(True, env="SQLITE_FOREIGN_KEYS")
    
    
    # PostgreSQL specific
    postgres_ssl_mode: str = Field("prefer", env="POSTGRES_SSL_MODE")
    postgres_application_name: str = Field("claudable-api", env="POSTGRES_APPLICATION_NAME")
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class APIConfig(BaseSettings):
    """API configuration"""
    
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8080, env="API_PORT")
    api_workers: int = Field(1, env="API_WORKERS")
    api_reload: bool = Field(False, env="API_RELOAD")
    api_log_level: str = Field("info", env="API_LOG_LEVEL")
    
    # API Limits
    max_request_size: int = Field(10 * 1024 * 1024, env="MAX_REQUEST_SIZE")  # 10MB
    max_response_size: int = Field(50 * 1024 * 1024, env="MAX_RESPONSE_SIZE")  # 50MB
    request_timeout: int = Field(300, env="REQUEST_TIMEOUT")  # 5 minutes
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class ExternalServicesConfig(BaseSettings):
    """External services configuration"""
    
    # OpenAI
    openai_api_key: Optional[str] = Field(None, env="OPENAI_API_KEY")
    openai_organization: Optional[str] = Field(None, env="OPENAI_ORGANIZATION")
    openai_base_url: Optional[str] = Field(None, env="OPENAI_BASE_URL")
    
    # Anthropic
    anthropic_api_key: Optional[str] = Field(None, env="ANTHROPIC_API_KEY")
    
    # GitHub
    github_token: Optional[str] = Field(None, env="GITHUB_TOKEN")
    github_webhook_secret: Optional[str] = Field(None, env="GITHUB_WEBHOOK_SECRET")
    
    # Vercel
    vercel_token: Optional[str] = Field(None, env="VERCEL_TOKEN")
    vercel_team_id: Optional[str] = Field(None, env="VERCEL_TEAM_ID")
    
    # Supabase
    supabase_url: Optional[str] = Field(None, env="SUPABASE_URL")
    supabase_anon_key: Optional[str] = Field(None, env="SUPABASE_ANON_KEY")
    supabase_service_role_key: Optional[str] = Field(None, env="SUPABASE_SERVICE_ROLE_KEY")
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class MonitoringConfig(BaseSettings):
    """Monitoring and logging configuration"""
    
    # Logging
    log_level: str = Field("INFO", env="LOG_LEVEL")
    log_format: str = Field("json", env="LOG_FORMAT")  # json or text
    log_file: Optional[str] = Field(None, env="LOG_FILE")
    log_rotation: str = Field("daily", env="LOG_ROTATION")
    log_retention_days: int = Field(30, env="LOG_RETENTION_DAYS")
    
    # Metrics
    enable_metrics: bool = Field(True, env="ENABLE_METRICS")
    metrics_port: int = Field(9090, env="METRICS_PORT")
    
    # Health Checks
    health_check_interval: int = Field(60, env="HEALTH_CHECK_INTERVAL")  # seconds
    health_check_timeout: int = Field(10, env="HEALTH_CHECK_TIMEOUT")  # seconds
    
    class Config:
        extra = "ignore"  # Ignore extra fields


class Settings(BaseSettings):
    """Main application settings"""
    
    # Environment
    environment: Environment = Field(Environment.DEVELOPMENT, env="ENVIRONMENT")
    debug: bool = Field(False, env="DEBUG")
    
    # Project paths
    project_root: Path = Field(Path(__file__).parent.parent.parent.parent, env="PROJECT_ROOT")
    data_dir: Path = Field(Path("data"), env="DATA_DIR")
    projects_root: Path = Field(Path("data/projects"), env="PROJECTS_ROOT")
    
    # Component configurations
    security: SecurityConfig = SecurityConfig()
    database: DatabaseConfig = DatabaseConfig()
    api: APIConfig = APIConfig()
    external_services: ExternalServicesConfig = ExternalServicesConfig()
    monitoring: MonitoringConfig = MonitoringConfig()
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
    
    @validator('project_root', 'data_dir', 'projects_root', pre=True)
    def resolve_paths(cls, v):
        if isinstance(v, str):
            return Path(v).resolve()
        return v.resolve()
    
    @validator('data_dir', 'projects_root')
    def ensure_directories_exist(cls, v):
        v.mkdir(parents=True, exist_ok=True)
        return v
    
    def get_database_url(self) -> str:
        """Get the complete database URL"""
        if self.database.database_type == DatabaseType.SQLITE:
            db_path = self.data_dir / "claudable.db"
            return f"sqlite:///{db_path}"
        return self.database.database_url
    
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment == Environment.PRODUCTION
    
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.environment == Environment.DEVELOPMENT
    
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins based on environment"""
        if self.is_production():
            return self.security.cors_allowed_origins
        else:
            # Allow all origins in development
            return ["*"]
    
    def get_log_config(self) -> Dict[str, Any]:
        """Get logging configuration"""
        return {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
                    "class": "pythonjsonlogger.jsonlogger.JsonFormatter"
                },
                "text": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": self.monitoring.log_format,
                    "level": self.monitoring.log_level
                }
            },
            "root": {
                "level": self.monitoring.log_level,
                "handlers": ["console"]
            }
        }
    
    def validate_configuration(self) -> List[str]:
        """Validate configuration and return any issues"""
        issues = []
        
        # Check required fields for production
        if self.is_production():
            if not self.security.jwt_secret_key:
                issues.append("JWT_SECRET_KEY is required in production")
            
            if not self.security.encryption_key:
                issues.append("ENCRYPTION_KEY is required in production")
            
            if self.database.database_type == DatabaseType.SQLITE:
                issues.append("SQLite is not recommended for production")
        
        # Check database URL
        if not self.database.database_url and self.database.database_type != DatabaseType.SQLITE:
            issues.append("DATABASE_URL is required for non-SQLite databases")
        
        # Check external service configurations
        if not any([
            self.external_services.openai_api_key,
            self.external_services.anthropic_api_key
        ]):
            issues.append("At least one AI service API key should be configured")
        
        return issues


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get the global settings instance"""
    return settings


def validate_and_setup() -> bool:
    """Validate configuration and setup the application"""
    issues = settings.validate_configuration()
    
    if issues:
        print("Configuration issues found:")
        for issue in issues:
            print(f"  - {issue}")
        
        if settings.is_production():
            print("Cannot start in production with configuration issues")
            return False
        else:
            print("Starting in development mode despite configuration issues")
    
    # Setup logging
    import logging.config
    logging.config.dictConfig(settings.get_log_config())
    
    logger = logging.getLogger(__name__)
    logger.info(f"Starting application in {settings.environment.value} mode")
    
    return True