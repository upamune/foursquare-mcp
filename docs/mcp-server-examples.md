# MCP Stdioサーバー実装例集

このドキュメントでは、`@modelcontextprotocol/sdk` v1.17.4を使用した実践的なMCPサーバーの実装例を紹介します。

## 1. ファイルシステム操作サーバー

ローカルファイルシステムを操作するMCPサーバーの実装例です。

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";

const server = new McpServer({
  name: "filesystem-server",
  version: "1.0.0"
});

// ファイル読み取りツール
server.registerTool(
  "read-file",
  {
    title: "ファイル読み取り",
    description: "指定されたファイルの内容を読み取ります",
    inputSchema: {
      filepath: z.string().describe("ファイルパス"),
      encoding: z.enum(["utf8", "base64"]).optional().default("utf8")
        .describe("エンコーディング")
    }
  },
  async ({ filepath, encoding }) => {
    try {
      const content = await fs.readFile(filepath, encoding);
      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `ファイル読み取りエラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// ファイル書き込みツール
server.registerTool(
  "write-file",
  {
    title: "ファイル書き込み",
    description: "ファイルに内容を書き込みます",
    inputSchema: {
      filepath: z.string().describe("ファイルパス"),
      content: z.string().describe("書き込む内容"),
      append: z.boolean().optional().default(false)
        .describe("追記モード")
    }
  },
  async ({ filepath, content, append }) => {
    try {
      if (append) {
        await fs.appendFile(filepath, content, "utf8");
      } else {
        await fs.writeFile(filepath, content, "utf8");
      }
      return {
        content: [{
          type: "text",
          text: `ファイルを${append ? "追記" : "書き込み"}しました: ${filepath}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `ファイル書き込みエラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// ディレクトリ一覧ツール
server.registerTool(
  "list-directory",
  {
    title: "ディレクトリ一覧",
    description: "ディレクトリの内容を一覧表示します",
    inputSchema: {
      dirpath: z.string().describe("ディレクトリパス"),
      recursive: z.boolean().optional().default(false)
        .describe("再帰的に取得")
    }
  },
  async ({ dirpath, recursive }) => {
    try {
      const listDir = async (dir: string, level = 0): Promise<string[]> => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const results: string[] = [];
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const indent = "  ".repeat(level);
          
          if (entry.isDirectory()) {
            results.push(`${indent}📁 ${entry.name}/`);
            if (recursive) {
              results.push(...await listDir(fullPath, level + 1));
            }
          } else {
            results.push(`${indent}📄 ${entry.name}`);
          }
        }
        
        return results;
      };
      
      const items = await listDir(dirpath);
      
      return {
        content: [{
          type: "text",
          text: items.join("\n")
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `ディレクトリ読み取りエラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// ファイル情報リソース
server.registerResource(
  "file-info",
  new ResourceTemplate("file://{filepath}", { list: undefined }),
  {
    title: "ファイル情報",
    description: "ファイルの詳細情報を取得"
  },
  async (uri, { filepath }) => {
    try {
      const stats = await fs.stat(filepath);
      const info = {
        path: filepath,
        size: stats.size,
        sizeReadable: `${(stats.size / 1024).toFixed(2)} KB`,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8)
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(info, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `エラー: ${error.message}`
        }]
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Filesystem MCP Server is running...");
}

main().catch(console.error);
```

## 2. データベース操作サーバー（SQLite）

SQLiteデータベースを操作するMCPサーバーの実装例です。

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sqlite3 from "sqlite3";
import { promisify } from "util";

const server = new McpServer({
  name: "sqlite-server",
  version: "1.0.0"
});

// データベース接続ヘルパー
const getDb = (dbPath: string = "database.db") => {
  const db = new sqlite3.Database(dbPath);
  return {
    all: promisify<string, any[]>(db.all.bind(db)),
    run: promisify<string, any>(db.run.bind(db)),
    get: promisify<string, any>(db.get.bind(db)),
    close: promisify(db.close.bind(db))
  };
};

// スキーマリソース
server.registerResource(
  "schema",
  "schema://database",
  {
    title: "データベーススキーマ",
    description: "データベースの構造を表示",
    mimeType: "text/plain"
  },
  async (uri) => {
    const db = getDb();
    try {
      const tables = await db.all(
        "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const schema = tables.map((table: any) => {
        return `-- Table: ${table.name}\n${table.sql}`;
      }).join("\n\n");
      
      return {
        contents: [{
          uri: uri.href,
          text: schema || "No tables found"
        }]
      };
    } finally {
      await db.close();
    }
  }
);

// SQLクエリ実行ツール
server.registerTool(
  "execute-query",
  {
    title: "SQLクエリ実行",
    description: "SQLクエリを実行します（SELECT文のみ）",
    inputSchema: {
      query: z.string().describe("SQLクエリ"),
      database: z.string().optional().default("database.db")
        .describe("データベースファイルパス")
    }
  },
  async ({ query, database }) => {
    // SELECT文のみ許可
    if (!query.trim().toLowerCase().startsWith("select")) {
      return {
        content: [{
          type: "text",
          text: "エラー: SELECT文のみ実行可能です"
        }],
        isError: true
      };
    }
    
    const db = getDb(database);
    try {
      const results = await db.all(query);
      
      // 結果をテーブル形式で整形
      if (results.length > 0) {
        const headers = Object.keys(results[0]);
        const table = [
          headers.join(" | "),
          headers.map(() => "---").join(" | "),
          ...results.map(row => 
            headers.map(h => String(row[h] ?? "NULL")).join(" | ")
          )
        ].join("\n");
        
        return {
          content: [{
            type: "text",
            text: table
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "結果: 0行"
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `クエリエラー: ${error.message}`
        }],
        isError: true
      };
    } finally {
      await db.close();
    }
  }
);

// テーブル作成ツール
server.registerTool(
  "create-table",
  {
    title: "テーブル作成",
    description: "新しいテーブルを作成します",
    inputSchema: {
      tableName: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
        .describe("テーブル名"),
      columns: z.array(z.object({
        name: z.string().describe("カラム名"),
        type: z.enum(["TEXT", "INTEGER", "REAL", "BLOB"])
          .describe("データ型"),
        primaryKey: z.boolean().optional().describe("主キー"),
        notNull: z.boolean().optional().describe("NOT NULL制約"),
        unique: z.boolean().optional().describe("UNIQUE制約")
      })).describe("カラム定義")
    }
  },
  async ({ tableName, columns }) => {
    const db = getDb();
    try {
      const columnDefs = columns.map(col => {
        let def = `${col.name} ${col.type}`;
        if (col.primaryKey) def += " PRIMARY KEY";
        if (col.notNull) def += " NOT NULL";
        if (col.unique) def += " UNIQUE";
        return def;
      }).join(", ");
      
      const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;
      await db.run(sql);
      
      return {
        content: [{
          type: "text",
          text: `テーブル '${tableName}' を作成しました\nSQL: ${sql}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `テーブル作成エラー: ${error.message}`
        }],
        isError: true
      };
    } finally {
      await db.close();
    }
  }
);

// データベース統計情報プロンプト
server.registerPrompt(
  "database-analysis",
  {
    title: "データベース分析",
    description: "データベースの統計情報を分析",
    argsSchema: {
      database: z.string().optional().default("database.db")
    }
  },
  async ({ database }) => {
    const db = getDb(database);
    try {
      // テーブル一覧取得
      const tables = await db.all(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      
      // 各テーブルの行数取得
      const stats = await Promise.all(
        tables.map(async (table: any) => {
          const count = await db.get(
            `SELECT COUNT(*) as count FROM ${table.name}`
          );
          return `${table.name}: ${count.count}行`;
        })
      );
      
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `データベース '${database}' の統計情報を分析してください:
            
テーブル数: ${tables.length}
各テーブルの行数:
${stats.join("\n")}

このデータベースの構造と使用状況について、改善点やインデックスの提案を含めて分析してください。`
          }
        }]
      };
    } finally {
      await db.close();
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SQLite MCP Server is running...");
}

main().catch(console.error);
```

## 3. Web API統合サーバー

外部Web APIと統合するMCPサーバーの実装例です。

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "web-api-server",
  version: "1.0.0"
});

// HTTPリクエストツール
server.registerTool(
  "http-request",
  {
    title: "HTTPリクエスト",
    description: "HTTPリクエストを送信します",
    inputSchema: {
      url: z.string().url().describe("リクエストURL"),
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .optional().default("GET").describe("HTTPメソッド"),
      headers: z.record(z.string()).optional()
        .describe("リクエストヘッダー"),
      body: z.any().optional().describe("リクエストボディ"),
      timeout: z.number().optional().default(30000)
        .describe("タイムアウト（ミリ秒）")
    }
  },
  async ({ url, method, headers, body, timeout }) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        signal: controller.signal
      };
      
      if (body && method !== "GET") {
        options.body = typeof body === "string" 
          ? body 
          : JSON.stringify(body);
      }
      
      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      
      const contentType = response.headers.get("content-type");
      let responseData;
      
      if (contentType?.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: responseData
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `HTTPリクエストエラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// GraphQLクエリツール
server.registerTool(
  "graphql-query",
  {
    title: "GraphQLクエリ",
    description: "GraphQLクエリを実行します",
    inputSchema: {
      endpoint: z.string().url().describe("GraphQLエンドポイント"),
      query: z.string().describe("GraphQLクエリ"),
      variables: z.record(z.any()).optional()
        .describe("クエリ変数"),
      headers: z.record(z.string()).optional()
        .describe("追加ヘッダー")
    }
  },
  async ({ endpoint, query, variables, headers }) => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers
        },
        body: JSON.stringify({
          query,
          variables
        })
      });
      
      const result = await response.json();
      
      if (result.errors) {
        return {
          content: [{
            type: "text",
            text: `GraphQLエラー:\n${JSON.stringify(result.errors, null, 2)}`
          }],
          isError: true
        };
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `GraphQLクエリエラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Webhookレシーバー情報リソース
server.registerResource(
  "webhook-config",
  "webhook://config",
  {
    title: "Webhook設定",
    description: "Webhook受信設定",
    mimeType: "application/json"
  },
  async (uri) => {
    const config = {
      endpoint: "http://localhost:3000/webhook",
      supportedEvents: [
        "user.created",
        "user.updated",
        "user.deleted",
        "order.created",
        "order.completed"
      ],
      headers: {
        "X-Webhook-Secret": "your-secret-key"
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      }
    };
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(config, null, 2)
      }]
    };
  }
);

// APIテストプロンプト
server.registerPrompt(
  "api-test-suite",
  {
    title: "APIテストスイート",
    description: "APIエンドポイントのテストスイートを生成",
    argsSchema: {
      baseUrl: z.string().url().describe("APIベースURL"),
      endpoints: z.array(z.object({
        path: z.string(),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        description: z.string()
      })).describe("テスト対象エンドポイント")
    }
  },
  ({ baseUrl, endpoints }) => {
    const tests = endpoints.map(ep => 
      `- ${ep.method} ${ep.path}: ${ep.description}`
    ).join("\n");
    
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `以下のAPIエンドポイントに対する包括的なテストスイートを作成してください:

ベースURL: ${baseUrl}

エンドポイント:
${tests}

各エンドポイントについて:
1. 正常系のテストケース
2. エラー処理のテストケース
3. エッジケースのテスト
4. パフォーマンステスト

テストはJavaScriptのJestフレームワークで実装してください。`
        }
      }]
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Web API MCP Server is running...");
}

main().catch(console.error);
```

## 4. データ変換・処理サーバー

データの変換や処理に特化したMCPサーバーの実装例です。

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as crypto from "crypto";

const server = new McpServer({
  name: "data-processor",
  version: "1.0.0"
});

// JSON変換ツール
server.registerTool(
  "json-transform",
  {
    title: "JSON変換",
    description: "JSONデータを変換・整形します",
    inputSchema: {
      data: z.any().describe("入力JSON"),
      operation: z.enum([
        "format",
        "minify",
        "flatten",
        "unflatten",
        "sort-keys"
      ]).describe("変換操作"),
      indent: z.number().optional().default(2)
        .describe("インデント幅（format時）")
    }
  },
  async ({ data, operation, indent }) => {
    try {
      let result;
      
      switch (operation) {
        case "format":
          result = JSON.stringify(data, null, indent);
          break;
          
        case "minify":
          result = JSON.stringify(data);
          break;
          
        case "flatten":
          result = flattenObject(data);
          break;
          
        case "unflatten":
          result = unflattenObject(data);
          break;
          
        case "sort-keys":
          result = JSON.stringify(sortKeys(data), null, indent);
          break;
      }
      
      return {
        content: [{
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `変換エラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// CSV変換ツール
server.registerTool(
  "csv-convert",
  {
    title: "CSV変換",
    description: "CSVとJSONを相互変換します",
    inputSchema: {
      data: z.string().describe("入力データ"),
      direction: z.enum(["csv-to-json", "json-to-csv"])
        .describe("変換方向"),
      delimiter: z.string().optional().default(",")
        .describe("区切り文字"),
      headers: z.boolean().optional().default(true)
        .describe("ヘッダー行の有無")
    }
  },
  async ({ data, direction, delimiter, headers }) => {
    try {
      let result;
      
      if (direction === "csv-to-json") {
        const lines = data.trim().split("\n");
        const headerRow = headers ? lines.shift()?.split(delimiter) : null;
        
        result = lines.map(line => {
          const values = line.split(delimiter);
          if (headerRow) {
            return headerRow.reduce((obj, key, index) => {
              obj[key] = values[index];
              return obj;
            }, {} as any);
          }
          return values;
        });
      } else {
        const jsonData = JSON.parse(data);
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          const headerRow = headers ? Object.keys(jsonData[0]) : null;
          const rows = jsonData.map(item => 
            headerRow 
              ? headerRow.map(key => String(item[key] ?? ""))
              : Object.values(item).map(v => String(v ?? ""))
          );
          
          if (headerRow && headers) {
            rows.unshift(headerRow);
          }
          
          result = rows.map(row => row.join(delimiter)).join("\n");
        } else {
          throw new Error("Invalid JSON array for CSV conversion");
        }
      }
      
      return {
        content: [{
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `変換エラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// 暗号化・ハッシュツール
server.registerTool(
  "crypto-operation",
  {
    title: "暗号化操作",
    description: "暗号化、復号化、ハッシュ化を行います",
    inputSchema: {
      data: z.string().describe("入力データ"),
      operation: z.enum([
        "md5",
        "sha256",
        "sha512",
        "base64-encode",
        "base64-decode",
        "aes-encrypt",
        "aes-decrypt"
      ]).describe("操作"),
      key: z.string().optional().describe("暗号化キー（AES時）")
    }
  },
  async ({ data, operation, key }) => {
    try {
      let result;
      
      switch (operation) {
        case "md5":
          result = crypto.createHash("md5").update(data).digest("hex");
          break;
          
        case "sha256":
          result = crypto.createHash("sha256").update(data).digest("hex");
          break;
          
        case "sha512":
          result = crypto.createHash("sha512").update(data).digest("hex");
          break;
          
        case "base64-encode":
          result = Buffer.from(data).toString("base64");
          break;
          
        case "base64-decode":
          result = Buffer.from(data, "base64").toString("utf8");
          break;
          
        case "aes-encrypt":
          if (!key) throw new Error("AES暗号化にはキーが必要です");
          const cipher = crypto.createCipher("aes-256-cbc", key);
          result = cipher.update(data, "utf8", "hex") + cipher.final("hex");
          break;
          
        case "aes-decrypt":
          if (!key) throw new Error("AES復号化にはキーが必要です");
          const decipher = crypto.createDecipher("aes-256-cbc", key);
          result = decipher.update(data, "hex", "utf8") + decipher.final("utf8");
          break;
      }
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `暗号化操作エラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// ヘルパー関数
function flattenObject(obj: any, prefix = ""): any {
  return Object.keys(obj).reduce((acc: any, key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], newKey));
    } else {
      acc[newKey] = obj[key];
    }
    return acc;
  }, {});
}

function unflattenObject(obj: any): any {
  const result: any = {};
  for (const key in obj) {
    const keys = key.split(".");
    let current = result;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = obj[key];
  }
  return result;
}

function sortKeys(obj: any): any {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  
  return Object.keys(obj).sort().reduce((result: any, key) => {
    result[key] = sortKeys(obj[key]);
    return result;
  }, {});
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Data Processor MCP Server is running...");
}

main().catch(console.error);
```

## 使用方法

### 1. サーバーの起動

```bash
# TypeScriptファイルを直接実行
npx tsx src/server.ts

# またはBunを使用
bun run src/server.ts

# ビルドして実行
npm run build
node dist/server.js
```

### 2. クライアントからの接続

Claude Desktopやその他のMCPクライアントから接続する場合は、以下の設定を使用します：

`claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/your/server/dist/index.js"]
    }
  }
}
```

### 3. デバッグ

デバッグ時は環境変数を設定して詳細なログを出力できます：

```bash
DEBUG=mcp:* node dist/server.js
```

## まとめ

これらの実装例は、MCP stdioサーバーの様々な使用ケースを示しています。各例は独立して動作し、必要に応じて組み合わせることができます。実際のプロジェクトでは、これらの例を参考に、特定の要件に合わせてカスタマイズしてください。