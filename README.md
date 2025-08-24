# Foursquare MCP Server

Foursquare APIとの連携を提供するModel Context Protocol (MCP)サーバーです。

## 必要な環境

- [Bun](https://bun.sh/) >= 1.0.0
- Foursquare Developer アカウント
- MCPクライアント（Claude Desktop等）

## 使い方

### bunx を使った簡単な実行

```bash
bunx @upamune/foursquare-mcp
```

### リポジトリからの実行

```bash
git clone https://github.com/upamune/foursquare-mcp.git
cd foursquare-mcp
bun install
bun run index.ts
```

## Foursquare Developer設定

1. [Foursquare Developer Portal](https://developer.foursquare.com/)でアカウントを作成
2. 新しいアプリケーションを作成  
3. OAuth設定でRedirect URIに `http://localhost:52847/callback` を追加
4. CLIENT_IDとCLIENT_SECRETを取得

## Claude Desktop設定

`~/Library/Application Support/Claude/claude_desktop_config.json`に以下を追加：

```json
{
  "mcpServers": {
    "foursquare": {
      "command": "bunx",
      "args": ["@upamune/foursquare-mcp"],
      "env": {
        "FOURSQUARE_CLIENT_ID": "your_client_id",
        "FOURSQUARE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

または、リポジトリをクローンした場合：

```json
{
  "mcpServers": {
    "foursquare": {
      "command": "bun",
      "args": ["run", "/path/to/foursquare-mcp/index.ts"],
      "env": {
        "FOURSQUARE_CLIENT_ID": "your_client_id",
        "FOURSQUARE_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

## 機能

### authenticate
初回利用時にFoursquare認証を行います。ブラウザが自動的に開き、ログイン後トークンが保存されます。

### check-auth-status
保存されたトークンの有効性を確認します。

### get-user-checkins
チェックイン履歴を取得します。

パラメータ:
- `limit`: 取得件数（デフォルト: 50、最大: 100）
- `afterTimestamp`: 指定したUnixタイムスタンプ以降のチェックインのみ取得
- `sort`: ソート順（"newestfirst" または "oldestfirst"）

## トークン管理

### トークン保存場所

- Linux: `~/.config/foursquare-mcp/token.json`
- macOS: `~/Library/Application Support/foursquare-mcp/token.json`
- Windows: `%APPDATA%\foursquare-mcp\token.json`

### 環境変数でのトークン指定

`FOURSQUARE_ACCESS_TOKEN` 環境変数を設定することで、保存されたトークンファイルより優先してアクセストークンを使用できます：

```json
{
  "mcpServers": {
    "foursquare": {
      "command": "bunx",
      "args": ["@upamune/foursquare-mcp"],
      "env": {
        "FOURSQUARE_CLIENT_ID": "your_client_id",
        "FOURSQUARE_CLIENT_SECRET": "your_client_secret",
        "FOURSQUARE_ACCESS_TOKEN": "your_access_token"
      }
    }
  }
}
```

この機能は以下のような場合に便利です：
- 複数環境でトークンを共有したい場合
- CI/CD環境での利用
- トークンファイルの管理を避けたい場合

## ライセンス

MIT License

