#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { authenticate } from "./src/auth.js";
import { foursquareAPI } from "./src/api.js";
import { tokenManager } from "./src/token.js";
import { getConfigDir } from "./src/config.js";

// CLIサブコマンドの処理
async function handleCLI() {
  const args = process.argv.slice(2);

  if (args[0] === 'invoke') {
    const toolName = args[1];

    if (toolName === 'get-user-checkins') {
      try {
        // オプションをパース
        const options: any = {
          limit: 50,
          sort: 'newestfirst'
        };

        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--limit' && args[i + 1]) {
            options.limit = parseInt(args[i + 1], 10);
            i++;
          } else if (args[i] === '--after' && args[i + 1]) {
            options.afterTimestamp = parseInt(args[i + 1], 10);
            i++;
          } else if (args[i] === '--sort' && args[i + 1]) {
            options.sort = args[i + 1];
            i++;
          } else if (args[i] === '--json') {
            options.json = true;
          }
        }

        // チェックインを取得
        const checkins = await foursquareAPI.getUserCheckins(options);

        if (options.json) {
          // JSON出力
          console.log(JSON.stringify(checkins, null, 2));
        } else {
          // フォーマット済み出力
          if (checkins.length === 0) {
            console.log("チェックインが見つかりませんでした。");
          } else {
            console.log(`🎯 ${checkins.length}件のチェックインを取得しました\n`);
            checkins.forEach((checkin, index) => {
              console.log(`--- チェックイン #${index + 1} ---`);
              console.log(foursquareAPI.formatCheckin(checkin));
              console.log('');
            });
          }
        }

        process.exit(0);
      } catch (error: any) {
        console.error(`❌ エラー: ${error.message}`);
        console.error('\n認証が必要な場合は、MCPサーバーとして起動してauthenticateツールを使用するか、');
        console.error('環境変数 FOURSQUARE_ACCESS_TOKEN を設定してください。');
        process.exit(1);
      }
    } else if (toolName === 'authenticate') {
      try {
        // オプションをパース
        let clientId: string | undefined;
        let clientSecret: string | undefined;

        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--client-id' && args[i + 1]) {
            clientId = args[i + 1];
            i++;
          } else if (args[i] === '--client-secret' && args[i + 1]) {
            clientSecret = args[i + 1];
            i++;
          }
        }

        // 認証を実行
        const tokenInfo = await authenticate(clientId, clientSecret);
        const configDir = getConfigDir();

        console.log('✅ 認証成功！');
        console.log(`\nアクセストークンが以下の場所に保存されました：`);
        console.log(`${configDir}/token.json`);
        console.log('\nこれで「invoke get-user-checkins」コマンドが使用可能になりました。');

        process.exit(0);
      } catch (error: any) {
        console.error(`❌ 認証エラー: ${error.message}`);
        console.error('\n環境変数にFOURSQUARE_CLIENT_IDとFOURSQUARE_CLIENT_SECRETを設定するか、');
        console.error('以下のオプションで指定してください：');
        console.error('  --client-id <CLIENT_ID>');
        console.error('  --client-secret <CLIENT_SECRET>');
        process.exit(1);
      }
    } else if (toolName === 'check-auth-status') {
      try {
        const hasToken = await tokenManager.hasToken();

        if (!hasToken) {
          console.log('❌ トークンが見つかりません');
          console.log('\n「invoke authenticate」コマンドを実行して認証を行ってください。');
          process.exit(1);
        }

        const isValid = await foursquareAPI.checkAuth();

        if (isValid) {
          const configDir = getConfigDir();
          const isEnvToken = !!process.env.FOURSQUARE_ACCESS_TOKEN;

          if (isEnvToken) {
            console.log('✅ 認証済み');
            console.log('\nトークンは有効です。');
            console.log('取得元: 環境変数 FOURSQUARE_ACCESS_TOKEN');
          } else {
            console.log('✅ 認証済み');
            console.log('\nトークンは有効です。');
            console.log(`保存場所: ${configDir}/token.json`);
          }
        } else {
          console.log('⚠️ トークンが無効です');
          console.log('\n「invoke authenticate」コマンドを実行して再認証してください。');
          process.exit(1);
        }

        process.exit(0);
      } catch (error: any) {
        console.error(`❌ エラー: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.error(`❌ 不明なツール: ${toolName}`);
      console.error('\n使用可能なツール:');
      console.error('  authenticate        - Foursquare認証');
      console.error('  check-auth-status   - 認証状態を確認');
      console.error('  get-user-checkins   - チェックインを取得');
      console.error('\nget-user-checkinsのオプション:');
      console.error('  --limit <数値>      - 取得件数（デフォルト: 50）');
      console.error('  --after <timestamp> - このUnixタイムスタンプ以降のチェックイン');
      console.error('  --sort <順序>       - newestfirst または oldestfirst');
      console.error('  --json              - JSON形式で出力');
      console.error('\nauthenticateのオプション:');
      console.error('  --client-id <ID>    - Foursquare CLIENT_ID');
      console.error('  --client-secret <SECRET> - Foursquare CLIENT_SECRET');
      process.exit(1);
    }
  }

  // invoke以外のコマンドがある場合、MCPサーバーとして起動
  return false;
}

// MCPサーバーインスタンスを作成
const server = new McpServer({
  name: "foursquare-mcp",
  version: "0.1.0",
  description: "MCP server for Foursquare API integration with OAuth authentication"
});

// 認証ツール
server.registerTool(
  "authenticate",
  {
    title: "Foursquare認証",
    description: "ブラウザでFoursquareにログインしてアクセストークンを取得します",
    inputSchema: {
      clientId: z.string().optional().describe("Foursquare CLIENT_ID（環境変数から読み込み可）"),
      clientSecret: z.string().optional().describe("Foursquare CLIENT_SECRET（環境変数から読み込み可）")
    }
  },
  async ({ clientId, clientSecret }) => {
    try {
      const tokenInfo = await authenticate(clientId, clientSecret);
      const configDir = getConfigDir();
      
      return {
        content: [{
          type: "text",
          text: `✅ 認証成功！\n\nアクセストークンが以下の場所に保存されました：\n${configDir}/token.json\n\nこれで「get-user-checkins」ツールが使用可能になりました。`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ 認証エラー\n\n${error.message}\n\n環境変数にFOURSQUARE_CLIENT_IDとFOURSQUARE_CLIENT_SECRETを設定するか、パラメータで指定してください。`
        }],
        isError: true
      };
    }
  }
);

// 認証状態確認ツール
server.registerTool(
  "check-auth-status",
  {
    title: "認証状態を確認",
    description: "保存されたトークンの有効性を確認します",
    inputSchema: {}
  },
  async () => {
    try {
      const hasToken = await tokenManager.hasToken();
      
      if (!hasToken) {
        return {
          content: [{
            type: "text",
            text: "❌ トークンが見つかりません\n\n「authenticate」ツールを実行して認証を行ってください。"
          }]
        };
      }

      const isValid = await foursquareAPI.checkAuth();
      
      if (isValid) {
        const configDir = getConfigDir();
        const isEnvToken = !!process.env.FOURSQUARE_ACCESS_TOKEN;
        
        const message = isEnvToken 
          ? "✅ 認証済み\n\nトークンは有効です。\n取得元: 環境変数 FOURSQUARE_ACCESS_TOKEN"
          : `✅ 認証済み\n\nトークンは有効です。\n保存場所: ${configDir}/token.json`;
        
        return {
          content: [{
            type: "text",
            text: message
          }]
        };
      } else {
        return {
          content: [{
            type: "text",
            text: "⚠️ トークンが無効です\n\n「authenticate」ツールを実行して再認証してください。"
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ エラー: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// チェックイン取得ツール
server.registerTool(
  "get-user-checkins",
  {
    title: "最新チェックインを取得",
    description: "認証済みユーザーの最新チェックイン履歴を取得します",
    inputSchema: {
      limit: z.number().optional().default(50).describe("取得件数（最大100）"),
      afterTimestamp: z.number().optional().describe("このUnixタイムスタンプ以降のチェックインのみ取得"),
      sort: z.enum(["newestfirst", "oldestfirst"]).optional().default("newestfirst").describe("ソート順")
    }
  },
  async ({ limit, afterTimestamp, sort }) => {
    try {
      const checkins = await foursquareAPI.getUserCheckins({
        limit,
        afterTimestamp,
        sort
      });

      if (checkins.length === 0) {
        return {
          content: [{
            type: "text",
            text: "チェックインが見つかりませんでした。"
          }]
        };
      }

      const formattedCheckins = checkins.map((checkin, index) => {
        const formatted = foursquareAPI.formatCheckin(checkin);
        return `--- チェックイン #${index + 1} ---\n${formatted}`;
      });

      const summary = `🎯 ${checkins.length}件のチェックインを取得しました\n\n`;
      const result = summary + formattedCheckins.join('\n\n');

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
          text: `❌ エラー: ${error.message}\n\n「authenticate」ツールで認証を行ってください。`
        }],
        isError: true
      };
    }
  }
);

// サーバー起動
async function main() {
  // CLIコマンドの処理を試行
  const isCLI = await handleCLI();
  if (isCLI !== false) {
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // デバッグ情報はstderrに出力
  console.error("🚀 Foursquare MCP Server is running...");
  console.error("📍 Available tools: authenticate, check-auth-status, get-user-checkins");
}

// エラーハンドリング
main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});