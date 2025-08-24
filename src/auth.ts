import express from 'express';
import open from 'open';
import fetch from 'node-fetch';
import { OAUTH_CONFIG, API_CONFIG, getEnvConfig } from './config.js';
import { tokenManager, type TokenInfo } from './token.js';

/**
 * OAuth認証を実行
 */
export async function authenticate(
  clientId?: string,
  clientSecret?: string
): Promise<TokenInfo> {
  const config = getEnvConfig();
  const finalClientId = clientId || config.clientId;
  const finalClientSecret = clientSecret || config.clientSecret;

  if (!finalClientId || !finalClientSecret) {
    throw new Error(
      'CLIENT_IDとCLIENT_SECRETが必要です。環境変数またはパラメータで指定してください。'
    );
  }

  return new Promise((resolve, reject) => {
    const app = express();
    let server: any;
    
    // コールバックエンドポイント
    app.get(OAUTH_CONFIG.CALLBACK_PATH, async (req, res) => {
      const code = req.query.code as string;
      const error = req.query.error as string;

      if (error) {
        res.send(`
          <html>
            <head>
              <title>認証エラー</title>
              <style>
                body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
                .error { color: #d32f2f; }
              </style>
            </head>
            <body>
              <h1 class="error">認証エラー</h1>
              <p>Foursquare認証でエラーが発生しました: ${error}</p>
              <p>このウィンドウを閉じて、再度お試しください。</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(`認証エラー: ${error}`));
        return;
      }

      if (!code) {
        res.send(`
          <html>
            <head>
              <title>認証エラー</title>
              <style>
                body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
                .error { color: #d32f2f; }
              </style>
            </head>
            <body>
              <h1 class="error">認証エラー</h1>
              <p>認証コードが見つかりません。</p>
              <p>このウィンドウを閉じて、再度お試しください。</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error('認証コードが見つかりません'));
        return;
      }

      try {
        // アクセストークンと交換
        const tokenResponse = await fetch(API_CONFIG.TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: finalClientId,
            client_secret: finalClientSecret,
            grant_type: 'authorization_code',
            redirect_uri: OAUTH_CONFIG.REDIRECT_URI,
            code: code,
          }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (tokenData.error) {
          throw new Error(`トークン取得エラー: ${tokenData.error}`);
        }

        if (!tokenData.access_token) {
          throw new Error('アクセストークンが取得できませんでした');
        }

        // トークン情報を作成
        const tokenInfo: TokenInfo = {
          access_token: tokenData.access_token,
          created_at: Date.now(),
        };

        // トークンを保存
        await tokenManager.saveToken(tokenInfo);

        res.send(`
          <html>
            <head>
              <title>認証成功</title>
              <style>
                body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
                .success { color: #388e3c; }
                .token { background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all; }
              </style>
            </head>
            <body>
              <h1 class="success">✅ 認証成功！</h1>
              <p>Foursquareの認証が完了しました。</p>
              <p>トークンは安全に保存されました。</p>
              <p>このウィンドウを閉じて、MCPツールをご利用ください。</p>
            </body>
          </html>
        `);

        // サーバーを閉じる
        setTimeout(() => {
          server.close();
        }, 1000);

        resolve(tokenInfo);
      } catch (error: any) {
        res.send(`
          <html>
            <head>
              <title>エラー</title>
              <style>
                body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
                .error { color: #d32f2f; }
              </style>
            </head>
            <body>
              <h1 class="error">エラー</h1>
              <p>${error.message}</p>
              <p>このウィンドウを閉じて、再度お試しください。</p>
            </body>
          </html>
        `);
        server.close();
        reject(error);
      }
    });

    // ルートページ（リダイレクト用）
    app.get('/', (_req, res) => {
      res.send(`
        <html>
          <head>
            <title>Foursquare認証</title>
            <style>
              body { font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <h1>Foursquare認証サーバー</h1>
            <p>認証待機中...</p>
          </body>
        </html>
      `);
    });

    // サーバー起動
    server = app.listen(OAUTH_CONFIG.PORT, async () => {
      console.error(`認証サーバーを起動しました: http://localhost:${OAUTH_CONFIG.PORT}`);
      
      // 認証URLを構築
      const authUrl = new URL(API_CONFIG.AUTH_URL);
      authUrl.searchParams.append('client_id', finalClientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.REDIRECT_URI);

      console.error(`ブラウザで認証ページを開いています...`);
      console.error(`URL: ${authUrl.toString()}`);
      
      // ブラウザを開く
      try {
        await open(authUrl.toString());
      } catch (error: any) {
        console.error('ブラウザを自動的に開けませんでした。以下のURLを手動で開いてください:');
        console.error(authUrl.toString());
      }
    });

    // エラーハンドリング
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`ポート${OAUTH_CONFIG.PORT}は既に使用中です。別のプロセスを終了してから再度お試しください。`));
      } else {
        reject(error);
      }
    });

    // タイムアウト設定（5分）
    setTimeout(() => {
      server.close();
      reject(new Error('認証タイムアウト: 5分以内に認証を完了してください'));
    }, 5 * 60 * 1000);
  });
}