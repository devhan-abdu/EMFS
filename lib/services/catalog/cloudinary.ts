import "server-only";

import crypto from "node:crypto";

export type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

const CLOUDINARY_HOST = "res.cloudinary.com";

export function readCloudinaryConfig(): CloudinaryConfig {
  return {
    cloudName: requiredEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requiredEnv("CLOUDINARY_API_KEY"),
    apiSecret: requiredEnv("CLOUDINARY_API_SECRET"),
    folder: process.env.CLOUDINARY_FOLDER?.trim() || "emfs-covers",
  };
}

export function isCloudinaryUrl(url: string): boolean {
  try {
    return new URL(url).hostname === CLOUDINARY_HOST;
  } catch {
    return false;
  }
}

export function publicIdFromCloudinaryUrl(url: string): string | null {
  if (!isCloudinaryUrl(url)) return null;

  try {
    const parsed = new URL(url);
    const marker = "/upload/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;

    const afterUpload = parsed.pathname.slice(idx + marker.length);
    const segments = afterUpload.split("/").filter(Boolean);
    const start =
      segments[0]?.startsWith("v") && /^v\d+$/.test(segments[0]) ? 1 : 0;
    const publicIdWithExt = segments.slice(start).join("/");
    return publicIdWithExt.replace(/\.[^.]+$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Upload processed cover bytes to Cloudinary and return the secure HTTPS URL.
 *
 * Uses Cloudinary's signed REST upload API (no SDK required). Prefer the
 * official `cloudinary` package when available for richer transform helpers.
 */
export async function uploadToCloudinary(
  input: { body: Uint8Array; contentType: string },
  config: CloudinaryConfig = readCloudinaryConfig(),
): Promise<CloudinaryUploadResult> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    folder: config.folder,
    timestamp,
  };
  const signature = signCloudinaryParams(params, config.apiSecret);

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([Buffer.from(input.body)], { type: input.contentType }),
  );
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", config.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status}).`);
  }

  const json: unknown = await response.json();
  if (
    !json ||
    typeof json !== "object" ||
    !("secure_url" in json) ||
    !("public_id" in json) ||
    typeof (json as { secure_url: unknown }).secure_url !== "string" ||
    typeof (json as { public_id: unknown }).public_id !== "string"
  ) {
    throw new Error("Cloudinary upload returned an unexpected payload.");
  }

  return {
    secureUrl: (json as { secure_url: string }).secure_url,
    publicId: (json as { public_id: string }).public_id,
  };
}

/**
 * Remove an orphaned Cloudinary asset. No-op for non-Cloudinary URLs.
 */
export async function deleteFromCloudinary(
  url: string,
  config: CloudinaryConfig = readCloudinaryConfig(),
): Promise<void> {
  const publicId = publicIdFromCloudinaryUrl(url);
  if (!publicId) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    public_id: publicId,
    timestamp,
  };
  const signature = signCloudinaryParams(params, config.apiSecret);

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", config.apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    throw new Error(`Cloudinary delete failed (${response.status}).`);
  }
}

export async function countOrphanedCloudinaryAssets(
  referencedUrls: string[],
  config?: CloudinaryConfig,
): Promise<number | null> {
  let resolvedConfig: CloudinaryConfig;
  try {
    resolvedConfig = config ?? readCloudinaryConfig();
  } catch {
    return null;
  }

  const referencedPublicIds = new Set(
    referencedUrls
      .map(publicIdFromCloudinaryUrl)
      .filter((publicId): publicId is string => Boolean(publicId)),
  );
  let nextCursor: string | undefined;
  let orphanedCount = 0;

  do {
    const params = new URLSearchParams({
      prefix: resolvedConfig.folder,
      max_results: "500",
    });
    if (nextCursor) params.set("next_cursor", nextCursor);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${resolvedConfig.cloudName}/resources/image/upload?${params.toString()}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${resolvedConfig.apiKey}:${resolvedConfig.apiSecret}`).toString("base64")}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Cloudinary resource listing failed (${response.status}).`,
      );
    }

    const json: unknown = await response.json();
    if (!json || typeof json !== "object") {
      throw new Error(
        "Cloudinary resource listing returned an unexpected payload.",
      );
    }

    const payload = json as {
      resources?: Array<{ public_id?: unknown }>;
      next_cursor?: unknown;
    };
    for (const resource of payload.resources ?? []) {
      if (
        typeof resource.public_id === "string" &&
        !referencedPublicIds.has(resource.public_id)
      ) {
        orphanedCount += 1;
      }
    }
    nextCursor =
      typeof payload.next_cursor === "string" ? payload.next_cursor : undefined;
  } while (nextCursor);

  return orphanedCount;
}

function signCloudinaryParams(
  params: Record<string, string>,
  apiSecret: string,
): string {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(`${payload}${apiSecret}`)
    .digest("hex");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill in Cloudinary placeholders.`,
    );
  }
  return value;
}
