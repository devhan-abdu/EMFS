import { describe, it, expect } from "vitest";
import { imageSize } from "image-size";

import { processCoverImage } from "../lib/services/process-cover-image";
import {
  COVER_IMAGE_MAX_DIMENSION_PX,
  COVER_IMAGE_MIN_DIMENSION_PX,
  COVER_IMAGE_OUTPUT_CONTENT_TYPE,
} from "../lib/validations/cover-image";
import { createPng } from "./helpers/create-png";

describe("processCoverImage", () => {
  it("does not enlarge a cover already at the minimum size", async () => {
    const body = createPng(
      COVER_IMAGE_MIN_DIMENSION_PX,
      COVER_IMAGE_MIN_DIMENSION_PX,
    );
    const result = await processCoverImage({ body });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.contentType).toBe(COVER_IMAGE_OUTPUT_CONTENT_TYPE);
      expect(result.data.extension).toBe("webp");
      expect(result.data.width).toBe(COVER_IMAGE_MIN_DIMENSION_PX);
      expect(result.data.height).toBe(COVER_IMAGE_MIN_DIMENSION_PX);
      expect(imageSize(result.data.body).type).toBe("webp");
    }
  });

  it("downscales an oversized cover to the max output box", async () => {
    const body = createPng(
      COVER_IMAGE_MAX_DIMENSION_PX + 4,
      COVER_IMAGE_MAX_DIMENSION_PX + 4,
    );
    const result = await processCoverImage({ body });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.width).toBeLessThanOrEqual(COVER_IMAGE_MAX_DIMENSION_PX);
      expect(result.data.height).toBeLessThanOrEqual(
        COVER_IMAGE_MAX_DIMENSION_PX,
      );
      expect(result.data.contentType).toBe("image/webp");
    }
  });

  it("rejects spoofed files before Sharp runs", async () => {
    const html = new TextEncoder().encode("<!doctype html><html></html>");
    const result = await processCoverImage({
      body: html,
      declaredType: "image/png",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe("COVER_TYPE_INVALID");
    }
  });
});
