import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadCoverImage } from "../lib/services/catalog/upload-cover-image";
import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MIN_DIMENSION_PX,
} from "../lib/validations/cover-image";
import { createPng } from "./helpers/create-png";

const mockUploadToCloudinary = vi.hoisted(() => vi.fn());

vi.mock("../lib/services/catalog/cloudinary", () => ({
  uploadToCloudinary: mockUploadToCloudinary,
}));

describe("uploadCoverImage", () => {
  beforeEach(() => {
    mockUploadToCloudinary.mockReset();
    mockUploadToCloudinary.mockResolvedValue({
      secureUrl:
        "https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/test.webp",
      publicId: "emfs-covers/test",
    });
  });

  it("validates, processes, and uploads the cover to Cloudinary", async () => {
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

    const result = await uploadCoverImage({
      body: new Uint8Array(body),
      declaredType: "image/png",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected upload to succeed");
    }

    expect(result.data.url).toBe(
      "https://res.cloudinary.com/demo/image/upload/v1/emfs-covers/test.webp",
    );
    expect(result.data.publicId).toBe("emfs-covers/test");
    expect(result.data.contentType).toBe("image/webp");
    expect(mockUploadToCloudinary).toHaveBeenCalledTimes(1);
    expect(mockUploadToCloudinary.mock.calls[0][0].contentType).toBe(
      "image/webp",
    );
  });

  it("returns structured validation errors without uploading invalid content", async () => {
    const result = await uploadCoverImage({
      body: new Uint8Array(Buffer.from("<html>not an image</html>")),
      declaredType: "text/html",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected invalid image upload to fail");
    }

    expect(result.errors[0]).toMatchObject({
      field: "cover",
      code: "COVER_TYPE_INVALID",
    });
    expect(mockUploadToCloudinary).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "unsupported file",
      body: new Uint8Array(Buffer.from("<html>not an image</html>")),
      declaredType: "text/html",
      expectedCode: "COVER_TYPE_INVALID",
      expectedMessage:
        "Cover must be a JPEG, PNG, or WebP image (detected from file contents).",
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
  ])(
    "returns a field-level error for $name",
    async ({ body, declaredType, expectedCode, expectedMessage }) => {
      const result = await uploadCoverImage({ body, declaredType });

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
      expect(mockUploadToCloudinary).not.toHaveBeenCalled();
    },
  );

  it("returns a safe field error when Cloudinary upload fails", async () => {
    mockUploadToCloudinary.mockRejectedValueOnce(
      new Error("Cloudinary credential expired: secret=super-secret-value"),
    );

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

    const result = await uploadCoverImage({
      body: new Uint8Array(body),
      declaredType: "image/png",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected Cloudinary upload to fail");
    }

    expect(result.errors).toEqual([
      expect.objectContaining({
        field: "cover",
        code: "COVER_UPLOAD_FAILED",
        message: "Cover image could not be uploaded. Please try again.",
      }),
    ]);
    expect(result.errors[0]?.message).not.toContain("secret");
  });
});
