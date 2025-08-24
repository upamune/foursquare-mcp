#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { authenticate } from "./src/auth.js";
import { foursquareAPI } from "./src/api.js";
import { tokenManager } from "./src/token.js";
import { getConfigDir } from "./src/config.js";

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