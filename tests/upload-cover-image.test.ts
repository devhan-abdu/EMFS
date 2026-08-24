import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { uploadCoverImage } from "../lib/services/upload-cover-image";
import type { StorageService } from "../lib/services/storage";

describe("uploadCoverImage", () => {
  it("validates, processes, and uploads the cover through the storage service", async () => {
    const body = await sharp({
      create: {
        width: 1200,
        height: 1200,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const upload = vi.fn(async ({ key, contentType, body }: any) => ({
      key,
      publicUrl: `https://cdn.example.com/${key}`,
      contentType,
      body,
    }));

    const storageService: StorageService = {
      upload,
      delete: vi.fn(async () => undefined),
      getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    };

    const result = await uploadCoverImage(
      {
        body: new Uint8Array(body),
        declaredType: "image/png",
      },
      storageService,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected upload to succeed");
    }

    expect(result.data.key).toMatch(/^covers\/[0-9a-f-]+\.webp$/);
    expect(result.data.publicUrl).toContain("https://cdn.example.com/");
    expect(result.data.contentType).toBe("image/webp");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upload.mock.calls[0][0].key).toBe(result.data.key);
    expect(upload.mock.calls[0][0].contentType).toBe("image/webp");
  });

  it("returns structured validation errors without uploading invalid content", async () => {
    const storageService: StorageService = {
      upload: vi.fn(async () => ({ key: "ignored", publicUrl: "https://cdn.example.com/ignored" })),
      delete: vi.fn(async () => undefined),
      getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    };

    const result = await uploadCoverImage(
      {
        body: new Uint8Array(Buffer.from("<html>not an image</html>")),
        declaredType: "text/html",
      },
      storageService,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid image upload to fail");
    }

    expect(result.errors[0]).toMatchObject({
      field: "cover",
      code: "COVER_TYPE_INVALID",
    });
    expect(storageService.upload).not.toHaveBeenCalled();
  });
});
