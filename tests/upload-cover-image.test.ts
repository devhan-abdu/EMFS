import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { uploadCoverImage } from "../lib/services/upload-cover-image";
import { COVER_IMAGE_MAX_BYTES, COVER_IMAGE_MAX_DIMENSION_PX, COVER_IMAGE_MIN_DIMENSION_PX } from "../lib/validations/cover-image";
import type { StorageService } from "../lib/services/storage";
import { createPng } from "./helpers/create-png";

type UploadCallInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

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

    const upload = vi.fn(async ({ key, contentType, body }: UploadCallInput) => ({
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

  it.each([
    {
      name: "unsupported file",
      body: new Uint8Array(Buffer.from("<html>not an image</html>")),
      declaredType: "text/html",
      expectedCode: "COVER_TYPE_INVALID",
      expectedMessage: "Cover must be a JPEG, PNG, or WebP image (detected from file contents).",
    },
    {
      name: "oversized file",
      body: (() => {
        const buffer = new Uint8Array(COVER_IMAGE_MAX_BYTES + 1);
        buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        return buffer;
      })(),
      declaredType: "image/png",
      expectedCode: "COVER_TOO_LARGE",
      expectedMessage: `Cover image must be at most ${COVER_IMAGE_MAX_BYTES} bytes (5 MiB).`,
    },
    {
      name: "invalid dimensions",
      body: createPng(199, COVER_IMAGE_MIN_DIMENSION_PX),
      declaredType: "image/png",
      expectedCode: "COVER_DIMENSIONS_TOO_SMALL",
      expectedMessage: `Cover image must be at least ${COVER_IMAGE_MIN_DIMENSION_PX}×${COVER_IMAGE_MIN_DIMENSION_PX} pixels.`,
    },
  ])("returns a field-level error for $name", async ({ body, declaredType, expectedCode, expectedMessage }) => {
    const storageService: StorageService = {
      upload: vi.fn(async () => ({ key: "ignored", publicUrl: "https://cdn.example.com/ignored" })),
      delete: vi.fn(async () => undefined),
      getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    };

    const result = await uploadCoverImage({ body, declaredType }, storageService);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected upload validation to fail");
    }

    expect(result.errors).toEqual([
      expect.objectContaining({
        field: "cover",
        code: expectedCode,
        message: expectedMessage,
      }),
    ]);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it("accepts a valid cover and returns the processed upload payload", async () => {
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

    const storageService: StorageService = {
      upload: vi.fn(async ({ key, contentType }) => ({
        key,
        publicUrl: `https://cdn.example.com/${key}`,
        contentType,
      })),
      delete: vi.fn(async () => undefined),
      getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    };

    const result = await uploadCoverImage(
      { body: new Uint8Array(body), declaredType: "image/png" },
      storageService,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected valid cover to upload");
    }

    expect(result.data.contentType).toBe("image/webp");
    expect(result.data.key).toMatch(/^covers\/[0-9a-f-]+\.webp$/);
    expect(result.data.publicUrl).toContain("https://cdn.example.com/");
    expect(storageService.upload).toHaveBeenCalledTimes(1);
  });

  it("returns a safe field error when object storage upload fails", async () => {
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

    const storageService: StorageService = {
      upload: vi.fn(async () => {
        throw new Error("S3 credential expired: AKIA... secret=super-secret-value");
      }),
      delete: vi.fn(async () => undefined),
      getPublicUrl: (key) => `https://cdn.example.com/${key}`,
    };

    const result = await uploadCoverImage(
      { body: new Uint8Array(body), declaredType: "image/png" },
      storageService,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected storage upload to fail");
    }

    expect(result.errors).toEqual([
      expect.objectContaining({
        field: "cover",
        code: "COVER_UPLOAD_FAILED",
        message: "Cover image could not be uploaded. Please try again.",
      }),
    ]);
    expect(result.errors[0]?.message).not.toContain("AKIA");
    expect(result.errors[0]?.message).not.toContain("secret");
  });
});
