# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 目的・方針

Figma URLからコードを生成・検証するWebアプリ。**最小差分・安全性優先**で作業する。

- 変更は目的に直結する箇所のみ
- まず「調査」→「方針/計画提示」→「ユーザーOK後に実装」
- 既存UI/レイアウト/DOM/CSS/デザインを、明示指示なく変更しない
- `.env*` やAPIキー等の秘密情報の値を出力しない
- 仕様や挙動を推測で断定しない（不明なら確認手順を提示する）

## コマンド

```bash
npm run dev        # 開発サーバー起動（localhost:3000）
npm run build      # 本番ビルド
npm run lint       # ESLint 実行
npm run start      # 本番サーバー起動（build後）
```

テストフレームワークは未設定。動作確認は `npm run build` でビルドが通ることを主な基準とする。

## アーキテクチャ概要

**Next.js 14 App Router + Supabase + Tailwind CSS**

### ページルーティング（`app/`）
| ルート | 役割 |
|--------|------|
| `/` | ルートページ（ランディング） |
| `/login` | Supabase Auth ログイン |
| `/dashboard` | プロジェクト一覧 |
| `/new` | 新規生成ウィザード（Figma URL入力） |
| `/result` | 生成結果表示（プレビュー・コード・レポート・マッピング） |

### APIルート（`app/api/`）
| パス | 役割 |
|------|------|
| `/api/generate` | 生成ジョブ作成・キュー投入 |
| `/api/generations/[id]` | 生成ステータスポーリング |
| `/api/figma` / `/api/figma-preview` | Figma APIプロキシ（レート制限対策） |
| `/api/figma-token` | ユーザーFigma PAT の保存・取得 |
| `/api/export-zip` | 生成ファイルのZIPダウンロード |
| `/api/cron` | 定期ジョブ（生成ワーカー実行） |
| `/api/previews` | Supabase Storage プレビュー画像取得 |
| `/api/projects` | プロジェクト一覧・削除 |
| `/api/profiles` | 生成プロファイル管理 |

### 生成パイプライン（`lib/`）
生成は **非同期ジョブ** として動く。`/api/generate` で `d2c_generations` にキュー投入 → `/api/cron` が `generationWorker.ts` を呼び出してワーカー実行。

ワーカーの分岐：
- **Figmaモード** (`runFigmaPipeline`): ユーザーのFigma PAT が設定済み かつ source_url が figma.com の場合。Figma API から画像取得し IR を構築。
- **モックモード** (`runMockPipeline`): PAT未設定 or 非Figma URL の場合。ダミーIRと固定コードを生成。

パイプラインの出力物（`saveGenerationArtifacts`でSupabaseに保存）：
- `d2c_files` — 生成されたファイル群（Next.jsプロジェクト一式）
- `d2c_mappings` — FigmaノードID → 生成コードのマッピング
- `d2c_generations.ir_json` / `report_json` — IR・レポートJSON

### データ層（`lib/db.ts`）
- Supabase Admin（Service Role）でDB操作
- Supabase未設定時は `getSupabaseAdmin()` が null を返し、関数が例外を投げる設計
- UIがその例外を握り、**デモモード**（保存なし、生成・ZIP・プレビューは動く）で継続

### Supabaseテーブル
`d2c_projects` / `d2c_generations` / `d2c_files` / `d2c_mappings` / `d2c_profiles`

※ `d2c_generations` が job テーブルを兼ねる（`locked_by`, `locked_at`, `attempt_count`, `next_attempt_at` カラム）

### 環境変数（`lib/env.ts`）
- `getServerEnvOrNull()` / `getServerEnv()` — サーバー専用。Client Component から呼ばない。
- `getPublicEnvOrNull()` — `NEXT_PUBLIC_*` のみ。未設定でもデモモードとして動くよう `safeParse` で許容。
- 必須変数: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `D2C_OWNER_ID`
- オプション: `D2C_ENCRYPTION_KEY`（ユーザーシークレット暗号化）, `FIGMA_ACCESS_TOKEN`（サーバー共有PAT）, `NEXT_PUBLIC_APP_URL`

### Figmaレート制限対策
`FigmaRateLimitError` を `lib/figma.ts` で定義。ワーカーがこれを捕捉した場合、ジョブを `waiting` ステータスにして `next_attempt_at` を設定し、次回 cron 実行まで待機する（`clampRetryAfterSec`で30〜600秒に制限）。

### コンポーネント構造（`components/`）
- `NewWizard.tsx` — Figma URL入力フォーム、生成フロー制御
- `ResultTabs.tsx` — 生成結果の4タブ（プレビュー/コード/レポート/マッピング）表示
- `GenerationWatcher.tsx` — ポーリングでステータス監視
- `DashboardClient.tsx` / `DashboardProjectsGrid.tsx` — ダッシュボード一覧
- `components/ui/` — 汎用UIコンポーネント（Button, Card, Tabs, CodeBlock, FileTree）

### 認証（`lib/supabase/`）
Supabase SSR + middleware.ts でセッション管理。`lib/authApi.ts`（サーバー）と `lib/authClient.ts`（クライアント）に分離。
