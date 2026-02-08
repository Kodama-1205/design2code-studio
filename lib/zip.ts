// lib/zip.ts
import archiver from "archiver";
import { PassThrough } from "stream";

/**
 * 指定されたファイル配列（path と content）から zip をメモリ上で生成し Buffer として返す
 * - files[].path : zip 内のパス（例: "src/app/page.tsx"）
 * - files[].content : そのファイル内容（文字列）
 */
export async function buildZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // zip アーカイブ生成（圧縮率最大）
    const archive = archiver("zip", { zlib: { level: 9 } });

    // archiver の出力先（メモリにためる）
    const stream = new PassThrough();

    // 出力を Buffer チャンクとして収集
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    // archiver 側のエラーも拾う
    archive.on("error", reject);

    // archiver の出力を PassThrough に流す
    archive.pipe(stream);

    // zip にファイルを追加
    for (const f of files) {
      archive.append(f.content, { name: f.path });
    }

    // finalize（Promise返却だが、念のため catch で reject）
    archive.finalize().catch(reject);
  });
}
