import { describe, it, expect, vi, beforeEach } from "vitest";
import { LocalFilesystemBlobStorage } from "../local-filesystem-blob-storage";

// Mock fs/promises
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { mkdir, writeFile, unlink } from "fs/promises";

describe("LocalFilesystemBlobStorage", () => {
  let storage: LocalFilesystemBlobStorage;
  const basePath = "/opt/sweptmind-uploads";

  beforeEach(() => {
    vi.clearAllMocks();
    storage = new LocalFilesystemBlobStorage(basePath);
  });

  describe("save", () => {
    it("creates directory and writes file, returns public URL", async () => {
      const data = Buffer.from("test data");
      const result = await storage.save("attachments/user-1/task-1/photo.jpg", data);

      expect(mkdir).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1",
        { recursive: true },
      );
      expect(writeFile).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1/photo.jpg",
        data,
      );
      expect(result).toBe("/uploads/attachments/user-1/task-1/photo.jpg");
    });

    it("rejects path traversal attempts", async () => {
      const data = Buffer.from("test");
      await expect(storage.save("../etc/passwd", data)).rejects.toThrow(
        "Invalid path",
      );
      await expect(storage.save("attachments/../../etc/passwd", data)).rejects.toThrow(
        "Invalid path",
      );
    });
  });

  describe("delete", () => {
    it("deletes file by public URL", async () => {
      await storage.delete("/uploads/attachments/user-1/task-1/photo.jpg");

      expect(unlink).toHaveBeenCalledWith(
        "/opt/sweptmind-uploads/attachments/user-1/task-1/photo.jpg",
      );
    });

    it("ignores ENOENT errors (file already gone)", async () => {
      const err = new Error("ENOENT") as NodeJS.ErrnoException;
      err.code = "ENOENT";
      vi.mocked(unlink).mockRejectedValueOnce(err);

      await expect(
        storage.delete("/uploads/attachments/user-1/task-1/gone.jpg"),
      ).resolves.toBeUndefined();
    });
  });
});
