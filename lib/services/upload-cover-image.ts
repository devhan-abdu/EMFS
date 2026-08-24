import { generateObjectKey } from "@/lib/services/storage";
import { processCoverImage } from "@/lib/services/process-cover-image";
import { coverFieldError, type FieldError } from "@/lib/validations/cover-image";
import type { StorageService } from "@/lib/services/storage/storage-service";

export type UploadCoverImageInput = {
  body: Uint8Array;
  declaredType?: string;
};

export type UploadCoverImageResult =
  | { ok: true; data: { key: string; publicUrl: string; contentType: string; extension: string; width: number; height: number; byteLength: number } }
  | { ok: false; errors: FieldError[] };

/**
 * Validate, process, generate a safe key, and upload a cover image via the
 * StorageService interface. This step intentionally does not create a Book.
 */
export async function uploadCoverImage(
  input: UploadCoverImageInput,
  storageService: StorageService,
): Promise<UploadCoverImageResult> {
  const processed = await processCoverImage({
    body: input.body,
    declaredType: input.declaredType,
  });

  if (!processed.ok) {
    return processed;
  }

  try {
    const key = generateObjectKey({ extension: processed.data.extension });
    const uploaded = await storageService.upload({
      key,
      body: processed.data.body,
      contentType: processed.data.contentType,
    });

    return {
      ok: true,
      data: {
        key: uploaded.key,
        publicUrl: uploaded.publicUrl,
        contentType: processed.data.contentType,
        extension: processed.data.extension,
        width: processed.data.width,
        height: processed.data.height,
        byteLength: processed.data.byteLength,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Object storage upload failed.";
    return {
      ok: false,
      errors: [coverFieldError("COVER_PROCESS_FAILED", message)],
    };
  }
}
