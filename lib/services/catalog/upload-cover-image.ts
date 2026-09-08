import { uploadToCloudinary } from "@/lib/services/catalog/cloudinary";
import { processCoverImage } from "@/lib/services/catalog/process-cover-image";
import { coverFieldError, type FieldError } from "@/lib/validations/cover-image";

export type UploadCoverImageInput = {
  body: Uint8Array;
  declaredType?: string;
};

export type UploadCoverImageResult =
  | {
      ok: true;
      data: {
        url: string;
        publicId: string;
        contentType: string;
        extension: string;
        width: number;
        height: number;
        byteLength: number;
      };
    }
  | { ok: false; errors: FieldError[] };

/**
 * Validate, process, upload a cover image to Cloudinary.
 * Returns a secure HTTPS URL suitable for storing in books.cover_url.
 */
export async function uploadCoverImage(
  input: UploadCoverImageInput,
): Promise<UploadCoverImageResult> {
  const processed = await processCoverImage({
    body: input.body,
    declaredType: input.declaredType,
  });

  if (!processed.ok) {
    return processed;
  }

  try {
    const uploaded = await uploadToCloudinary({
      body: processed.data.body,
      contentType: processed.data.contentType,
    });

    return {
      ok: true,
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        contentType: processed.data.contentType,
        extension: processed.data.extension,
        width: processed.data.width,
        height: processed.data.height,
        byteLength: processed.data.byteLength,
      },
    };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Cover upload failed", {
      code: "COVER_UPLOAD_FAILED",
      errorName,
      message: "Cloudinary upload failed",
    });

    return {
      ok: false,
      errors: [
        coverFieldError(
          "COVER_UPLOAD_FAILED",
          "Cover image could not be uploaded. Please try again.",
        ),
      ],
    };
  }
}
