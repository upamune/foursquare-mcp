import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * XDG Base Directory仕様に準拠した設定ディレクトリパスを取得
 */
export function getConfigDir(): string {
  const platform = process.platform;
  
  // XDG_CONFIG_HOMEを優先
  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, 'foursquare-mcp');
  }
  
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'darwin': // macOS
      // macOSの標準的な場所
      return path.join(homeDir, 'Library', 'Application Support', 'foursquare-mcp');
    
    case 'win32': // Windows
      return path.join(
        process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'),
        'foursquare-mcp'
      );
    
    default: // Linux/Unix
      return path.join(homeDir, '.config', 'foursquare-mcp');
  }
}

/**
 * 設定ディレクトリを作成（既存の場合はスキップ）
 */
export async function ensureConfigDir(): Promise<string> {
  const configDir = getConfigDir();
  try {
    await fs.mkdir(configDir, { recursive: true, mode: 0o700 });
  } catch (error: any) {
    // ディレクトリが既に存在する場合はエラーを無視
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
  return configDir;
}

/**
 * トークンファイルのパスを取得
 */
export async function getTokenPath(): Promise<string> {
  const configDir = await ensureConfigDir();
  return path.join(configDir, 'token.json');
}

/**
 * OAuth設定
 */
export const OAUTH_CONFIG = {
  PORT: 52847,
  CALLBACK_PATH: '/callback',
  get REDIRECT_URI() {
    return `http://localhost:${this.PORT}${this.CALLBACK_PATH}`;
  }
};

/**
 * Foursquare API設定
 */
export const API_CONFIG = {
  BASE_URL: 'https://api.foursquare.com/v2',
  VERSION: '20250824', // YYYYMMDD形式
  AUTH_URL: 'https://foursquare.com/oauth2/authenticate',
  TOKEN_URL: 'https://foursquare.com/oauth2/access_token'
};

/**
 * 環境変数から設定を取得
 */
export function getEnvConfig() {
  return {
    clientId: process.env.FOURSQUARE_CLIENT_ID || '',
    clientSecret: process.env.FOURSQUARE_CLIENT_SECRET || '',
    debug: process.env.DEBUG === 'true'
  };
}