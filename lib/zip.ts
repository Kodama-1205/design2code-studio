// lib/zip.ts
import archiver from "archiver";
import { PassThrough } from "stream";

/** Returns Uint8Array (BodyInit-compatible) for direct use in NextResponse/Response. */
export async function buildZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // zip アーカイブ生成（圧縮率最大）
    const archive = archiver("zip", { zlib: { level: 9 } });

    // archiver の出力先（メモリにためる）
    const stream = new PassThrough();

    // 出力を Buffer チャンクとして収集
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    stream.on("error", reject);

    // archiver 側のエラーも拾う
    archive.on("error", reject);

    // archiver の出力を PassThrough に流す
    archive.pipe(stream);

    // zip にファイルを追加
    for (const f of files) {
      const dataUrlMatch = /^data:([^;]+);base64,(.+)$/s.exec(f.content);
      if (dataUrlMatch) {
        const buffer = Buffer.from(dataUrlMatch[2], "base64");
        archive.append(buffer, { name: f.path });
      } else {
        archive.append(f.content, { name: f.path });
      }
    }

    // finalize（Promise返却だが、念のため catch で reject）
    archive.finalize().catch(reject);
  });
}
