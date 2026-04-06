// lib/zip.ts
import { PassThrough } from "stream";
import type { Archiver } from "archiver";

/**
 * # 重要（互換性対策）
 * archiver は CommonJS パッケージのため、Next.js のビルド環境によっては
 * import した値が関数として期待通りにならない場合がある。
 *
 * そのため dynamic import で都度ロードし、default / 直export のどちらかを
 * 関数として取り出す。
 */
async function getArchiver(): Promise<
  (format: "zip", options: { zlib: { level: number } }) => Archiver
> {
  const mod = await import("archiver");
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
    // Promise を new Promise の外で await できないため、内部でロードする。
    // （失敗した場合は reject する）
    getArchiver()
      .then((archiver) => {
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
      })
      .catch(reject);
  });
}
