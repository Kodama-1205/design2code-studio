// lib/zip.ts
import { PassThrough } from "stream";
import type { Archiver } from "archiver";

/**
 * # 重要（互換性対策）
 * archiver は CommonJS パッケージのため、Next.js のビルド環境によっては
 * `import archiver from "archiver"` が "function ではない" 形に化けることがある。
 * それを避けるため dynamic require を使い、常に関数として取得する。
 */
function getArchiver(): (format: "zip", options: { zlib: { level: number } }) => Archiver {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("archiver");
  return (mod.default ?? mod) as (format: "zip", options: { zlib: { level: number } }) => Archiver;
}

/**
 * 指定されたファイル配列（path と content）から zip をメモリ上で生成し Buffer として返す
 * - files[].path : zip 内のパス（例: "src/app/page.tsx"）
 * - files[].content : そのファイル内容（文字列）
 */
export async function buildZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archiver = getArchiver();

    // zip アーカイブ生成（圧縮率最大）
    const archive = archiver("zip", { zlib: { level: 9 } });

    // archiver の出力先（メモリにためる）
    const stream = new PassThrough();

    // 出力を Buffer チャンクとして収集
    const chunks: Buffer[] = [];

    stream.on("data", (c) => {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    });

    // ✅ 完了検知は finish を優先（end より安定）
    stream.on("finish", () => resolve(Buffer.concat(chunks)));

    stream.on("error", reject);

    // archiver 側のエラーも拾う
    archive.on("error", reject);

    // archiver の出力を PassThrough に流す
    archive.pipe(stream);

    // zip にファイルを追加
    for (const f of files) {
      archive.append(f.content, { name: f.path });
    }

    // finalize（戻りが Promise の環境もあるので catch）
    Promise.resolve(archive.finalize()).catch(reject);
  });
}
