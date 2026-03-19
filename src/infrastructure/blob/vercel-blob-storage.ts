import type { IBlobStorage } from "@/domain/ports/blob-storage";

export class VercelBlobStorage implements IBlobStorage {
  async delete(url: string): Promise<void> {
    const { del } = await import("@vercel/blob");
    await del(url);
  }
}
