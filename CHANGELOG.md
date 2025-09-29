# Changelog

## [2.0.0] - 2025-01-27

### 🚀 Major Features Added

#### 🔐 Secure API Key Management
- **New API Keys UI**: Added `/api-keys` page for managing all AI service API keys
- **Dynamic API Key Usage**: All AI agents now use user-provided API keys instead of hardcoded ones
- **Multi-Provider Support**: Support for Claude, Cursor, OpenAI, Google, Qwen, GitHub, Supabase, and Vercel
- **Secure Storage**: API keys are stored securely in the database with encryption

#### 🚀 MCP (Multi-Context Protocol) Support
- **Enhanced Base CLI**: Updated `BaseCLI` class with MCP configuration methods
- **All Agents Enhanced**: Claude Code, Cursor Agent, Codex CLI, Qwen CLI, and Gemini CLI now support MCP
- **Session Continuity**: Maintain conversation context across multiple interactions
- **Tool Integration**: Seamless integration with MCP-enabled tools and services

#### 🛡️ Sandbox Execution
- **Safe Code Execution**: All AI-generated code runs in isolated sandbox environments
- **Permission Controls**: Fine-grained control over what code can access
- **Security First**: Protect your system from potentially harmful AI-generated code
- **Configurable Sandbox**: Enable/disable sandbox mode per CLI provider

#### 🚀 Production-Ready Deployment
- **Vercel Configuration**: Complete Vercel deployment setup with proper routing
- **Environment Secrets**: Secure handling of API keys and sensitive data
- **GitHub Actions**: Automated CI/CD pipeline for continuous deployment
- **Build Scripts**: Added production build and deployment scripts

### 🔧 Technical Improvements

#### Backend Enhancements
- **Enhanced CLI Adapters**: All CLI adapters now support dynamic API keys and MCP
- **Token Service**: Improved token management with secure storage
- **API Integration**: Updated chat API to use dynamic API keys
- **Database Models**: Enhanced token storage and management

#### Frontend Enhancements
- **New API Keys Page**: Beautiful, responsive UI for managing API keys
- **Navigation Updates**: Added API Keys link to main navigation
- **TypeScript Support**: Added proper TypeScript configuration and type checking
- **Build Optimization**: Improved build process and error handling

#### Infrastructure
- **Vercel Configuration**: Separate configurations for web and API deployments
- **Environment Variables**: Comprehensive environment variable documentation
- **Deployment Guide**: Complete deployment guide with step-by-step instructions
- **CI/CD Pipeline**: GitHub Actions workflow for automated deployment

### 🧹 Code Cleanup
- **Removed Test Files**: Cleaned up unnecessary test and example files
- **Repository Organization**: Better file structure and organization
- **Documentation**: Updated README with new features and deployment instructions
- **Type Safety**: Fixed TypeScript errors and improved type safety

### 📚 Documentation
- **Updated README**: Comprehensive documentation of new features
- **Deployment Guide**: Step-by-step deployment instructions
- **API Documentation**: Updated API documentation with new endpoints
- **Security Guidelines**: Best practices for API key management

### 🔒 Security Improvements
- **No Hardcoded Keys**: Eliminated all hardcoded API keys
- **Secure Storage**: API keys stored with proper encryption
- **Environment Variables**: Secure handling of sensitive data
- **Sandbox Execution**: Safe execution of AI-generated code

### 🚀 Performance Improvements
- **Build Optimization**: Faster build times and better error handling
- **Type Checking**: Added TypeScript type checking for better code quality
- **Linting**: Improved code quality with proper linting
- **Error Handling**: Better error handling and user feedback

## Migration Guide

### For Existing Users
1. **Update API Keys**: Visit the new API Keys page to configure your AI service credentials
2. **Environment Variables**: Update your environment variables for production deployment
3. **Database Migration**: The database schema has been updated to support new features
4. **Deployment**: Follow the new deployment guide for Vercel deployment

### Breaking Changes
- **API Key Management**: API keys must now be configured through the UI or environment variables
- **CLI Configuration**: MCP and Sandbox features are enabled by default
- **Build Process**: Updated build scripts and deployment configuration

## Compatibility
- **Node.js**: >= 18.0.0
- **Python**: >= 3.10
- **Next.js**: 14.2.5
- **FastAPI**: >= 0.112

## Support
For issues or questions about the new features:
1. Check the updated README and deployment guide
2. Review the API Keys management documentation
3. Check the GitHub Issues for known problems
4. Contact support through the official channels