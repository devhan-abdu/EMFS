import { describe, it, expect } from "vitest";

import { validateCoverImage } from "../lib/services/cover-image";
import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MAX_DIMENSION_PX,
  COVER_IMAGE_MIN_DIMENSION_PX,
} from "../lib/validations/cover-image";
import { createPng } from "./helpers/create-png";

describe("validateCoverImage", () => {
  it("accepts a PNG at the minimum dimensions", () => {
    const body = createPng(
      COVER_IMAGE_MIN_DIMENSION_PX,
      COVER_IMAGE_MIN_DIMENSION_PX,
    );
    const result = validateCoverImage({ body });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentType).toBe("image/png");
      expect(result.data.extension).toBe("png");
      expect(result.data.width).toBe(COVER_IMAGE_MIN_DIMENSION_PX);
      expect(result.data.height).toBe(COVER_IMAGE_MIN_DIMENSION_PX);
    }
  });

  it("rejects an empty body", () => {
    const result = validateCoverImage({ body: new Uint8Array() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({
        field: "cover",
        code: "COVER_EMPTY",
      });
    }
  });

  it("rejects a file over the byte limit before decoding pixels", () => {
    const body = new Uint8Array(COVER_IMAGE_MAX_BYTES + 1);
    body.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const result = validateCoverImage({ body });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_TOO_LARGE");
    }
  });

  it("rejects HTML spoofed as a PNG filename/type", () => {
    const html = new TextEncoder().encode("<!doctype html><html></html>");
    const result = validateCoverImage({
      body: html,
      declaredType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_TYPE_INVALID");
    }
  });

  it("rejects a declared MIME that does not match sniffed contents", () => {
    const body = createPng(
      COVER_IMAGE_MIN_DIMENSION_PX,
      COVER_IMAGE_MIN_DIMENSION_PX,
    );
    const result = validateCoverImage({
      body,
      declaredType: "image/jpeg",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_TYPE_MISMATCH");
    }
  });

  it("rejects PNG magic with truncated image data", () => {
    const body = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);
    const result = validateCoverImage({ body });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_UNREADABLE");
    }
  });

  it("rejects dimensions below the minimum", () => {
    const body = createPng(199, COVER_IMAGE_MIN_DIMENSION_PX);
    const result = validateCoverImage({ body });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_DIMENSIONS_TOO_SMALL");
    }
  });

  it("rejects dimensions above the maximum", () => {
    const body = createPng(
      COVER_IMAGE_MAX_DIMENSION_PX + 1,
      COVER_IMAGE_MIN_DIMENSION_PX,
    );
    const result = validateCoverImage({ body });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_DIMENSIONS_TOO_LARGE");
    }
  });
});
