import "server-only";

import { createS3StorageService } from "./s3-storage-service";
import type { StorageService } from "./storage-service";

let storageService: StorageService | undefined;

/**
 * Process-wide StorageService. Callers depend on the interface only.
 * Swap the adapter inside this factory — do not import the S3 SDK elsewhere.
 */
export function getStorageService(): StorageService {
  if (!storageService) {
    storageService = createS3StorageService(readS3StorageConfig());
  }
  return storageService;
}

function readS3StorageConfig() {
  return {
    endpoint: requiredEnv("S3_ENDPOINT"),
    region: requiredEnv("S3_REGION"),
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    bucket: requiredEnv("S3_BUCKET"),
    publicBaseUrl: requiredEnv("S3_PUBLIC_BASE_URL"),
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env and fill in storage placeholders.`,
    );
  }
  return value;
}
