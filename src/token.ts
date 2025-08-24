import * as fs from 'fs/promises';
import { getTokenPath, ensureConfigDir } from './config.js';

/**
 * トークン情報の型定義
 */
export interface TokenInfo {
  access_token: string;
  created_at: number;
  expires_in?: number;
}

/**
 * トークン管理クラス
 */
export class TokenManager {
  private tokenPath: string | null = null;

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    await ensureConfigDir();
    this.tokenPath = await getTokenPath();
  }

  /**
   * トークンを保存
   */
  async saveToken(token: TokenInfo): Promise<void> {
    if (!this.tokenPath) {
      await this.initialize();
    }

    // トークンファイルを保存（権限600）
    await fs.writeFile(
      this.tokenPath!,
      JSON.stringify(token, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * トークンを読み込み
   */
  async loadToken(): Promise<TokenInfo | null> {
    if (!this.tokenPath) {
      await this.initialize();
    }

    try {
      const data = await fs.readFile(this.tokenPath!, 'utf-8');
      return JSON.parse(data) as TokenInfo;
    } catch (error: any) {
      // ファイルが存在しない場合はnullを返す
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * トークンを削除
   */
  async deleteToken(): Promise<void> {
    if (!this.tokenPath) {
      await this.initialize();
    }

    try {
      await fs.unlink(this.tokenPath!);
    } catch (error: any) {
      // ファイルが存在しない場合はエラーを無視
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * トークンが存在するかチェック
   */
  async hasToken(): Promise<boolean> {
    const token = await this.loadToken();
    return token !== null;
  }

  /**
   * トークンの有効期限をチェック（現時点では常にtrueを返す）
   * Foursquareのトークンは通常無期限
   */
  async isTokenValid(): Promise<boolean> {
    const token = await this.loadToken();
    if (!token) {
      return false;
    }

    // 有効期限が設定されている場合はチェック
    if (token.expires_in && token.created_at) {
      const expiresAt = token.created_at + token.expires_in * 1000;
      if (Date.now() > expiresAt) {
        return false;
      }
    }

    return true;
  }
}

// シングルトンインスタンス
export const tokenManager = new TokenManager();