import { COVER_IMAGE_OUTPUT_EXTENSION } from "@/lib/validations/cover-image";

export const COVER_OBJECT_KEY_PREFIX = "covers";

/**
 * Safe, unique object key. Does not use the original filename (path traversal /
 * overwrite risk). Provider adapters must not invent a different key scheme.
 */
export function generateObjectKey(options?: {
  prefix?: string;
  extension?: string;
}): string {
  const prefix = sanitizePathSegment(options?.prefix ?? COVER_OBJECT_KEY_PREFIX);
  const id = crypto.randomUUID();
  const extension = sanitizeExtension(options?.extension);

  return extension ? `${prefix}/${id}.${extension}` : `${prefix}/${id}`;
}

/**
 * Cover keys never take a user filename or caller-supplied path.
 * Prefix and extension are fixed to the processed WebP output.
 */
export function generateCoverObjectKey(): string {
  return generateObjectKey({
    prefix: COVER_OBJECT_KEY_PREFIX,
    extension: COVER_IMAGE_OUTPUT_EXTENSION,
  });
}

function sanitizePathSegment(value: string): string {
  const segment = value.replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  return segment.length > 0 ? segment : COVER_OBJECT_KEY_PREFIX;
}

function sanitizeExtension(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  const extension = value.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return extension.length > 0 ? extension : undefined;
}
