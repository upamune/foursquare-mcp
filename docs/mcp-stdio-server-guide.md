# MCP Stdio サーバー実装ガイド

このドキュメントでは、`@modelcontextprotocol/sdk` v1.17.4を使用してMCP (Model Context Protocol) stdioサーバーを実装する方法について詳しく説明します。

## 目次

1. [概要](#概要)
2. [必要な環境](#必要な環境)
3. [セットアップ](#セットアップ)
4. [基本的な実装](#基本的な実装)
5. [ツール、リソース、プロンプトの実装](#ツールリソースプロンプトの実装)
6. [高度な機能](#高度な機能)
7. [ベストプラクティス](#ベストプラクティス)
8. [トラブルシューティング](#トラブルシューティング)

## 概要

MCP (Model Context Protocol) は、LLMアプリケーションが外部データソースやツールと標準化された方法で統合できるようにするオープンプロトコルです。stdioトランスポートは、標準入力（stdin）と標準出力（stdout）を使用して通信する最も基本的なトランスポート方式です。

### stdioトランスポートの特徴

- **シンプル**: プロセス間通信で最もシンプルな方式
- **軽量**: 追加のネットワーク設定不要
- **互換性**: CLIツールやローカル環境での使用に最適
- **セキュア**: ローカルプロセス間通信のため、ネットワーク経由の攻撃リスクなし

## 必要な環境

### システム要件

- **Node.js**: v18.x以上
- **npm** または **bun**（Bunを使用する場合）
- **TypeScript**: v5.0以上（推奨）

### 依存パッケージ

```bash
# npm を使用する場合
npm install @modelcontextprotocol/sdk@1.17.4 zod

# Bun を使用する場合
bun install @modelcontextprotocol/sdk@1.17.4 zod
```

## セットアップ

### 1. プロジェクトの初期化

```bash
mkdir my-mcp-server
cd my-mcp-server
npm init -y
```

### 2. TypeScript設定

`tsconfig.json`を作成:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. package.json の設定

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.17.4",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

## 基本的な実装

### 最小限のstdioサーバー

`src/index.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// MCPサーバーインスタンスを作成
const server = new McpServer({
  name: "my-mcp-server",
  version: "1.0.0"
});

async function main() {
  // Stdioトランスポートを作成
  const transport = new StdioServerTransport();
  
  // サーバーをトランスポートに接続
  await server.connect(transport);
  
  // エラー出力にログを記録（stdoutはMCP通信に使用されるため）
  console.error("MCP server is running...");
}

// メインプロセスを実行
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

## ツール、リソース、プロンプトの実装

### 1. ツール（Tools）の実装

ツールは、サーバーが実行できる関数やアクションを定義します。

```typescript
import { z } from "zod";

// 加算ツール
server.registerTool(
  "add",
  {
    title: "加算ツール",
    description: "2つの数値を加算します",
    inputSchema: {
      a: z.number().describe("第1引数"),
      b: z.number().describe("第2引数")
    }
  },
  async ({ a, b }) => ({
    content: [{
      type: "text",
      text: `${a} + ${b} = ${a + b}`
    }]
  })
);

// 外部APIを呼び出すツール
server.registerTool(
  "fetch-weather",
  {
    title: "天気情報取得",
    description: "指定された都市の天気情報を取得します",
    inputSchema: {
      city: z.string().describe("都市名")
    }
  },
  async ({ city }) => {
    try {
      // 実際のAPI呼び出しをここに実装
      const response = await fetch(`https://api.weather.com/v1/weather?city=${city}`);
      const data = await response.json();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `エラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// ファイルリストを返すツール（ResourceLinksを使用）
server.registerTool(
  "list-files",
  {
    title: "ファイル一覧",
    description: "指定パターンにマッチするファイルをリストします",
    inputSchema: {
      pattern: z.string().default("*").describe("ファイルパターン")
    }
  },
  async ({ pattern }) => ({
    content: [
      { type: "text", text: `パターン "${pattern}" にマッチするファイル:` },
      {
        type: "resource_link",
        uri: "file:///project/README.md",
        name: "README.md",
        mimeType: "text/markdown",
        description: "プロジェクトのREADMEファイル"
      },
      {
        type: "resource_link",
        uri: "file:///project/src/index.ts",
        name: "index.ts",
        mimeType: "text/typescript",
        description: "メインのTypeScriptファイル"
      }
    ]
  })
);
```

### 2. リソース（Resources）の実装

リソースは、サーバーが提供できるデータやコンテンツを定義します。

```typescript
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// 静的リソース
server.registerResource(
  "config",
  "config://app",
  {
    title: "アプリケーション設定",
    description: "アプリケーションの設定情報",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        environment: "production",
        version: "1.0.0",
        features: {
          auth: true,
          logging: true
        }
      }, null, 2)
    }]
  })
);

// 動的リソース（パラメータ付き）
server.registerResource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    title: "ユーザープロフィール",
    description: "ユーザーのプロフィール情報を取得"
  },
  async (uri, { userId }) => {
    // 実際のデータベースアクセスをここに実装
    const userData = {
      id: userId,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      created: new Date().toISOString()
    };
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(userData, null, 2)
      }]
    };
  }
);

// コンテキスト対応の補完機能付きリソース
server.registerResource(
  "repository",
  new ResourceTemplate("github://repos/{owner}/{repo}", {
    list: undefined,
    complete: {
      // ownerパラメータに基づいてrepoの補完候補を提供
      repo: (value, context) => {
        if (context?.arguments?.["owner"] === "microsoft") {
          return ["vscode", "typescript", "playwright"].filter(r => r.startsWith(value));
        } else if (context?.arguments?.["owner"] === "facebook") {
          return ["react", "jest", "flow"].filter(r => r.startsWith(value));
        }
        return [];
      }
    }
  }),
  {
    title: "GitHubリポジトリ",
    description: "GitHubリポジトリ情報"
  },
  async (uri, { owner, repo }) => ({
    contents: [{
      uri: uri.href,
      text: `リポジトリ: ${owner}/${repo}`
    }]
  })
);
```

### 3. プロンプト（Prompts）の実装

プロンプトは、LLMに送信する構造化されたメッセージテンプレートを定義します。

```typescript
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";

// 基本的なプロンプト
server.registerPrompt(
  "code-review",
  {
    title: "コードレビュー",
    description: "コードレビューを実行します",
    argsSchema: {
      code: z.string().describe("レビュー対象のコード"),
      language: z.enum(["javascript", "typescript", "python"]).optional()
        .describe("プログラミング言語")
    }
  },
  ({ code, language }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `以下の${language || ""}コードをレビューしてください。
改善点、バグ、ベストプラクティスの観点から分析してください:

\`\`\`${language || ""}
${code}
\`\`\`
`
      }
    }]
  })
);

// 補完機能付きプロンプト
server.registerPrompt(
  "team-greeting",
  {
    title: "チーム挨拶",
    description: "チームメンバーへの挨拶を生成",
    argsSchema: {
      department: completable(z.string(), (value) => {
        // 部門の補完候補
        return ["engineering", "sales", "marketing", "support"]
          .filter(d => d.startsWith(value));
      }),
      name: completable(z.string(), (value, context) => {
        // 部門に基づいた名前の補完候補
        const department = context?.arguments?.["department"];
        if (department === "engineering") {
          return ["Alice", "Bob", "Charlie"].filter(n => n.startsWith(value));
        }
        return ["Guest"].filter(n => n.startsWith(value));
      })
    }
  },
  ({ department, name }) => ({
    messages: [{
      role: "assistant",
      content: {
        type: "text",
        text: `こんにちは${name}さん、${department}チームへようこそ！`
      }
    }]
  })
);
```

## 高度な機能

### 1. 動的な機能管理

実行時にツールやリソースを追加、有効化、無効化、更新できます。

```typescript
const listMessageTool = server.tool(
  "listMessages",
  { channel: z.string() },
  async ({ channel }) => ({
    content: [{
      type: "text",
      text: `チャンネル ${channel} のメッセージ一覧`
    }]
  })
);

const putMessageTool = server.tool(
  "putMessage",
  { channel: z.string(), message: z.string() },
  async ({ channel, message }) => ({
    content: [{
      type: "text",
      text: `メッセージを ${channel} に投稿しました`
    }]
  })
);

// 初期状態では無効化
putMessageTool.disable();

// 権限アップグレードツール
const upgradeAuthTool = server.tool(
  "upgradeAuth",
  { permission: z.enum(["write", "admin"]) },
  async ({ permission }) => {
    // 権限をアップグレード
    if (permission === "write") {
      putMessageTool.enable();  // putMessageツールを有効化
      upgradeAuthTool.update({
        paramSchema: { permission: z.enum(["admin"]) }
      });
    } else if (permission === "admin") {
      // 管理者権限取得後はアップグレードツールを削除
      upgradeAuthTool.remove();
    }
    
    return {
      content: [{
        type: "text",
        text: `権限を ${permission} にアップグレードしました`
      }]
    };
  }
);
```

### 2. LLMサンプリング機能

サーバーからLLMに直接問い合わせることができます。

```typescript
server.registerTool(
  "summarize",
  {
    description: "テキストを要約します",
    inputSchema: {
      text: z.string().describe("要約対象のテキスト"),
      maxWords: z.number().optional().default(100)
        .describe("要約の最大単語数")
    }
  },
  async ({ text, maxWords }) => {
    // LLMを通じて要約を生成
    const response = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `以下のテキストを${maxWords}単語以内で要約してください:\n\n${text}`
          }
        }
      ],
      maxTokens: 500
    });

    return {
      content: [{
        type: "text",
        text: response.content.type === "text" 
          ? response.content.text 
          : "要約の生成に失敗しました"
      }]
    };
  }
);
```

### 3. ユーザー入力の取得（Elicitation）

実行中にユーザーから追加情報を取得できます。

```typescript
server.tool(
  "book-restaurant",
  {
    restaurant: z.string(),
    date: z.string(),
    partySize: z.number()
  },
  async ({ restaurant, date, partySize }) => {
    // 空席確認
    const available = await checkAvailability(restaurant, date, partySize);

    if (!available) {
      // ユーザーに代替日程の確認を求める
      const result = await server.server.elicitInput({
        message: `${restaurant}は${date}に空席がありません。代替日程を確認しますか？`,
        requestedSchema: {
          type: "object",
          properties: {
            checkAlternatives: {
              type: "boolean",
              title: "代替日程を確認",
              description: "他の日程を確認しますか？"
            },
            flexibleDates: {
              type: "string",
              title: "日程の柔軟性",
              description: "どの程度日程を変更できますか？",
              enum: ["next_day", "same_week", "next_week"],
              enumNames: ["翌日", "同じ週内", "翌週"]
            }
          },
          required: ["checkAlternatives"]
        }
      });

      if (result.action === "accept" && result.content?.checkAlternatives) {
        const alternatives = await findAlternatives(
          restaurant,
          date,
          partySize,
          result.content.flexibleDates as string
        );
        
        return {
          content: [{
            type: "text",
            text: `代替日程: ${alternatives.join(", ")}`
          }]
        };
      }
    }

    // 予約実行
    await makeBooking(restaurant, date, partySize);
    return {
      content: [{
        type: "text",
        text: `${restaurant}を${date}に${partySize}名で予約しました`
      }]
    };
  }
);
```

### 4. 通知のデバウンシング

高頻度の変更通知を集約してパフォーマンスを改善できます。

```typescript
const server = new McpServer(
  {
    name: "efficient-server",
    version: "1.0.0"
  },
  {
    // 特定のメソッドの通知をデバウンス
    debouncedNotificationMethods: [
      'notifications/tools/list_changed',
      'notifications/resources/list_changed',
      'notifications/prompts/list_changed'
    ]
  }
);

// 複数の変更が行われても、1つの通知にまとめられる
server.registerTool("tool1", ...).disable();
server.registerTool("tool2", ...).disable();
server.registerTool("tool3", ...).disable();
// 'notifications/tools/list_changed' は1回だけ送信される
```

## ベストプラクティス

### 1. エラーハンドリング

```typescript
server.registerTool(
  "safe-operation",
  {
    title: "安全な操作",
    inputSchema: { input: z.string() }
  },
  async ({ input }) => {
    try {
      // 危険な操作
      const result = await riskyOperation(input);
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      // エラーを適切に処理
      console.error("Operation failed:", error);
      
      return {
        content: [{
          type: "text",
          text: `エラーが発生しました: ${error.message}`
        }],
        isError: true  // エラーフラグを設定
      };
    }
  }
);
```

### 2. ログ出力

stdioサーバーでは、stdoutがMCP通信に使用されるため、ログは必ずstderrに出力します。

```typescript
// 正しい
console.error("Debug information");
process.stderr.write("Log message\n");

// 間違い（MCP通信を妨害する）
// console.log("This will break MCP communication");
// process.stdout.write("Don't do this\n");
```

### 3. グレースフルシャットダウン

```typescript
// シグナルハンドラーを設定
process.on('SIGINT', async () => {
  console.error("Shutting down server...");
  
  // クリーンアップ処理
  await cleanup();
  
  // トランスポートを閉じる
  transport.close();
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Terminating server...");
  await cleanup();
  transport.close();
  process.exit(0);
});
```

### 4. 型安全性の確保

```typescript
import { z } from "zod";

// 入力スキーマを定義
const AddInputSchema = z.object({
  a: z.number().min(0).max(1000000),
  b: z.number().min(0).max(1000000)
});

// 型を抽出
type AddInput = z.infer<typeof AddInputSchema>;

server.registerTool(
  "add",
  {
    title: "加算",
    inputSchema: AddInputSchema
  },
  async (input: AddInput) => {
    // TypeScriptの型チェックが効く
    const result = input.a + input.b;
    
    return {
      content: [{
        type: "text",
        text: String(result)
      }]
    };
  }
);
```

## トラブルシューティング

### 1. サーバーが起動しない

**問題**: `Error: Cannot find module`

**解決策**:
```bash
# 依存関係を再インストール
rm -rf node_modules package-lock.json
npm install

# TypeScriptをコンパイル
npm run build
```

### 2. 通信エラー

**問題**: クライアントとの通信が確立できない

**解決策**:
- stdoutに何も出力していないか確認（console.logは使用不可）
- エラーメッセージはstderrに出力する
- プロセスが正常に起動しているか確認

### 3. ツールが実行されない

**問題**: 登録したツールが動作しない

**解決策**:
```typescript
// デバッグログを追加
server.registerTool(
  "debug-tool",
  { input: z.string() },
  async ({ input }) => {
    console.error("Tool called with:", input);  // stderrにログ
    
    try {
      const result = await operation(input);
      console.error("Tool result:", result);
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      console.error("Tool error:", error);
      throw error;  // エラーを再スロー
    }
  }
);
```

### 4. メモリリーク

**問題**: 長時間実行でメモリ使用量が増加

**解決策**:
- イベントリスナーの適切な削除
- 大きなデータのキャッシュを制限
- 定期的なガベージコレクション

```typescript
// リソースのクリーンアップ
const cleanup = async () => {
  // データベース接続を閉じる
  await db.close();
  
  // キャッシュをクリア
  cache.clear();
  
  // タイマーをクリア
  clearInterval(intervalId);
};
```

## まとめ

MCP stdioサーバーは、LLMアプリケーションと統合するための強力で柔軟なプロトコルです。このガイドで説明した実装パターンとベストプラクティスに従うことで、堅牢で保守性の高いMCPサーバーを構築できます。

### 次のステップ

1. **公式ドキュメント**: [Model Context Protocol](https://modelcontextprotocol.io/)
2. **SDKリポジトリ**: [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
3. **サンプル実装**: [servers](https://github.com/modelcontextprotocol/servers)

### サポート

問題が発生した場合は、以下のリソースを参照してください：

- [GitHub Issues](https://github.com/modelcontextprotocol/typescript-sdk/issues)
- [Discord Community](https://discord.gg/modelcontextprotocol)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/mcp)