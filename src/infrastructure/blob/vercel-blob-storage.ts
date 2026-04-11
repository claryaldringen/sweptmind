import type { IBlobStorage } from "@/domain/ports/blob-storage";

export class VercelBlobStorage implements IBlobStorage {
  async save(_path: string, _data: Buffer): Promise<string> {
    throw new Error("Not implemented — use Vercel Blob client-side upload");
  }

  async delete(url: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(url);
  }
}
