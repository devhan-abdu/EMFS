import "server-only";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  StorageError,
  type StorageObject,
  type StorageService,
  type UploadObjectInput,
} from "./storage-service";

export type S3StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Origin used to build public URLs (no trailing slash). */
  publicBaseUrl: string;
};

/**
 * S3-compatible StorageService (MinIO locally; AWS S3 / R2 with the same shape).
 * SDK usage stays in this module — callers depend on StorageService only.
 */
export function createS3StorageService(config: S3StorageConfig): StorageService {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Required for MinIO and most local S3-compatible endpoints.
    forcePathStyle: true,
  });

  const publicBaseUrl = trimTrailingSlash(config.publicBaseUrl);
  let ready: Promise<void> | undefined;

  function ensureBucket(): Promise<void> {
    ready ??= createPublicReadBucket(client, config.bucket);
    return ready;
  }

  return {
    async upload(input: UploadObjectInput): Promise<StorageObject> {
      try {
        await ensureBucket();
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
          }),
        );
      } catch (error) {
        throw new StorageError(
          "UPLOAD_FAILED",
          error instanceof Error ? error.message : "Object upload failed.",
        );
      }

      return {
        key: input.key,
        publicUrl: buildPublicUrl(publicBaseUrl, config.bucket, input.key),
      };
    },

    async delete(key: string): Promise<void> {
      try {
        await ensureBucket();
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: key,
          }),
        );
      } catch (error) {
        throw new StorageError(
          "DELETE_FAILED",
          error instanceof Error ? error.message : "Object delete failed.",
        );
      }
    },

    getPublicUrl(key: string): string {
      return buildPublicUrl(publicBaseUrl, config.bucket, key);
    },
  };
}

async function createPublicReadBucket(
  client: S3Client,
  bucket: string,
): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch {
      // Another process may have created the bucket first (local MinIO).
    }
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }),
    }),
  );
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Path-style public URL: `{publicBaseUrl}/{bucket}/{key}`.
 * Matches MinIO defaults when the bucket (or objects) are publicly readable.
 */
function buildPublicUrl(
  publicBaseUrl: string,
  bucket: string,
  key: string,
): string {
  const normalizedKey = key.replace(/^\/+/, "");
  return `${publicBaseUrl}/${bucket}/${normalizedKey}`;
}
