# Design2Code Studio - コード確認レポート

## 確認日時
2026年2月9日

## 全体評価

プロジェクト全体のコードは概ね良好な状態です。TypeScript の型安全性が確保されており、ESLint エラーもありません。ただし、いくつかの修正が必要な箇所があります。

---

## ✅ 良好な点

1. **型安全性**
   - TypeScript の strict モードが有効
   - Zod による環境変数バリデーション
   - 適切な型定義がされている

2. **コード構造**
   - ディレクトリ構造が明確
   - 関心の分離が適切（API、コンポーネント、ライブラリ）
   - コメントが適切に記述されている

3. **エラーハンドリング**
   - デモモードへのフォールバック機能
   - 適切なエラーメッセージ
   - 警告（warnings）の表示機能

4. **セキュリティ**
   - 環境変数の適切な分離（public/server）
   - Supabase サービスロールキーの適切な管理

---

## ⚠️ 修正が必要な箇所

### 1. `app/api/generate/route.ts` - 環境変数の参照方法

**問題:**
217行目で `env.D2C_OWNER_ID` を使用していますが、`env` は public 環境変数のみを含みます。

**現在のコード:**
```typescript
owner_id: env.D2C_OWNER_ID  // ❌ env には D2C_OWNER_ID が存在しない
```

**修正方法:**
```typescript
import { getServerEnv } from "@/lib/env";

// 関数内で使用
const serverEnv = getServerEnv();
owner_id: serverEnv.D2C_OWNER_ID  // ✅
```

**影響度:** 高（デモモード時の動作に影響）

---

### 2. `app/result/page.tsx` - デモモードの実装

**問題:**
`/result` ページはデモモード用のページとして設計されていますが、現在は `getGenerationBundle()` で DB から取得しています。デモモードの場合は `sessionStorage` から取得すべきです。

**現在の実装:**
- `getGenerationBundle()` を使用（DB から取得）
- デモモードのバンドルは `sessionStorage` に保存されているが、読み取っていない

**修正方法:**
クライアントコンポーネントに変更し、`sessionStorage` から取得するように修正：

```typescript
"use client";

import { useEffect, useState } from "react";
// ...

const DEMO_STORAGE_KEY = "d2c_demo_bundle";

export default function Page() {
  const [bundle, setBundle] = useState<Bundle | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DEMO_STORAGE_KEY);
      if (raw) {
        setBundle(JSON.parse(raw) as Bundle);
      }
    } catch {
      setBundle(null);
    }
  }, []);

  // ...
}
```

**影響度:** 中（デモモードの動作に影響）

---

### 3. `components/NewWizard.tsx` - Figma Token の送信

**問題:**
`NewWizard.tsx` では `figmaToken` を送信していませんが、`app/api/generate/route.ts` では `figmaToken` を受け取る実装になっています。

**現在のコード:**
```typescript
body: JSON.stringify({
  sourceUrl,
  projectId,
  profileId: undefined
  // figmaToken が送信されていない
})
```

**修正方法:**
Figma Token 入力フィールドを追加し、送信する：

```typescript
const [figmaToken, setFigmaToken] = useState("");

// ...

body: JSON.stringify({
  sourceUrl,
  projectId,
  profileId: undefined,
  figmaToken: figmaToken.trim() || undefined
})
```

**影響度:** 低（Figma プレビュー機能が動作しない）

---

## 📝 改善提案

### 1. エラーログの強化

現在、一部のエラーはコンソールに出力されるのみです。本番環境では適切なログサービス（例: Sentry）への統合を検討してください。

### 2. 型定義の改善

`lib/db.ts` の `GenerationBundle` 型が重複定義されている可能性があります。確認が必要です。

### 3. テストコードの追加

現在、テストコードが存在しません。主要な機能（API ルート、データベース操作）に対するテストの追加を推奨します。

### 4. 環境変数のドキュメント化

`.env.example` に各環境変数の説明を追加することを推奨します。

---

## 🔍 詳細確認結果

### ファイル別の確認結果

#### ✅ `lib/db.ts`
- 型定義が適切
- エラーハンドリングが適切
- `getServerEnv()` の使用が正しい

#### ✅ `lib/env.ts`
- 環境変数の分離が適切
- Zod によるバリデーションが実装されている
- `getServerEnv()` による遅延評価が実装されている

#### ✅ `lib/supabaseAdmin.ts`
- サービスロールキーの適切な管理
- セッション永続化が無効化されている

#### ✅ `app/api/export-zip/route.ts`
- ZIP 生成の実装が適切
- `runtime = "nodejs"` の指定が正しい

#### ✅ `components/NewWizard.tsx`
- 警告表示機能が実装されている
- エラーハンドリングが適切

#### ⚠️ `app/api/generate/route.ts`
- Figma API 統合が実装されている
- プレビュー保存機能が実装されている
- 環境変数の参照方法に問題あり（上記参照）

#### ⚠️ `app/result/page.tsx`
- デモモードの実装が不完全（上記参照）

---

## 🚀 優先度別の修正タスク

### 高優先度（即座に修正推奨）

1. **`app/api/generate/route.ts` の環境変数参照修正**
   - `env.D2C_OWNER_ID` → `getServerEnv().D2C_OWNER_ID`
   - 影響: デモモード時の動作

### 中優先度（近日中に修正推奨）

2. **`app/result/page.tsx` のデモモード実装**
   - `sessionStorage` からの読み取り実装
   - 影響: デモモードの動作

### 低優先度（機能改善）

3. **`components/NewWizard.tsx` の Figma Token 入力**
   - UI にトークン入力フィールドを追加
   - 影響: Figma プレビュー機能の利用

---

## 📊 コード品質メトリクス

- **TypeScript エラー:** 0件
- **ESLint エラー:** 0件
- **型安全性:** ⭐⭐⭐⭐⭐ (5/5)
- **コード構造:** ⭐⭐⭐⭐⭐ (5/5)
- **エラーハンドリング:** ⭐⭐⭐⭐ (4/5)
- **ドキュメント:** ⭐⭐⭐⭐ (4/5)

---

## まとめ

プロジェクト全体のコード品質は高く、主要な機能は適切に実装されています。上記の修正を実施することで、より堅牢なアプリケーションになります。

特に、環境変数の参照方法とデモモードの実装については、早急な修正を推奨します。
