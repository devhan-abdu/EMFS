import { imageSize } from "image-size";

import {
  COVER_IMAGE_MAX_BYTES,
  COVER_IMAGE_MAX_DIMENSION_PX,
  COVER_IMAGE_MIN_DIMENSION_PX,
  coverFieldError,
  coverImageByteLengthSchema,
  coverImageContentTypeSchema,
  type ApprovedCoverImage,
  type CoverImageContentType,
  type CoverImageValidationResult,
} from "@/lib/validations/cover-image";

export type ValidateCoverImageInput = {
  body: Uint8Array;
  /** Client Content-Type, if any. Ignored when empty or `application/octet-stream`. */
  declaredType?: string;
};

export type ValidateCoverImageOptions = {
  /** When true, skip the 4096px reject so Sharp can downscale. */
  allowOversizedDimensions?: boolean;
};

const EXTENSION_BY_TYPE: Record<CoverImageContentType, ApprovedCoverImage["extension"]> =
  {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

/**
 * Inspect cover bytes. Never writes to object storage.
 * Rejects filename/MIME spoofing by sniffing magic bytes, then reading dimensions.
 */
export function validateCoverImage(
  input: ValidateCoverImageInput,
  options?: ValidateCoverImageOptions,
): CoverImageValidationResult {
  const body = input.body;

  if (body.byteLength === 0) {
    return {
      ok: false,
      errors: [coverFieldError("COVER_EMPTY", "Cover image is required.")],
    };
  }

  const sizeParse = coverImageByteLengthSchema.safeParse(body.byteLength);
  if (!sizeParse.success) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_TOO_LARGE",
          `Cover image must be at most ${COVER_IMAGE_MAX_BYTES} bytes (5 MiB).`,
        ),
      ],
    };
  }

  const sniffedType = sniffCoverImageType(body);
  const typeParse = coverImageContentTypeSchema.safeParse(sniffedType);
  if (!typeParse.success) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_TYPE_INVALID",
          "Cover must be a JPEG, PNG, or WebP image (detected from file contents).",
        ),
      ],
    };
  }

  const declared = normalizeDeclaredType(input.declaredType);
  if (declared && declared !== typeParse.data) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_TYPE_MISMATCH",
          "Declared image type does not match the file contents.",
        ),
      ],
    };
  }

  let width: number | undefined;
  let height: number | undefined;
  let headerType: string | undefined;
  try {
    const dimensions = imageSize(body);
    width = dimensions.width;
    height = dimensions.height;
    headerType = dimensions.type;
  } catch {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_UNREADABLE",
          "Cover image could not be read. Upload a valid JPEG, PNG, or WebP file.",
        ),
      ],
    };
  }

  if (
    width === undefined ||
    height === undefined ||
    !headerTypeMatches(typeParse.data, headerType)
  ) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_UNREADABLE",
          "Cover image could not be read. Upload a valid JPEG, PNG, or WebP file.",
        ),
      ],
    };
  }

  if (
    width < COVER_IMAGE_MIN_DIMENSION_PX ||
    height < COVER_IMAGE_MIN_DIMENSION_PX
  ) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_DIMENSIONS_TOO_SMALL",
          `Cover image must be at least ${COVER_IMAGE_MIN_DIMENSION_PX}×${COVER_IMAGE_MIN_DIMENSION_PX} pixels.`,
        ),
      ],
    };
  }

  if (
    !options?.allowOversizedDimensions &&
    (width > COVER_IMAGE_MAX_DIMENSION_PX ||
      height > COVER_IMAGE_MAX_DIMENSION_PX)
  ) {
    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_DIMENSIONS_TOO_LARGE",
          `Cover image must be at most ${COVER_IMAGE_MAX_DIMENSION_PX}×${COVER_IMAGE_MAX_DIMENSION_PX} pixels.`,
        ),
      ],
    };
  }

  return {
    ok: true,
    data: {
      contentType: typeParse.data,
      extension: EXTENSION_BY_TYPE[typeParse.data],
      width,
      height,
      byteLength: body.byteLength,
    },
  };
}

function sniffCoverImageType(body: Uint8Array): string | undefined {
  if (isJpeg(body)) {
    return "image/jpeg";
  }
  if (isPng(body)) {
    return "image/png";
  }
  if (isWebp(body)) {
    return "image/webp";
  }
  return undefined;
}

function isJpeg(body: Uint8Array): boolean {
  return body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
}

function isPng(body: Uint8Array): boolean {
  return (
    body.length >= 8 &&
    body[0] === 0x89 &&
    body[1] === 0x50 &&
    body[2] === 0x4e &&
    body[3] === 0x47 &&
    body[4] === 0x0d &&
    body[5] === 0x0a &&
    body[6] === 0x1a &&
    body[7] === 0x0a
  );
}

function isWebp(body: Uint8Array): boolean {
  if (body.length < 12) {
    return false;
  }
  const riff = String.fromCharCode(body[0], body[1], body[2], body[3]);
  const webp = String.fromCharCode(body[8], body[9], body[10], body[11]);
  return riff === "RIFF" && webp === "WEBP";
}

function normalizeDeclaredType(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.split(";")[0]?.trim().toLowerCase();
  if (!normalized || normalized === "application/octet-stream") {
    return undefined;
  }
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
}

function headerTypeMatches(
  sniffed: CoverImageContentType,
  headerType: string | undefined,
): boolean {
  if (!headerType) {
    return false;
  }
  if (sniffed === "image/jpeg") {
    return headerType === "jpg" || headerType === "jpeg";
  }
  if (sniffed === "image/png") {
    return headerType === "png";
  }
  return headerType === "webp";
}
