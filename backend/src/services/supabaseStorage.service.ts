import 'dotenv/config';

/**
 * Catalogue PDFs live in a private Supabase Storage bucket.
 * The browser uploads straight to Supabase with a one-time signed upload URL, so the file never
 * passes through this server (serverless request bodies are capped at ~4.5 MB).
 *
 * Required env:  SUPABASE_SERVICE_ROLE_KEY   (server only, never ship to a client)
 * Optional env:  SUPABASE_URL                (derived from DATABASE_URL when omitted)
 *                SUPABASE_CATALOGUE_BUCKET   (default "catalogues")
 *                CATALOGUE_MAX_MB            (default 50 = Supabase free-plan global limit)
 */
const deriveUrl = () => {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL.replace(/\/+$/, '');
  const ref = process.env.DATABASE_URL?.match(/postgres\.([a-z0-9]+):/i)?.[1];
  return ref ? `https://${ref}.supabase.co` : '';
};

export const SUPABASE_URL = deriveUrl();
export const CATALOGUE_BUCKET = process.env.SUPABASE_CATALOGUE_BUCKET || 'catalogues';
const CONFIGURED_MAX_BYTES = Number(process.env.CATALOGUE_MAX_MB || 50) * 1024 * 1024;
const SIGNED_DOWNLOAD_TTL = 60 * 60;

const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const api = (p: string) => `${SUPABASE_URL}/storage/v1${p}`;
const headers = () => ({ Authorization: `Bearer ${key()}`, apikey: key(), 'Content-Type': 'application/json' });
const encPath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export const supabaseConfigured = () => Boolean(SUPABASE_URL && key());

let bucketLimit: number | null | undefined; // undefined = not checked yet, null = project default
let bucketReady: Promise<void> | null = null;

/** Make sure the bucket exists (private, PDF only) and remember its real size limit. */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const get = await fetch(api(`/bucket/${CATALOGUE_BUCKET}`), { headers: headers() });
      if (get.ok) {
        const b: any = await get.json();
        bucketLimit = b.file_size_limit ?? null;
        return;
      }
      const create = await fetch(api('/bucket'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          id: CATALOGUE_BUCKET,
          name: CATALOGUE_BUCKET,
          public: false,
          file_size_limit: CONFIGURED_MAX_BYTES,
          allowed_mime_types: ['application/pdf'],
        }),
      });
      if (!create.ok) throw new Error(`Could not create bucket: ${await create.text()}`);
      bucketLimit = CONFIGURED_MAX_BYTES;
    })().catch((e) => {
      bucketReady = null; // retry on next request
      throw e;
    });
  }
  return bucketReady;
}

/** Effective per-file limit in bytes (bucket limit when set, otherwise the configured maximum). */
export const maxUploadBytes = () => (bucketLimit ? Math.min(bucketLimit, CONFIGURED_MAX_BYTES) : CONFIGURED_MAX_BYTES);

export async function createSignedUploadUrl(path: string): Promise<{ uploadUrl: string; token: string }> {
  const r = await fetch(api(`/object/upload/sign/${CATALOGUE_BUCKET}/${encPath(path)}`), {
    method: 'POST',
    headers: headers(),
  });
  if (!r.ok) throw new Error(`Could not create upload URL: ${await r.text()}`);
  const j: any = await r.json();
  const token = new URL(j.url, SUPABASE_URL).searchParams.get('token') || j.token;
  return { uploadUrl: api(`/object/upload/sign/${CATALOGUE_BUCKET}/${encPath(path)}?token=${token}`), token };
}

/** Size in bytes of an uploaded object, or null when it does not exist. */
export async function getObjectSize(path: string): Promise<number | null> {
  const r = await fetch(api(`/object/info/${CATALOGUE_BUCKET}/${encPath(path)}`), { headers: headers() });
  if (!r.ok) return null;
  const j: any = await r.json();
  return Number(j.size ?? j.metadata?.size ?? 0) || 0;
}

export async function createSignedDownloadUrl(path: string, filename?: string): Promise<string | null> {
  const r = await fetch(api(`/object/sign/${CATALOGUE_BUCKET}/${encPath(path)}`), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ expiresIn: SIGNED_DOWNLOAD_TTL }),
  });
  if (!r.ok) return null;
  const j: any = await r.json();
  const signed = String(j.signedURL || j.signedUrl || '');
  if (!signed) return null;
  const url = signed.startsWith('http') ? signed : api(signed.replace(/^\/?storage\/v1/, ''));
  return filename ? `${url}&download=${encodeURIComponent(filename)}` : url;
}

export async function deleteObject(path: string): Promise<void> {
  const r = await fetch(api(`/object/${CATALOGUE_BUCKET}`), {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!r.ok) console.warn('[Supabase delete warning]', await r.text());
}
