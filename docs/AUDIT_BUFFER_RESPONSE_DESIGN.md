# Buffer / Response 設計の監査と修正方針

## 問題の本質

**Node.js の `Buffer` は Web API の `BodyInit` 型に含まれない。**

- `NextResponse(body)` や `Response(body)` の `body` は `BodyInit` 型
- `BodyInit` = `Blob | BufferSource | FormData | URLSearchParams | USVString | ReadableStream`
- `Buffer` は `BufferSource` のサブタイプではない（型定義上）

→ **`Buffer` を直接渡すと TypeScript コンパイルエラーになる**

---

## 現在の Buffer 発生箇所

### 1. `lib/zip.ts` (根本修正済み)

```typescript
export async function buildZipFromFiles(...): Promise<Uint8Array>
```

- **戻り値**: `Uint8Array`（BodyInit 互換）- 2025-02 に修正
- **呼び出し元**: 2箇所（後述）

### 2. 呼び出し元とレスポンス

| ファイル | 用途 | 現状 | GitHub main |
|----------|------|------|-------------|
| `app/api/export-zip/route.ts` | 汎用 ZIP エクスポート | ✅ Uint8Array 変換済み | ✅ 修正済み |
| `app/api/generate/generations/[generationId]/export/route.ts` | 世代 ZIP エクスポート | ✅ Uint8Array 変換済み | ❌ **未修正**（zipBuffer のまま） |
| `app/api/figma-preview/route.ts` | Figma 画像プロキシ | `arrayBuffer()` → ArrayBuffer | ✅ 問題なし |

### 3. その他の Buffer 使用

- `app/api/diag/projects/route.ts`: `Buffer.from(..., "base64")` でデコードのみ → レスポンスには使わないので問題なし

---

## 設計上の問題点

1. **局所対応の繰り返し**: 1ファイルずつ直すと、別ファイルで同じエラーが発生
2. **ワークスペースと GitHub の乖離**: 修正がワークスペースにしか反映されず、Vercel は GitHub をビルド
3. **根本修正の欠如**: `lib/zip.ts` が `Buffer` を返す設計のまま

---

## 推奨する修正方針（一括）

### 方針 A: 根本で型を揃える（推奨）

**`lib/zip.ts` の戻り値を `Uint8Array` に変更**

```typescript
// lib/zip.ts
export async function buildZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Uint8Array> {
  const buffer = await buildZipBuffer(files); // 内部実装
  return new Uint8Array(buffer);
}
```

- **メリット**: 呼び出し元で変換不要。型が一貫する
- **リスク**: 既存の `Buffer` 前提のコードがあれば影響。今回は 2 箇所のみで、どちらも NextResponse に渡すだけなので影響小

### 方針 B: 呼び出し元で変換（現状の延長）

- 各 API ルートで `new Uint8Array(zipBuffer)` を実施
- **問題**: 新的な呼び出し元を追加するたびに同じミスを起こし得る

### 方針 C: ラッパー関数を提供

```typescript
// lib/zip.ts
export async function buildZipFromFiles(...): Promise<Buffer> { ... }

export async function buildZipAsBodyInit(
  files: Array<{ path: string; content: string }>
): Promise<Uint8Array> {
  const buffer = await buildZipFromFiles(files);
  return new Uint8Array(buffer);
}
```

- API ルートは `buildZipAsBodyInit` のみを使用
- 既存の `Buffer` を期待するコードがあれば `buildZipFromFiles` を継続利用

---

## デプロイフロー（現状）

```
[ワークスペース jqy]  ← 修正作業
       ↓ (git push が必要)
[GitHub main]        ← Vercel が参照
       ↓
[Vercel ビルド]
```

**重要**: ワークスペースの修正だけでは Vercel に反映されない。必ず `main` へ push する必要がある。

---

## 修正漏れチェックリスト（今後のために）

- [ ] `lib/zip.ts` を使う全ファイルを列挙
- [ ] 各ファイルで `Buffer` → `BodyInit` の変換が正しいか確認
- [ ] 修正後、`npm run build` でローカル検証
- [ ] 修正を GitHub main に push
- [ ] Vercel で Production デプロイが成功するか確認

---

## 今後回避すべきこと

1. **1箇所ずつの場当たり修正**: 関連する箇所を洗い出してから一括対応する
2. **push なしの「解消」**: ローカルのみの修正で「解消した」としない
3. **根本原因の放置**: `Buffer` を返す設計のまま呼び出し元で都度変換するのではなく、型を揃える設計にする
