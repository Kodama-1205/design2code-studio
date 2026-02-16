# Design2Code Studio

デザインデータ（Figma など）から HTML/CSS/JavaScript などのコードを生成する Web アプリです。

## 技術スタック

- **Next.js 14** (App Router)
- **Supabase**（プロジェクト・生成結果の保存）
- **TypeScript**, **Tailwind CSS**

## ローカルで動かす

### 1. リポジトリのクローン

```bash
git clone https://github.com/YOUR_USERNAME/design2code-studio.git
cd design2code-studio
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env.example` をコピーして `.env` を作成し、値を設定します。

```bash
cp .env.example .env
```

必要な変数：

| 変数名 | 説明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase のサービスロールキー（Settings → API） |
| `D2C_OWNER_ID` | デモ用オーナー ID（任意の UUID） |

Supabase が無料プランや接続不可の場合は「デモモード」になり、保存は行われませんが生成・プレビュー・ZIP出力は利用できます。

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

---

## GitHub で管理する

### 初回のみ：リポジトリの初期化とプッシュ

まだ Git 管理していない場合：

```bash
git init
git add .
git commit -m "Initial commit: Design2Code Studio"
```

GitHub で **New repository** を作成したあと：

```bash
git remote add origin https://github.com/YOUR_USERNAME/design2code-studio.git
git branch -M main
git push -u origin main
```

- リポジトリは **Private** でも **Public** でもどちらでも可能です。
- `.env` は `.gitignore` に含まれているため、コミットされません。機密情報は GitHub に上げないでください。

---

## Vercel でデプロイする

### 1. Vercel にプロジェクトをインポート

1. [Vercel](https://vercel.com) にログインする（GitHub 連携で OK）
2. **Add New…** → **Project**
3. **Import Git Repository** で `design2code-studio` を選択
4. **Framework Preset** は **Next.js** のまま
5. **Root Directory** はそのまま（`./`）
6. **Deploy** を押さず、いったん **Environment Variables** を設定する

### 2. 環境変数の設定（Vercel）

**Settings → Environment Variables** で次を追加します。

| Name | Value | 環境 |
|------|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` | Production / Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | （Supabase のサービスロールキー） | Production / Preview |
| `D2C_OWNER_ID` | 例: `00000000-0000-0000-0000-000000000001` | Production / Preview |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app`（デプロイ後の URL） | Production |

- `NEXT_PUBLIC_APP_URL` は、Regenerate 実行後のリダイレクト先になります。デプロイ後は「Vercel のドメイン」に合わせて設定してください（例: `https://design2code-studio.vercel.app`）。

### 3. デプロイ

- **Deploy** をクリックしてデプロイを開始
- 以降は `main` ブランチへ push するたびに自動で本番デプロイされます
- プレビュー環境はプルリクエストごとに Vercel が自動作成します

### 4. デプロイ後の確認

- ダッシュボードの **Domains** で表示されている URL を控える
- 必要なら `NEXT_PUBLIC_APP_URL` をその URL に更新して再デプロイ

---

## 主な機能

- **New Generation**: Figma URL を入力してコード生成（現状はモックパイプライン）
- **結果画面**: プレビュー・コード・レポート・マッピングの確認
- **Export ZIP**: 生成ファイル一式のダウンロード
- **Regenerate**: 同じソースから再生成（保存が有効な場合）
- **デモモード**: Supabase が使えない場合も生成・プレビュー・ZIP は利用可能

## スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動（ビルド後） |
| `npm run lint` | ESLint 実行 |

## ライセンス

Private / ご自身の判断で設定してください。
