import sharp from "sharp";

import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MAX_DIMENSION_PX,
  COVER_IMAGE_MAX_INPUT_PIXELS,
  COVER_IMAGE_MIN_DIMENSION_PX,
  COVER_IMAGE_OUTPUT_CONTENT_TYPE,
  COVER_IMAGE_OUTPUT_EXTENSION,
  COVER_IMAGE_OUTPUT_QUALITY,
  coverFieldError,
  coverImageByteLengthSchema,
  type CoverImageProcessResult,
} from "@/lib/validations/cover-image";
import {
  validateCoverImage,
  type ValidateCoverImageInput,
} from "@/lib/services/cover-image";

/**
 * Validate, then resize/compress in memory. Does not write the app filesystem
 * or object storage.
 */
export async function processCoverImage(
  input: ValidateCoverImageInput,
): Promise<CoverImageProcessResult> {
  const inspected = validateCoverImage(input, {
    allowOversizedDimensions: true,
  });
  if (!inspected.ok) {
    return inspected;
  }

  const inputPixels = inspected.data.width * inspected.data.height;
  if (inputPixels > COVER_IMAGE_MAX_INPUT_PIXELS) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_DIMENSIONS_TOO_LARGE",
          "Cover image has too many pixels to process safely.",
        ),
      ],
    };
  }

  let output: Buffer;
  let info: { width: number; height: number; size: number };
  try {
    const result = await sharp(input.body, {
      failOn: "error",
      limitInputPixels: COVER_IMAGE_MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: COVER_IMAGE_MAX_DIMENSION_PX,
        height: COVER_IMAGE_MAX_DIMENSION_PX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: COVER_IMAGE_OUTPUT_QUALITY,
        effort: 4,
      })
      .toBuffer({ resolveWithObject: true });
    output = result.data;
    info = {
      width: result.info.width,
      height: result.info.height,
      size: result.info.size,
    };
  } catch {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_PROCESS_FAILED",
          "Cover image could not be processed. Upload a valid JPEG, PNG, or WebP file.",
        ),
      ],
    };
  }

  if (
    info.width < COVER_IMAGE_MIN_DIMENSION_PX ||
    info.height < COVER_IMAGE_MIN_DIMENSION_PX
  ) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_DIMENSIONS_TOO_SMALL",
          `Cover image must be at least ${COVER_IMAGE_MIN_DIMENSION_PX}×${COVER_IMAGE_MIN_DIMENSION_PX} pixels after resize.`,
        ),
      ],
    };
  }

  const sizeParse = coverImageByteLengthSchema.safeParse(info.size);
  if (!sizeParse.success) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_TOO_LARGE",
          `Cover image must be at most ${COVER_IMAGE_MAX_BYTES} bytes (5 MiB) after compression.`,
        ),
      ],
    };
  }

  return {
    ok: true,
    data: {
      body: new Uint8Array(output),
      contentType: COVER_IMAGE_OUTPUT_CONTENT_TYPE,
      extension: COVER_IMAGE_OUTPUT_EXTENSION,
      width: info.width,
      height: info.height,
      byteLength: info.size,
    },
  };
}
