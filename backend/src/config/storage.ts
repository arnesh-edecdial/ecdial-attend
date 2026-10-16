import 'dotenv/config';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const endpoint = process.env.B2_ENDPOINT;
const region = process.env.B2_REGION;
const accessKeyId = process.env.B2_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY;
const bucketName = process.env.B2_BUCKET_NAME;

if (!endpoint) throw new Error('B2_ENDPOINT is not configured. Check backend/.env');
if (!region) throw new Error('B2_REGION is not configured. Check backend/.env');
if (!accessKeyId) throw new Error('B2_KEY_ID is not configured. Check backend/.env');
if (!secretAccessKey) throw new Error('B2_APPLICATION_KEY is not configured. Check backend/.env');
if (!bucketName) throw new Error('B2_BUCKET_NAME is not configured. Check backend/.env');

export const B2_BUCKET_NAME = bucketName;
export const B2_IMAGE_PREFIX = 'service-intakes';
export const B2_SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;

export const storageClient = new S3Client({
  region,
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

// Keep a short-lived in-process cache so reopening/refreshing an intake does
// not generate a different signed URL every time. The bucket remains private.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_CACHE_MS = 5 * 60 * 1000;

export async function createB2ImageDownloadUrl(
  storageFileName: string,
  expiresIn = B2_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(storageFileName);
  if (cached && cached.expiresAt > now) return cached.url;

  const command = new GetObjectCommand({
    Bucket: B2_BUCKET_NAME,
    Key: `${B2_IMAGE_PREFIX}/${storageFileName}`,
  });

  const url = await getSignedUrl(storageClient, command, { expiresIn });
  signedUrlCache.set(storageFileName, {
    url,
    expiresAt: now + Math.min(SIGNED_URL_CACHE_MS, (expiresIn - 60) * 1000),
  });
  return url;
}

export const B2_PRODUCT_IMAGE_PREFIX = 'products';

export async function createB2ProductImageDownloadUrl(
  storageFileName: string,
  expiresIn = B2_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
  const now = Date.now();
  const cached = signedUrlCache.get(`prod_${storageFileName}`);
  if (cached && cached.expiresAt > now) return cached.url;

  const command = new GetObjectCommand({
    Bucket: B2_BUCKET_NAME,
    Key: `${B2_PRODUCT_IMAGE_PREFIX}/${storageFileName}`,
  });

  const url = await getSignedUrl(storageClient, command, { expiresIn });
  signedUrlCache.set(`prod_${storageFileName}`, {
    url,
    expiresAt: now + Math.min(SIGNED_URL_CACHE_MS, (expiresIn - 60) * 1000),
  });
  return url;
}

export function clearB2ImageDownloadUrlCache(storageFileName?: string) {
  if (storageFileName) {
    signedUrlCache.delete(storageFileName);
    signedUrlCache.delete(`prod_${storageFileName}`);
  } else {
    signedUrlCache.clear();
  }
}
