import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import type { IBlobStorage } from "@/domain/ports/blob-storage";

export class LocalFilesystemBlobStorage implements IBlobStorage {
  constructor(private readonly basePath: string) {}

  async save(relativePath: string, data: Buffer): Promise<string> {
    const resolved = path.resolve(this.basePath, relativePath);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error("Invalid path");
    }

    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, data);

    return `/uploads/${relativePath}`;
  }

  async delete(url: string): Promise<void> {
    // url is either "/uploads/attachments/..." (new) or a full Vercel Blob URL (legacy)
    const relativePath = url.startsWith("/uploads/") ? url.slice("/uploads/".length) : null;
    if (!relativePath) return; // skip legacy Vercel Blob URLs

    const resolved = path.resolve(this.basePath, relativePath);
    if (!resolved.startsWith(this.basePath)) return;

    try {
      await unlink(resolved);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}
