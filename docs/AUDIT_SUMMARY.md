# 監査サマリ（2025）

## 実施した修正

### 1. lib/db.ts
- **重複型の削除**: `GenerationBundle` が2回定義されていた問題を修正（2つ目を削除）
- **listProjects**: `ownerId` 引数を追加し、ログインユーザーIDでフィルタするよう変更
- **createOrUpdateProject**: `owner_id` オプションを追加。未指定時は `D2C_OWNER_ID` を使用
- **preview_image**: プロジェクト一覧に `preview_image: null` を付与（DashboardProjectsGrid が期待する型）

### 2. 認証 API（/api/auth/login, /api/auth/signup）
- **process.env 直接参照**: `lib/env` のフォールバックを避け、`process.env` を直接使用
- **環境変数チェック**: 未設定の場合は 503 と明確なエラーメッセージを返す

### 3.  diagn API（/api/auth/diag）
- 本番環境で環境変数が読まれているか確認する診断エンドポイント

---

## 環境変数（Vercel Production 必須）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名キー（20文字以上） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase サービスロールキー |
| `D2C_ENCRYPTION_KEY` | ユーザーシークレット暗号化（32文字以上） |
| `FIGMA_ACCESS_TOKEN` | （オプション）ダッシュボードのプレビュー画像取得 |

---

## ログインフロー

1. クライアント → `POST /api/auth/login`（email, password）
2. サーバー → Supabase Auth REST API を呼び出し
3. サーバー → トークンをクライアントに返却
4. クライアント → `supabase.auth.setSession()` でセッション設定

※ クライアントから Supabase へ直接 fetch しないため、CORS やネットワーク問題を回避

---

## プレビュー画像

- **DashboardProjectsGrid**: `preview_image` があれば表示。なければ `/api/figma-preview?fileKey=&nodeId=` を呼び出し
- **figma-preview**: `FIGMA_ACCESS_TOKEN` が設定されていれば Figma API から画像を取得。未設定時は 503

---

## デプロイ後確認

1. `https://your-app.vercel.app/api/auth/diag` → `ok: true` か確認
2. ログイン動作確認
3. プロジェクト一覧がログインユーザーIDでフィルタされているか確認
