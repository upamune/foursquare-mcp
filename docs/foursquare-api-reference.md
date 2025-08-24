# Foursquare API Reference

## Overview

Foursquare API v2を使用してユーザーのチェックイン履歴やパーソナライゼーション機能にアクセスするためのAPIリファレンスドキュメント。

## SDK Setup

### Installation

Foursquare APIのTypeScript SDKは以下のコマンドでインストールできます：

```bash
bunx api install "@fsq-developers/v1.0#710fjluugs722"
```

このコマンドは以下のファイルを生成します：
- `.api/apis/fsq-developers/index.ts` - SDKメインファイル
- `.api/apis/fsq-developers/types.ts` - TypeScript型定義
- `.api/apis/fsq-developers/schemas.ts` - JSONスキーマ定義
- `.api/apis/fsq-developers/openapi.json` - OpenAPI仕様

### SDK Usage

```typescript
import SDK from '@api/fsq-developers';

// SDKインスタンスを作成
const sdk = new SDK();

// 認証を設定（Bearer Token）
sdk.auth('YOUR_ACCESS_TOKEN');

// APIバージョンを含むメタデータパラメータ
const metadata = {
  v: '20250824',  // API version (YYYYMMDD format)
  limit: 50,      // 取得件数
  offset: 0       // オフセット
};

// ユーザーのチェックインを取得
const response = await sdk.getUserCheckins(metadata);
```

### Available SDK Methods

| Method | Description |
|--------|-------------|
| `createACheckin()` | チェックインを作成 |
| `getCheckinDetails()` | チェックインの詳細を取得 |
| `deleteACheckIn()` | チェックインを削除 |
| `updateACheckin()` | チェックインを更新 |
| `getUserCheckins()` | ユーザーのチェックイン履歴を取得 |
| `getUserDetails()` | ユーザーの詳細情報を取得 |
| `getUserLists()` | ユーザーのリストを取得 |
| `getUserTastes()` | ユーザーの好みを取得 |
| `getUserTips()` | ユーザーのTipを取得 |
| `getUserActivities()` | ユーザーのアクティビティを取得 |
| `getVenueDetails()` | 会場の詳細を取得 |
| `searchForNearbyVenues()` | 近くの会場を検索 |
| `getTrendingVenues()` | トレンドの会場を取得 |
| `getVenueRecommendations()` | 会場のレコメンデーションを取得 |

## Authentication

### OAuth 2.0 認証フロー

Foursquare Personalization APIsでは、主に2つの認証方法をサポートしています：

### 1. Web App OAuth 2.0 Flow

#### Step 1: ユーザーを認証ページへリダイレクト
```
https://foursquare.com/oauth2/authenticate
    ?client_id=YOUR_CLIENT_ID
    &response_type=code
    &redirect_uri=YOUR_REGISTERED_REDIRECT_URI
```

#### Step 2: 認証コードを受け取る
ユーザーが認証を許可すると、以下のURLにリダイレクトされます：
```
https://YOUR_REGISTERED_REDIRECT_URI/?code=CODE
```

#### Step 3: アクセストークンと交換
```
POST https://foursquare.com/oauth2/access_token
    ?client_id=YOUR_CLIENT_ID
    &client_secret=YOUR_CLIENT_SECRET
    &grant_type=authorization_code
    &redirect_uri=YOUR_REGISTERED_REDIRECT_URI
    &code=CODE
```

#### Step 4: APIリクエストでアクセストークンを使用
```
Authorization: Bearer <ACCESS_TOKEN>
```

### 2. Foursquare Managed Users

アプリケーション専用のユーザーを作成する方法：

1. Developer ConsoleでService API Keyを生成
2. User Management APIを使用してユーザーを作成
3. 各ユーザーに固有の`access_token`と`userId`を受け取る
4. `access_token`/`userId`のペアを内部で保存

### 必須パラメータ

すべてのAPIリクエストには以下のパラメータが必要です：

- **v** (version): `YYYYMMDD`形式のバージョン日付（例: `20250824`）
- **Authorization**: `Bearer {ACCESS_TOKEN}` ヘッダー

## Rate Limits

### v2 API レート制限

- **User-less venue requests**: 5,000 requests/hour/app
- **User-less other requests**: 500 requests/hour/app  
- **Authenticated requests**: 500 requests/hour/OAuth token

レスポンスヘッダー：
- `X-RateLimit-Limit`: 制限値
- `X-RateLimit-Remaining`: 残りリクエスト数
- `X-RateLimit-Reset`: リセット時刻（Unix timestamp）

## Error Handling

### 一般的なエラーコード

| Code | Type | Description |
|------|------|-------------|
| 400 | param_error | パラメータエラー |
| 401 | invalid_auth | 認証エラー |
| 403 | rate_limit_exceeded | レート制限超過 |
| 429 | quota_exceeded | クォータ超過 |
| 500 | server_error | サーバーエラー |

### レスポンス形式

すべてのv2 APIレスポンスは以下の形式：

```json
{
  "meta": {
    "code": 200,
    "requestId": "..."
  },
  "notifications": [...],  // optional
  "response": {
    // endpoint specific data
  }
}
```

## Endpoints

### Get User Checkins

ユーザーのチェックイン履歴を取得します。

#### Endpoint
```
GET https://api.foursquare.com/v2/users/{USER_ID}/checkins
```

- `{USER_ID}`: `self` を指定して認証ユーザーの履歴を取得、または特定のユーザーID

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| v | string | ✓ | API バージョン（YYYYMMDD形式） |
| afterTimestamp | integer | ☓ | このタイムスタンプ以降のチェックインのみ取得（Unix timestamp） |
| beforeTimestamp | integer | ☓ | このタイムスタンプ以前のチェックインを取得（ページネーション用） |
| limit | integer | ☓ | 取得件数（最大100、デフォルト100） |
| offset | integer | ☓ | スキップする件数（ページネーション用） |
| sort | string | ☓ | ソート順: `newestfirst`（デフォルト）または `oldestfirst` |

#### Request Example

```bash
curl -X GET \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "https://api.foursquare.com/v2/users/self/checkins?v=20250824&limit=50&afterTimestamp=1717286400"
```

#### Response Example

```json
{
  "meta": {
    "code": 200,
    "requestId": "..."
  },
  "response": {
    "checkins": {
      "count": 1234,
      "items": [
        {
          "id": "checkin_uuid_string",
          "createdAt": 1625000000,
          "type": "checkin",
          "timeZoneOffset": 540,
          "shout": "Great coffee!",
          "user": {
            "id": "user_id",
            "firstName": "John",
            "lastName": "Doe",
            "photo": {
              "prefix": "https://...",
              "suffix": ".jpg"
            }
          },
          "venue": {
            "id": "venue_id",
            "name": "Blue Bottle Coffee",
            "location": {
              "lat": 35.6895,
              "lng": 139.6917,
              "address": "...",
              "city": "Tokyo",
              "country": "Japan"
            },
            "categories": [
              {
                "id": "category_id",
                "name": "Coffee Shop",
                "icon": {
                  "prefix": "https://...",
                  "suffix": ".png"
                }
              }
            ],
            "stats": {
              "checkinsCount": 5000,
              "usersCount": 2000
            }
          },
          "likes": {
            "count": 5,
            "groups": []
          },
          "comments": {
            "count": 2,
            "items": []
          },
          "photos": {
            "count": 1,
            "items": []
          },
          "source": {
            "name": "Swarm for iOS",
            "url": "https://www.swarmapp.com"
          }
        }
      ],
      "nextOffset": 50  // 追加データがある場合に表示
    }
  }
}
```

#### Checkin Object Fields

| Field | Type | Description |
|-------|------|-------------|
| id | string | チェックインのUUID |
| createdAt | integer | チェックイン作成時刻（Unix timestamp, UTC） |
| type | string | 常に "checkin" |
| timeZoneOffset | integer | 会場のUTCからの時差（分） |
| shout | string | ユーザーのコメント（オプション） |
| user | object | チェックインしたユーザー情報 |
| venue | object | 会場情報（id, name, location, categories, stats） |
| likes | object | いいね数と詳細 |
| comments | object | コメント数と詳細 |
| photos | object | 写真数と詳細 |
| source | object | チェックインを作成したアプリ情報 |

#### Pagination

##### Forward Paging
最新のチェックインから古い方向へページング：
1. 初回リクエスト: `afterTimestamp` に最後に知っているチェックインの `createdAt` を指定
2. 次のページ: レスポンスの最後のアイテムの `createdAt` を `afterTimestamp` に指定
3. `items[]` が空になるまで繰り返す

##### Backward Paging  
古いチェックインから新しい方向へページング：
1. `beforeTimestamp` または `offset` を使用
2. `items[]` が空になるまで繰り返す

#### Notes

- **Polling**: `afterTimestamp` を使用してポーリングする場合、新しい写真やコメントが追加された古いチェックインも返される
- **Time Zone**: `createdAt` はUTC時刻。ローカル時刻表示には `timeZoneOffset` を使用
- **Beta Feature**: Personalization APIsは現在Public Beta。利用にはDeveloper Consoleでのアクセス申請が必要

## SDK Code Examples

### Using Generated SDK

```typescript
import SDK from '@api/fsq-developers';

// Initialize SDK
const foursquare = new SDK();

// Set authentication
foursquare.auth('YOUR_ACCESS_TOKEN');

// Example 1: Get User Checkins with Pagination
async function getUserCheckinsExample() {
  try {
    const response = await foursquare.getUserCheckins({
      v: '20250824',
      limit: 100,
      offset: 0
    });

    if (response.status === 200) {
      const checkins = response.data.response.checkins;
      console.log(`Total checkins: ${checkins.count}`);
      
      checkins.items.forEach(checkin => {
        console.log(`${checkin.createdAt}: ${checkin.venue.name}`);
      });
    }
  } catch (error) {
    console.error('Error fetching checkins:', error);
  }
}

// Example 2: Create a Checkin
async function createCheckinExample(venueId: string, shout?: string) {
  try {
    const response = await foursquare.createACheckin({
      v: '20250824',
      venueId: venueId,
      shout: shout // Optional comment
    });

    if (response.status === 200) {
      console.log('Checkin created:', response.data.response.checkin.id);
    }
  } catch (error) {
    console.error('Error creating checkin:', error);
  }
}

// Example 3: Search for Nearby Venues
async function searchVenuesExample(lat: number, lng: number, query?: string) {
  try {
    const response = await foursquare.searchForNearbyVenues({
      v: '20250824',
      ll: `${lat},${lng}`,
      query: query,
      limit: 20
    });

    if (response.status === 200) {
      const venues = response.data.response.venues;
      venues.forEach(venue => {
        console.log(`${venue.name} - ${venue.location.distance}m away`);
      });
    }
  } catch (error) {
    console.error('Error searching venues:', error);
  }
}

// Example 4: Get Venue Details
async function getVenueDetailsExample(venueId: string) {
  try {
    const response = await foursquare.getVenueDetails({
      v: '20250824',
      venueId: venueId
    });

    if (response.status === 200) {
      const venue = response.data.response.venue;
      console.log(`Venue: ${venue.name}`);
      console.log(`Address: ${venue.location.address}`);
      console.log(`Rating: ${venue.rating}`);
    }
  } catch (error) {
    console.error('Error fetching venue details:', error);
  }
}
```

## Code Examples

### Node.js (Fetch API)

```javascript
// Get last 24 hours of checkins
const getRecentCheckins = async (accessToken) => {
  const params = new URLSearchParams({
    v: '20250824',
    limit: '100',
    afterTimestamp: Math.floor(Date.now() / 1000) - 86400  // 24 hours ago
  });

  const response = await fetch(
    `https://api.foursquare.com/v2/users/self/checkins?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.meta.code !== 200) {
    throw new Error(`API error: ${data.meta.errorDetail}`);
  }

  return data.response.checkins.items;
};
```

### TypeScript Types

```typescript
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

interface CheckinsResponse {
  checkins: {
    count: number;
    items: Checkin[];
    nextOffset?: number;
  };
}

interface Checkin {
  id: string;
  createdAt: number;
  type: 'checkin';
  timeZoneOffset: number;
  shout?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
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
      city?: string;
      state?: string;
      country?: string;
    };
    categories: Array<{
      id: string;
      name: string;
      icon: {
        prefix: string;
        suffix: string;
      };
    }>;
    stats: {
      checkinsCount: number;
      usersCount: number;
    };
  };
  likes: {
    count: number;
    groups: any[];
  };
  comments: {
    count: number;
    items: any[];
  };
  photos: {
    count: number;
    items: any[];
  };
  source: {
    name: string;
    url: string;
  };
}
```

## Best Practices

1. **Version Parameter**: 常に最新の日付を `v` パラメータに設定して、非推奨の動作を避ける
2. **Error Handling**: すべてのAPIレスポンスの `meta.code` をチェック
3. **Rate Limiting**: `X-RateLimit-*` ヘッダーを監視して制限を超えないようにする
4. **Token Storage**: アクセストークンを安全に保存し、必要に応じてリフレッシュ
5. **Pagination**: 大量のデータを取得する場合は適切なページネーションを実装
6. **Timezone Handling**: `createdAt` はUTC。表示時は `timeZoneOffset` を考慮

## References

- [Foursquare Developer Portal](https://developer.foursquare.com/)
- [Personalization API Documentation](https://docs.foursquare.com/developer/reference/personalization-apis)
- [OAuth 2.0 Authentication Guide](https://docs.foursquare.com/developer/reference/personalization-apis-authentication)
- [API Version Changes](https://developer.foursquare.com/docs/api/configuration/versioning)