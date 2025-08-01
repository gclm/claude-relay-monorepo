/**
 * OAuth 认证相关配置常量
 */

export const OAUTH_CONFIG = {
  AUTHORIZE_URL: 'https://claude.ai/oauth/authorize',
  TOKEN_URL: 'https://console.anthropic.com/v1/oauth/token',
  CLIENT_ID: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  REDIRECT_URI: 'https://console.anthropic.com/oauth/code/callback',
  SCOPES: 'org:create_api_key user:profile user:inference'
} as const