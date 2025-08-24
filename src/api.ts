import fetch from 'node-fetch';
import { API_CONFIG } from './config.js';
import { tokenManager } from './token.js';

/**
 * Foursquare APIレスポンスの基本型
 */
interface FoursquareResponse<T> {
  meta: {
    code: number;
    requestId: string;
    errorType?: string;
    errorDetail?: string;
  };
  notifications?: any[];
  response: T;
}

/**
 * チェックインレスポンスの型
 */
interface CheckinsResponse {
  checkins: {
    count: number;
    items: Checkin[];
    nextOffset?: number;
  };
}

/**
 * 写真の型
 */
interface Photo {
  createdAt: number;
  height: number;
  id: string;
  prefix: string;
  source: {
    name: string;
    url: string;
  };
  suffix: string;
  user: {
    birthday: number;
    countryCode: string;
    firstName: string;
    gender: string;
    handle: string;
    id: string;
    isAnonymous: boolean;
    lastName: string;
    photo: {
      privateProfile: boolean;
      relationship: string;
      visibility: string;
    };
  };
  width: number;
}

/**
 * チェックインの型
 */
export interface Checkin {
  id: string;
  createdAt: number;
  type: 'checkin';
  timeZoneOffset: number;
  shout?: string;
  user: {
    id: string;
    firstName: string;
    lastName?: string;
    photo?: {
      prefix: string;
      suffix: string;
    };
  };
  venue: {
    id: string;
    name: string;
    location: {
      lat: number;
      lng: number;
      address?: string;
      crossStreet?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      formattedAddress?: string[];
    };
    categories: Array<{
      id: string;
      name: string;
      pluralName: string;
      shortName: string;
      icon: {
        prefix: string;
        suffix: string;
      };
      primary?: boolean;
    }>;
    stats?: {
      checkinsCount: number;
      usersCount: number;
      tipCount?: number;
    };
  };
  likes?: {
    count: number;
    groups: any[];
  };
  comments?: {
    count: number;
    items: any[];
  };
  photos?: {
    count: number;
    items: Photo[];
  };
  source?: {
    name: string;
    url?: string;
  };
}

/**
 * Foursquare APIクラス
 */
export class FoursquareAPI {
  private accessToken: string | null = null;

  /**
   * アクセストークンを設定
   */
  async setToken(token?: string): Promise<void> {
    if (token) {
      this.accessToken = token;
    } else {
      const tokenInfo = await tokenManager.loadToken();
      if (!tokenInfo) {
        throw new Error('トークンが見つかりません。先に認証を実行してください。');
      }
      this.accessToken = tokenInfo.access_token;
    }
  }

  /**
   * ユーザーのチェックインを取得
   */
  async getUserCheckins(options: {
    limit?: number;
    afterTimestamp?: number;
    beforeTimestamp?: number;
    sort?: 'newestfirst' | 'oldestfirst';
  } = {}): Promise<Checkin[]> {
    if (!this.accessToken) {
      await this.setToken();
    }

    const params = new URLSearchParams({
      v: API_CONFIG.VERSION,
      limit: (options.limit || 50).toString(),
      sort: options.sort || 'newestfirst',
    });

    if (options.afterTimestamp) {
      params.append('afterTimestamp', options.afterTimestamp.toString());
    }

    if (options.beforeTimestamp) {
      params.append('beforeTimestamp', options.beforeTimestamp.toString());
    }

    const url = `${API_CONFIG.BASE_URL}/users/self/checkins?${params}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as FoursquareResponse<CheckinsResponse>;

    if (data.meta.code !== 200) {
      throw new Error(`API error: ${data.meta.errorType} - ${data.meta.errorDetail}`);
    }

    return data.response.checkins.items;
  }

  /**
   * APIが利用可能かチェック（トークン検証用）
   */
  async checkAuth(): Promise<boolean> {
    if (!this.accessToken) {
      const tokenInfo = await tokenManager.loadToken();
      if (!tokenInfo) {
        return false;
      }
      this.accessToken = tokenInfo.access_token;
    }

    try {
      const params = new URLSearchParams({
        v: API_CONFIG.VERSION,
        limit: '1',
      });

      const url = `${API_CONFIG.BASE_URL}/users/self/checkins?${params}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * チェックイン日時をJSTでフォーマット
   */
  formatCheckinDate(checkin: Checkin): string {
    const date = new Date(checkin.createdAt * 1000);
    const jstDate = new Date(date.getTime() + (checkin.timeZoneOffset || 540) * 60 * 1000);
    
    const year = jstDate.getFullYear();
    const month = String(jstDate.getMonth() + 1).padStart(2, '0');
    const day = String(jstDate.getDate()).padStart(2, '0');
    const hours = String(jstDate.getHours()).padStart(2, '0');
    const minutes = String(jstDate.getMinutes()).padStart(2, '0');
    
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  }

  /**
   * チェックインを整形して表示用文字列に変換
   */
  formatCheckin(checkin: Checkin): string {
    const lines: string[] = [];
    
    // 場所名
    lines.push(`📍 ${checkin.venue.name}`);
    
    // 日時
    lines.push(`📅 ${this.formatCheckinDate(checkin)}`);
    
    // コメント
    if (checkin.shout) {
      lines.push(`💬 ${checkin.shout}`);
    }
    
    // 住所
    if (checkin.venue.location.formattedAddress && checkin.venue.location.formattedAddress.length > 0) {
      lines.push(`📮 ${checkin.venue.location.formattedAddress.join(', ')}`);
    } else if (checkin.venue.location.address) {
      const addressParts = [
        checkin.venue.location.address,
        checkin.venue.location.city,
        checkin.venue.location.state,
        checkin.venue.location.country
      ].filter(Boolean);
      if (addressParts.length > 0) {
        lines.push(`📮 ${addressParts.join(', ')}`);
      }
    }
    
    // カテゴリー
    if (checkin.venue.categories && checkin.venue.categories.length > 0) {
      const categories = checkin.venue.categories.map(c => c.name).join(', ');
      lines.push(`🏷️ ${categories}`);
    }
    
    // 位置情報
    if (checkin.venue.location.lat && checkin.venue.location.lng) {
      lines.push(`🗺️ ${checkin.venue.location.lat}, ${checkin.venue.location.lng}`);
    }

    // 写真
    if (checkin.photos && checkin.photos.items && checkin.photos.items.length > 0) {
      lines.push(`📸 写真 (${checkin.photos.count}枚)`);
      checkin.photos.items.forEach((photo, index) => {
        const photoUrl = `${photo.prefix}original${photo.suffix}`;
        lines.push(`   ${index + 1}. ${photoUrl}`);
      });
    }

    return lines.join('\n');
  }
}

// シングルトンインスタンス
export const foursquareAPI = new FoursquareAPI();