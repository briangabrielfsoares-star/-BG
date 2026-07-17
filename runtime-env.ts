export type StoredObject = {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

export type BucketBinding = {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }): Promise<unknown>;
  get(key: string): Promise<StoredObject | null>;
};

export type RuntimeBindings = {
  DB?: unknown;
  BUCKET?: BucketBinding;
  ADMIN_PASSWORD_HASH?: string;
  ADMIN_SESSION_SECRET?: string;
  [key: string]: unknown;
};

export function getRuntimeBindings() {
  return (globalThis as unknown as { __BGDROP_ENV?: RuntimeBindings }).__BGDROP_ENV ?? {};
}
