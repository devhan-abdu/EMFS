/**
 * Provider-agnostic object-storage contract.
 *
 * Callers (catalog/book workflows) depend on this type only — never on an SDK.
 * A MinIO, R2, or S3 adapter implements the same methods.
 */

export type StorageObject = {
  /** Object key stored in the database (e.g. books.cover_url may hold key or public URL). */
  key: string;
  /** Public HTTPS (or local) URL for approved objects. Never includes credentials. */
  publicUrl: string;
};

export type UploadObjectInput = {
  key: string;
  body: Uint8Array;
  contentType: string;
};

export type StorageErrorCode = "UPLOAD_FAILED" | "DELETE_FAILED";

export class StorageError extends Error {
  code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface StorageService {
  /**
   * Persist bytes at `key`. Returns the key and a public-read URL.
   * Credentials stay in the adapter; they must not appear in the return value.
   */
  upload(input: UploadObjectInput): Promise<StorageObject>;

  /**
   * Remove an object by key. Used to drop orphaned uploads if a parent
   * transaction (e.g. book insert) fails.
   */
  delete(key: string): Promise<void>;

  /**
   * Derive the public URL for a key without a network call.
   * Display/read paths use this; they never need the SDK.
   */
  getPublicUrl(key: string): string;
}
