# Design2Code Studio — コードベース全体把握

## 1. プロジェクト概要

- **目的**: Figma URL からコードを生成し、プレビュー・コード確認・ZIP 出力まで行う MVP。
- **技術**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase。
- **状態**: モックパイプライン実装済み。Figma プレビュー画像取得・Storage 保存・デモモード対応あり。

---

## 2. ディレクトリ・ファイル構成

### 2.1 ページ（app/）

| パス | 役割 |
|------|------|
| `app/layout.tsx` | ルートレイアウト。`AppHeader` を表示。 |
| `app/page.tsx` | **TOP**。取扱説明・使い方（生成→結果→ZIP）。ダッシュボードは別ページ。 |
| `app/new/page.tsx` | **新規作成**。`NewWizard` に `projectId`・`sourceUrl`（クエリ）を渡す。 |
| `app/dashboard/page.tsx` | **ダッシュボード**。`listProjects()` で保存済みプロジェクト一覧。再生成リンクに `sourceUrl` を付与。 |
| `app/result/page.tsx` | **デモ結果**（Client）。`sessionStorage` の `d2c_demo_bundle` を表示。ZIP ボタンは未実装。 |
| `app/projects/[projectId]/generations/[generationId]/page.tsx` | **保存済み生成結果**。`getGenerationBundle` で表示。Export ZIP・Regenerate あり。 |
| `app/new/ui.tsx` | 別UI「NewClient」。`projectId`・`initialSourceUrl`・`projectName` と **figmaToken** 入力あり。現状 `new/page.tsx` からは未使用。 |

### 2.2 API ルート（app/api/）

| パス | メソッド | 役割 |
|------|----------|------|
| `api/generate/route.ts` | POST | メイン生成。Figma URL 解析、project/generation 作成、モックパイプライン、Figma プレビュー取得→Storage 保存、デモモード時は bundle 返却。 |
| `api/export-zip/route.ts` | POST | リクエスト body の `files` から ZIP を生成して返す（デモ用等）。 |
| `api/generate/generations/[generationId]/route.ts` | GET | 指定 generation の bundle を JSON で返す。 |
| `api/generate/generations/[generationId]/export/route.ts` | GET | **保存済み** generation のファイルを ZIP でダウンロード。※テーブル名に注意（後述）。 |
| `api/generate/generations/[generationId]/regenerate/route.ts` | POST | 再生成して新 generation を作成し、結果ページへリダイレクト。 |
| `api/figma/preview/route.ts` | POST | Figma Preview Proxy。body で fileKey/nodeId/token を受け、Figma Images API で画像取得しバイナリで返す。 |
| `api/previews/[projectId]/[snapshotHash]/route.ts` | GET | Supabase Storage `d2c-previews` の `${projectId}/${snapshotHash}.png` を返す。 |

### 2.3 ライブラリ（lib/）

| ファイル | 役割 |
|----------|------|
| `lib/env.ts` | 環境変数。`env`（public: NEXT_PUBLIC_SUPABASE_URL）、`getServerEnv()`（SUPABASE_SERVICE_ROLE_KEY, D2C_OWNER_ID）。 |
| `lib/supabaseAdmin.ts` | Supabase 管理者クライアント（サーバー専用）。 |
| `lib/db.ts` | 型定義（ProjectRow, GenerationRow, FileRow, MappingRow, GenerationBundle）と、d2c_* テーブル用 CRUD。`getProject`, `listProjects`, `createOrUpdateProject`, `createGeneration`, `setGenerationStatus`, `saveGenerationArtifacts`, `getGenerationBundle`。 |
| `lib/mockPipeline.ts` | モックパイプライン。IR・report・files・mappings を生成。 |
| `lib/demoBundle.ts` | デモ用 bundle を `getGenerationBundle` と同じ形で組み立て。 |
| `lib/zip.ts` | `buildZipFromFiles`。archiver を require で取得し、Buffer で ZIP 生成。 |
| `lib/server/capturePreview.ts` | Playwright でページを開き PNG Buffer を返す（現状の API からは未使用の可能性あり）。 |

### 2.4 コンポーネント（components/）

| コンポーネント | 役割 |
|----------------|------|
| `AppHeader` | ヘッダー。TOP / 新規作成 / ダッシュボード リンク。 |
| `NewWizard` | 新規作成フォーム。Figma URL・プリセット。**figmaToken は送っていない**。`sourceUrl` は state のみで、props で初期化していない。 |
| `ResultTabs` | プレビュー（`/api/previews/...` の img）・コード・レポート・マッピングのタブ。 |
| `EmptyState` | 空状態用カード。 |
| `ui/Button`, `ui/Card`, `ui/CodeBlock`, `ui/FileTree`, `ui/Tabs` | 共通 UI。 |

### 2.5 スタイル・設定

- `app/globals.css`: テーマ変数（`--bg`, `--surface`, `--accent`, `--primary` 等）、ユーティリティ。
- `tailwind.config.ts`: content パス、カスタム色等。
- `next.config.mjs`: reactStrictMode、eslint/typescript のビルド時無効化。
- `tsconfig.json`: paths で `@/app`, `@/components`, `@/lib`。

---

## 3. データフロー（要約）

1. **新規生成**
   - ユーザーが `/new` で URL 入力 → `POST /api/generate`（sourceUrl, projectId, 任意 figmaToken）。
   - 成功時: DB に project/generation 作成 → モックパイプライン → artifacts 保存 → Figma トークンがあればプレビュー取得→Storage 保存。`saved: true` で `projectId`/`generationId` 返却 → `/projects/.../generations/...` へ遷移。
   - 失敗時（DB 不可）: デモモード。bundle を返却 → クライアントが `sessionStorage` に保存 → `/result` へ遷移。

2. **保存済み結果**
   - `/dashboard` で一覧 → 「開く」で `/projects/[projectId]/generations/[generationId]`。
   - プレビューは `report_json.preview_storage` の path を元に `/api/previews/[projectId]/[snapshotHash]` で表示。

3. **ZIP**
   - デモ: `/result` では ZIP ボタンがコード上ない（ResultTabs 側に Export ZIP がない）。
   - 保存済み: 結果ページの「Export ZIP」→ `GET /api/generate/generations/[id]/export`。

---

## 4. 注意点・不整合（把握した範囲）

### 4.1 Export ZIP のテーブル名

- `app/api/generate/generations/[generationId]/export/route.ts` は、generation/project/files 取得に **`generations` / `projects` / `files`** などテーブル名の候補をループしている。
- 実際の DB は **`d2c_generations`**, **`d2c_projects`**, **`d2c_files`** を使用している。
- そのため、現状の候補だけではヒットせず、**保存済み generation の ZIP エクスポートが失敗する**可能性が高い。  
  → 候補に `d2c_generations`, `d2c_projects`, `d2c_files` を入れるか、ここだけ d2c_* に固定する必要あり。

### 4.2 NewWizard と sourceUrl

- `app/new/page.tsx` は `searchParams.sourceUrl` を `NewWizard` に渡しているが、`NewWizard` の props は `projectId` のみで **`sourceUrl` を受け取っていない**。
- そのため、ダッシュボードから「再生成」で `sourceUrl` 付きリンクで開いても、入力欄は空のまま。  
  → 初期値として `sourceUrl` を props で受け取り `useState(sourceUrl ?? "")` するよう変更するとよい。

### 4.3 NewClient（ui.tsx）の利用有無

- `app/new/ui.tsx` の `NewClient` は figmaToken 入力と `initialSourceUrl` に対応しているが、`new/page.tsx` では **NewWizard のみ使用**。
- トークン入力や再生成時の URL 初期値を使う場合は、ここを NewWizard に統合するか、page で NewClient に切り替える必要あり。

### 4.4 デモ結果ページの ZIP

- `/result`（デモモード）では、ResultTabs に「Export ZIP」ボタンがなく、`sessionStorage` の bundle を ZIP にするクライアント処理も見当たらない。  
  → デモでも ZIP を出したい場合は、`/api/export-zip` に bundle.files を POST するボタンを ResultTabs か result/page に追加する必要あり。

---

## 5. Supabase 関連

- **テーブル**: `d2c_projects`, `d2c_generations`, `d2c_files`, `d2c_mappings`, `d2c_profiles`。
- **Storage**: バケット `d2c-previews`。キー `${projectId}/${snapshotHash}.png`。
- **環境変数**: `.env` / `.env.local` に `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `D2C_OWNER_ID` が必要。未設定・接続失敗時はデモモードで動作。

---

## 6. まとめ

- ルート・ダッシュボード・新規作成・結果（デモ／保存済み）の流れと、Figma プレビュー・Storage・デモモードまで一通り実装されている。
- 上記のとおり、**Export ZIP のテーブル名**・**NewWizard の sourceUrl 初期値**・**デモ結果の ZIP 導線**・**NewClient の利用方針** を揃えると、動作と UX がより一貫します。
