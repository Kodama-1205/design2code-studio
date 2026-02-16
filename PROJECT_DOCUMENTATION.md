# Design2Code Studio - プロジェクト引き継ぎドキュメント

## プロジェクト概要

Design2Code Studio は、Figma などのデザインデータから HTML/CSS/JavaScript などのコードを自動生成する Web アプリケーションです。現在は MVP（Minimum Viable Product）の骨組み段階で、モックパイプラインによるコード生成、プレビュー、ZIP 出力、データベース保存機能を提供しています。

### 主な機能

- **コード生成**: Figma URL を入力してコードを生成（現状はモックパイプライン）
- **プロジェクト管理**: Supabase を使用したプロジェクト・生成結果の保存
- **結果表示**: プレビュー・コード・レポート・マッピングの確認
- **ZIP エクスポート**: 生成ファイル一式のダウンロード
- **再生成**: 同じソースから再生成（保存が有効な場合）
- **デモモード**: Supabase が使えない場合も生成・プレビュー・ZIP は利用可能

---

## 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **React 18.3.1**
- **TypeScript 5.5.4**
- **Tailwind CSS 3.4.10**

### バックエンド・インフラ
- **Supabase** (PostgreSQL データベース、認証・管理)
- **Next.js API Routes** (サーバーサイド API)

### 主要ライブラリ
- `@supabase/supabase-js`: Supabase クライアント
- `archiver`: ZIP ファイル生成
- `zod`: バリデーション
- `clsx`, `tailwind-merge`: スタイリングユーティリティ

### 開発ツール
- **ESLint**: コード品質チェック
- **PostCSS**: CSS 処理
- **Autoprefixer**: CSS ベンダープレフィックス自動付与

---

## プロジェクト構造

```
design2code-studio/
├── app/                          # Next.js App Router ディレクトリ
│   ├── api/                      # API ルート
│   │   ├── export-zip/           # ZIP エクスポート API
│   │   │   └── route.ts
│   │   └── generate/             # コード生成 API
│   │       ├── route.ts          # メイン生成エンドポイント
│   │       └── generations/
│   │           └── [generationId]/
│   │               ├── export/   # 保存済み生成結果の ZIP エクスポート
│   │               ├── regenerate/ # 再生成
│   │               └── route.ts
│   ├── globals.css               # グローバルスタイル
│   ├── layout.tsx                # ルートレイアウト
│   ├── page.tsx                  # トップページ（プロジェクト一覧）
│   ├── new/                      # 新規生成ページ
│   │   └── page.tsx
│   ├── result/                   # デモモード結果表示ページ
│   │   └── page.tsx
│   └── projects/                 # プロジェクト詳細ページ
│       └── [projectId]/
│           └── generations/
│               └── [generationId]/
│                   └── page.tsx
│
├── components/                   # React コンポーネント
│   ├── ui/                       # UI プリミティブコンポーネント
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── FileTree.tsx
│   │   └── Tabs.tsx
│   ├── AppShell.tsx              # アプリケーションシェル（ヘッダー・フッター）
│   ├── EmptyState.tsx            # 空状態表示コンポーネント
│   ├── NewWizard.tsx             # 新規生成ウィザード
│   └── ResultTabs.tsx            # 結果表示タブコンポーネント
│
├── lib/                          # ユーティリティ・ライブラリ
│   ├── db.ts                     # データベース操作（Supabase）
│   ├── demoBundle.ts             # デモモード用バンドル構築
│   ├── env.ts                    # 環境変数バリデーション
│   ├── mockPipeline.ts           # モック生成パイプライン
│   ├── supabaseAdmin.ts          # Supabase 管理者クライアント
│   └── zip.ts                    # ZIP ファイル生成
│
├── .env.example                  # 環境変数テンプレート
├── .eslintrc.json                # ESLint 設定
├── .gitignore                    # Git 除外設定
├── .nvmrc                        # Node.js バージョン指定
├── next.config.mjs               # Next.js 設定
├── package.json                  # 依存関係・スクリプト
├── postcss.config.mjs            # PostCSS 設定
├── tailwind.config.ts            # Tailwind CSS 設定
├── tsconfig.json                 # TypeScript 設定
└── README.md                     # プロジェクト説明書
```

---

## 主要ファイルの詳細説明

### 1. アプリケーションエントリーポイント

#### `app/layout.tsx`
- ルートレイアウトコンポーネント
- `AppShell` でヘッダー・フッターを提供
- メタデータ（タイトル・説明）を定義

#### `app/page.tsx`
- トップページ（プロジェクト一覧）
- `listProjects()` で Supabase からプロジェクトを取得
- 保存機能が無効な場合の警告表示
- プロジェクトカード表示と「New Generation」ボタン

#### `app/new/page.tsx`
- 新規生成ページ
- `NewWizard` コンポーネントを使用

### 2. API ルート

#### `app/api/generate/route.ts`
**メインのコード生成エンドポイント**

**処理フロー:**
1. リクエストボディから `sourceUrl`, `profileId`, `projectId` を取得・バリデーション
2. Figma URL から `figmaFileKey` と `figmaNodeId` を抽出
3. プロジェクト作成/更新（`createOrUpdateProject`）
4. 生成レコード作成（`createGeneration`）
5. モックパイプライン実行（`runMockPipeline`）
6. 生成結果を Supabase に保存（`saveGenerationArtifacts`）
7. エラー時はデモモードでバンドルを返す

**レスポンス:**
- 成功時: `{ saved: true, projectId, generationId }`
- デモモード時: `{ saved: false, bundle }`

#### `app/api/export-zip/route.ts`
**ZIP エクスポート API（POST）**

- リクエストボディから `files` 配列を受け取り
- `buildZipFromFiles()` で ZIP を生成
- `application/zip` として返却

#### `app/api/generate/generations/[generationId]/export/route.ts`
**保存済み生成結果の ZIP エクスポート（GET）**

- `generationId` から Supabase でファイルを取得
- ZIP 化してダウンロード

#### `app/api/generate/generations/[generationId]/regenerate/route.ts`
**再生成 API（POST）**

- 既存の生成結果を取得
- 同じプロジェクト・プロファイルで再生成
- 新しい `generationId` で保存
- 結果ページへリダイレクト

### 3. データベース操作 (`lib/db.ts`)

#### データ型定義

```typescript
// プロジェクト
type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  figma_file_key: string;
  figma_node_id: string;
  source_url: string;
  default_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

// 生成結果
type GenerationRow = {
  id: string;
  project_id: string;
  profile_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  figma_snapshot_hash: string | null;
  ir_json: any | null;
  report_json: any | null;
  error_json: any | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

// 生成ファイル
type FileRow = {
  id: string;
  generation_id: string;
  path: string;
  content: string;
  content_sha256: string;
  kind: "code" | "config" | "style" | "asset_index";
  created_at: string;
};

// マッピング（Figma ノード ↔ 生成コード）
type MappingRow = {
  id: string;
  generation_id: string;
  figma_node_id: string;
  figma_node_name: string | null;
  target_path: string;
  target_symbol: string | null;
  loc_start: number | null;
  loc_end: number | null;
  mapping_type: "component" | "element" | "style_token" | "asset";
  created_at: string;
};
```

#### 主要関数

- `listProjects()`: プロジェクト一覧取得（最後の生成 ID 付き）
- `createOrUpdateProject()`: プロジェクト作成/更新
- `createGeneration()`: 生成レコード作成
- `setGenerationStatus()`: 生成ステータス更新
- `saveGenerationArtifacts()`: 生成結果一式を保存
- `getGenerationBundle()`: 生成結果バンドル取得

### 4. モックパイプライン (`lib/mockPipeline.ts`)

**`runMockPipeline()` 関数**

現時点では実際の Figma API 呼び出しは行わず、モックデータを生成します。

**処理内容:**
1. スナップショットハッシュ生成（`figmaFileKey`, `figmaNodeId`, `sourceUrl` から）
2. IR（Intermediate Representation）生成
   - デザイントークン（色・スペーシング・タイポグラフィなど）
   - ページ構造（コンテナ・テキスト要素など）
   - メタデータ（プロファイル情報）
3. レポート生成（品質指標のサマリー）
4. 生成ファイル構築（`buildMockGeneratedProject()`）
   - `README.md`
   - `package.json`
   - `next.config.mjs`
   - `app/layout.tsx`
   - `app/page.tsx`
   - `app/globals.css`
   - `ir.json`
5. マッピング生成（Figma ノード ID ↔ 生成ファイルの対応）

**将来の拡張:**
- 実際の Figma API 呼び出し
- デザインデータの正規化
- コンポーネント抽出
- コード生成エンジン
- 品質チェック（Prettier, ESLint, a11y）

### 5. ZIP 生成 (`lib/zip.ts`)

**`buildZipFromFiles()` 関数**

- `archiver` ライブラリを使用
- メモリ上で ZIP を生成（`PassThrough` ストリーム）
- 圧縮レベル 9（最大圧縮）
- `Buffer` として返却

### 6. 環境変数管理 (`lib/env.ts`)

**Zod スキーマによるバリデーション:**

```typescript
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  D2C_OWNER_ID: z.string().uuid()
});
```

**必要な環境変数:**
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase プロジェクト URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase サービスロールキー（管理者権限）
- `D2C_OWNER_ID`: デモ用オーナー ID（UUID）
- `NEXT_PUBLIC_APP_URL`: 本番環境のアプリ URL（Regenerate 後のリダイレクト用）

### 7. Supabase クライアント (`lib/supabaseAdmin.ts`)

- サービスロールキーを使用した管理者クライアント
- セッション永続化なし（サーバーサイド専用）

### 8. コンポーネント

#### `components/AppShell.tsx`
- アプリケーション全体のレイアウト
- ヘッダー（ロゴ・ナビゲーション）
- フッター

#### `components/NewWizard.tsx`
- 新規生成ウィザード（クライアントコンポーネント）
- Figma URL 入力
- プリセット選択（Production/Lecture/Pixel モード）
- 生成実行とエラーハンドリング

#### `components/ResultTabs.tsx`
- 結果表示タブコンポーネント
- 4つのタブ: Preview, Code, Report, Mapping
- ファイルツリーとコード表示
- レポート・マッピング表示

#### UI コンポーネント (`components/ui/`)
- `Button.tsx`: ボタンコンポーネント（primary/secondary/ghost バリアント）
- `Card.tsx`: カードコンポーネント
- `CodeBlock.tsx`: コード表示コンポーネント
- `FileTree.tsx`: ファイルツリー表示コンポーネント
- `Tabs.tsx`: タブコンポーネント

---

## データベーススキーマ（Supabase）

### テーブル構成

#### `d2c_projects`
プロジェクト情報を保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー |
| `owner_id` | UUID | オーナー ID |
| `name` | TEXT | プロジェクト名 |
| `figma_file_key` | TEXT | Figma ファイルキー |
| `figma_node_id` | TEXT | Figma ノード ID |
| `source_url` | TEXT | ソース URL（Figma URL） |
| `default_profile_id` | UUID | デフォルトプロファイル ID |
| `created_at` | TIMESTAMP | 作成日時 |
| `updated_at` | TIMESTAMP | 更新日時 |

#### `d2c_generations`
生成結果のメタデータを保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー |
| `project_id` | UUID | プロジェクト ID（外部キー） |
| `profile_id` | UUID | プロファイル ID（外部キー） |
| `status` | TEXT | ステータス（queued/running/succeeded/failed） |
| `figma_snapshot_hash` | TEXT | Figma スナップショットハッシュ |
| `ir_json` | JSONB | IR（中間表現）JSON |
| `report_json` | JSONB | 品質レポート JSON |
| `error_json` | JSONB | エラー情報 JSON |
| `started_at` | TIMESTAMP | 開始日時 |
| `finished_at` | TIMESTAMP | 終了日時 |
| `created_at` | TIMESTAMP | 作成日時 |

#### `d2c_files`
生成されたファイルを保存

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー |
| `generation_id` | UUID | 生成 ID（外部キー） |
| `path` | TEXT | ファイルパス |
| `content` | TEXT | ファイル内容 |
| `content_sha256` | TEXT | コンテンツ SHA256 ハッシュ |
| `kind` | TEXT | ファイル種別（code/config/style/asset_index） |
| `created_at` | TIMESTAMP | 作成日時 |

**ユニーク制約:** `(generation_id, path)`

#### `d2c_mappings`
Figma ノードと生成コードのマッピング

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー |
| `generation_id` | UUID | 生成 ID（外部キー） |
| `figma_node_id` | TEXT | Figma ノード ID |
| `figma_node_name` | TEXT | Figma ノード名 |
| `target_path` | TEXT | 対象ファイルパス |
| `target_symbol` | TEXT | 対象シンボル名 |
| `loc_start` | INTEGER | 開始行番号 |
| `loc_end` | INTEGER | 終了行番号 |
| `mapping_type` | TEXT | マッピング種別（component/element/style_token/asset） |
| `created_at` | TIMESTAMP | 作成日時 |

#### `d2c_profiles`
生成プロファイル（将来拡張用）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | UUID | プライマリキー |
| `owner_id` | UUID | オーナー ID |
| `name` | TEXT | プロファイル名 |
| `mode` | TEXT | モード（production/lecture/pixel） |
| `output_target` | TEXT | 出力ターゲット（nextjs_tailwind/static_html_css） |
| `use_shadcn` | BOOLEAN | shadcn/ui 使用フラグ |
| `styling_strategy` | TEXT | スタイリング戦略 |
| `naming_convention` | TEXT | 命名規則 |
| `qc_prettier` | BOOLEAN | Prettier チェック |
| `qc_eslint` | BOOLEAN | ESLint チェック |
| `qc_a11y` | BOOLEAN | アクセシビリティチェック |
| `token_cluster_threshold` | NUMERIC | トークンクラスタリング閾値 |

---

## デモモード機能

Supabase が無料プランや接続制限で使用できない場合でも、以下の機能が利用可能です：

1. **コード生成**: モックパイプラインでコード生成
2. **プレビュー**: 生成結果の確認
3. **ZIP 出力**: 生成ファイルのダウンロード

**実装方法:**
- `app/api/generate/route.ts` で DB 保存失敗時に `buildDemoBundle()` でバンドルを構築
- `sessionStorage` に保存して `/result` ページで表示
- ZIP エクスポートは `/api/export-zip` を使用

---

## 設定ファイル

### `next.config.mjs`
- React Strict Mode 有効
- ビルド時の ESLint/TypeScript チェック無効化（開発効率化のため）

### `tailwind.config.ts`
- カスタムカラーパレット（CSS 変数ベース）
- カスタムシャドウ（`soft`）

### `tsconfig.json`
- パスエイリアス設定（`@/app`, `@/components`, `@/lib`）
- 厳密な型チェック有効

### `.eslintrc.json`
- Next.js の ESLint 設定を使用

---

## 開発・デプロイ手順

### ローカル開発

1. **依存関係インストール**
   ```bash
   npm install
   ```

2. **環境変数設定**
   - `.env.example` をコピーして `.env` を作成
   - Supabase の URL とサービスロールキーを設定
   - `D2C_OWNER_ID` に任意の UUID を設定

3. **開発サーバー起動**
   ```bash
   npm run dev
   ```

4. **ブラウザで確認**
   - http://localhost:3000 を開く

### ビルド・本番実行

```bash
npm run build
npm start
```

### Vercel デプロイ

1. Vercel にプロジェクトをインポート
2. 環境変数を設定（`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `D2C_OWNER_ID`, `NEXT_PUBLIC_APP_URL`）
3. デプロイ

---

## 今後の拡張予定

### 1. 実際の Figma API 統合
- Figma API を使用したデザインデータ取得
- ノード構造の解析
- アセット（画像）の取得

### 2. コード生成エンジン
- IR から実際のコード生成
- コンポーネント分割ロジック
- スタイルトークン化

### 3. 品質チェック
- Prettier によるコード整形
- ESLint によるリント
- アクセシビリティチェック

### 4. プレビュー機能強化
- 生成コードの実際のレンダリング（iframe サンドボックス）
- レスポンシブプレビュー（Mobile/Tablet/Desktop）
- ホットリロード

### 5. プロファイル管理 UI
- プロファイル作成・編集画面
- プリセット選択の DB 連携

### 6. 差分表示
- 前回生成との差分表示
- 変更点のハイライト

---

## 注意事項・制約

1. **Supabase 無料プラン制限**
   - 接続数制限により保存機能が無効になる場合がある
   - デモモードで動作確認可能

2. **モックパイプライン**
   - 現時点では実際の Figma データは使用していない
   - 本番実装時は `lib/mockPipeline.ts` を置き換える必要がある

3. **認証**
   - 現在は固定の `D2C_OWNER_ID` を使用
   - 将来的に Supabase Auth を統合予定

4. **エラーハンドリング**
   - 一部のエラーはコンソールに出力されるのみ
   - ユーザー向けエラーメッセージの改善が必要

---

## トラブルシューティング

### Supabase 接続エラー
- `.env` の設定を確認
- Supabase プロジェクトがアクティブか確認
- サービスロールキーが正しいか確認

### ZIP エクスポートエラー
- `archiver` ライブラリが正しくインストールされているか確認
- ファイルサイズが大きすぎる場合はストリーミングを検討

### ビルドエラー
- `next.config.mjs` で TypeScript/ESLint チェックが無効化されているため、型エラーは別途 `tsc` で確認
- Node.js バージョンが 20.x であることを確認（`.nvmrc` 参照）

---

## ライセンス

Private / ご自身の判断で設定してください。

---

## 連絡先・サポート

プロジェクトの引き継ぎに関する質問は、このドキュメントを参照してください。追加の情報が必要な場合は、コード内のコメントや各ファイルの実装を確認してください。
