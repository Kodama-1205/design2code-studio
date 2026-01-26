import archiver from "archiver";
import { PassThrough } from "stream";

export async function buildZipFromFiles(files: Array<{ path: string; content: string }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = new PassThrough();

    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);

    archive.on("error", reject);
    archive.pipe(stream);

    for (const f of files) {
      archive.append(f.content, { name: f.path });
    }

    archive.finalize().catch(reject);
  });
}
