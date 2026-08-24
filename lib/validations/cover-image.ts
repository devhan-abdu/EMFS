import { z } from "zod";

/**
 * Book-cover upload limits. SSOT:
 * `docs/domain/curriculum-and-pacing.md` → Cover upload constraints (V1).
 */
export const COVER_IMAGE_FIELD = "cover";

export const COVER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const COVER_IMAGE_MIN_DIMENSION_PX = 200;
export const COVER_IMAGE_MAX_DIMENSION_PX = 4096;
/** Sharp decode cap — see Cover processing (V1). */
export const COVER_IMAGE_MAX_INPUT_PIXELS = 8192 * 8192;
export const COVER_IMAGE_OUTPUT_QUALITY = 80;
export const COVER_IMAGE_OUTPUT_CONTENT_TYPE = "image/webp" as const;
export const COVER_IMAGE_OUTPUT_EXTENSION = "webp" as const;

export const COVER_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CoverImageContentType = (typeof COVER_IMAGE_CONTENT_TYPES)[number];

export const coverImageContentTypeSchema = z.enum(COVER_IMAGE_CONTENT_TYPES);

export const coverImageByteLengthSchema = z
  .number()
  .int()
  .positive()
  .max(COVER_IMAGE_MAX_BYTES);

export type FieldError = {
  field: string;
  message: string;
  code: string;
};

export type CoverImageErrorCode =
  | "COVER_EMPTY"
  | "COVER_TOO_LARGE"
  | "COVER_TYPE_INVALID"
  | "COVER_TYPE_MISMATCH"
  | "COVER_UNREADABLE"
  | "COVER_DIMENSIONS_TOO_SMALL"
  | "COVER_DIMENSIONS_TOO_LARGE"
  | "COVER_PROCESS_FAILED";

export type ApprovedCoverImage = {
  contentType: CoverImageContentType;
  extension: "jpg" | "png" | "webp";
  width: number;
  height: number;
  byteLength: number;
};

export type CoverImageProcessResult =
  | { ok: true; data: ProcessedCoverImage }
  | { ok: false; errors: FieldError[] };

export type ProcessedCoverImage = {
  body: Uint8Array;
  contentType: typeof COVER_IMAGE_OUTPUT_CONTENT_TYPE;
  extension: typeof COVER_IMAGE_OUTPUT_EXTENSION;
  width: number;
  height: number;
  byteLength: number;
};

export function coverFieldError(
  code: CoverImageErrorCode,
  message: string,
): FieldError {
  return { field: COVER_IMAGE_FIELD, message, code };
}
