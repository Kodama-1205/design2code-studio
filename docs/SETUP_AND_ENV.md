# セットアップと環境変数

## 必須の環境変数（Vercel / 本番）

| 変数 | 説明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー（クライアント用） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー（サーバー用） |
| `D2C_OWNER_ID` | デモ用オーナー UUID（未設定時は `00000000-0000-0000-0000-000000000000`） |
| `D2C_ENCRYPTION_KEY` | 暗号化キー（32文字以上、ユーザーシークレット用） |

## 画像プレビュー用（オプション）

| 変数 | 説明 |
|------|------|
| `FIGMA_ACCESS_TOKEN` | Figma Personal Access Token。ダッシュボードのプレビュー画像取得に使用 |

---

## 前提チェック（ここがズレると永遠にハマる）

### 1) Auth Providers がアプリと一致しているか

**このアプリはメール/パスワード認証です。**

- Supabase → **Auth** → **Providers** → **Email** を有効にする
- Google/GitHub でログインする設計なら、それぞれ Providers を有効化し Client ID/Secret を設定

### 2) Redirect URLs が正しいか（超重要）

Supabase → **Auth** → **URL Configuration**

- **Site URL**: Vercel の本番 URL（例: `https://xxxx.vercel.app`）
- **Redirect URLs**: 本番 URL + 必要なパス（例: `https://xxxx.vercel.app/**`）

メール認証リンクや OAuth でこの設定がズレていると失敗します。

### 3) Vercel 環境変数が入っているか

Production に以下が入っているか確認：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`（サーバー管理系が必要な場合）

---

## 機能と env の関係

- **保存**: Supabase が正しく接続されていれば有効。無料プラン制限で失敗する場合はデモモード（保存なし）で稼働。
- **ログイン**: Supabase Auth を使用。`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しく設定されている必要あり。
- **画像プレビュー**: `FIGMA_ACCESS_TOKEN` が設定されていれば、Figma API 経由でプレビュー画像を取得。未設定の場合はプレースホルダー表示。

## ローカル開発

```bash
cp .env.example .env
# .env を編集して上記の値を設定
npm run dev
```
