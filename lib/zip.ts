import archiver from "archiver";
import { PassThrough } from "stream";

/** Returns Uint8Array (BodyInit-compatible) for direct use in NextResponse/Response. */
export async function buildZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();

    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    stream.on("error", reject);

    archive.on("error", reject);
    archive.pipe(stream);

    for (const f of files) {
      const dataUrlMatch = /^data:([^;]+);base64,(.+)$/s.exec(f.content);
      if (dataUrlMatch) {
        const buffer = Buffer.from(dataUrlMatch[2], "base64");
        archive.append(buffer, { name: f.path });
      } else {
        archive.append(f.content, { name: f.path });
      }
    }

    archive.finalize().catch(reject);
  });
}
