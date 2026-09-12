import { randomUUID } from 'node:crypto';

const STORIES_TABLE = 'weekend_stories';

export interface SupabaseServerConfig {
  url: string;
  key: string;
  isConfigured: boolean;
}

function normalizeSupabaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z0-9]{20}$/i.test(trimmed)) return `https://${trimmed}.supabase.co`;
  return trimmed;
}

export function getSupabaseServerConfig(): SupabaseServerConfig {
  const url = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  );
  const key = (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || ''
  ).trim();
  return { url, key, isConfigured: Boolean(url && key) };
}

function getHeaders(config: SupabaseServerConfig, extra?: Record<string, string>) {
  return { apikey: config.key, Authorization: `Bearer ${config.key}`, ...extra };
}

async function assertResponse(response: Response, operation: string): Promise<void> {
  if (response.ok) return;
  throw new Error(`Supabase ${operation} failed (${response.status})`);
}

export async function fetchSupabaseStories(): Promise<any[]> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');
  const response = await fetch(
    `${config.url}/rest/v1/${STORIES_TABLE}?select=id,story,created_at&order=created_at.desc`,
    { headers: getHeaders(config), cache: 'no-store' }
  );
  await assertResponse(response, 'story read');
  const rows = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.map((row: any) => {
    if (!row || typeof row.story !== 'object' || Array.isArray(row.story)) return null;
    return { ...row.story, id: row.id, createdAt: row.story.createdAt || row.created_at };
  }).filter(Boolean);
}

export async function upsertSupabaseStories(stories: any[]): Promise<void> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');
  const now = new Date().toISOString();
  const rows = stories.filter((story) => story && typeof story.id === 'string' && story.id.trim()).map((story) => ({
    id: story.id,
    story,
    created_at: story.createdAt || now,
    updated_at: story.updatedAt || now
  }));
  if (rows.length === 0) return;
  const response = await fetch(`${config.url}/rest/v1/${STORIES_TABLE}?on_conflict=id`, {
    method: 'POST',
    headers: getHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    }),
    body: JSON.stringify(rows)
  });
  await assertResponse(response, 'story write');
}

export async function deleteSupabaseStory(id: string): Promise<void> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');
  const response = await fetch(`${config.url}/rest/v1/${STORIES_TABLE}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders(config)
  });
  await assertResponse(response, 'story delete');
}

export async function incrementSupabaseStoryReaction(id: string, emoji: string): Promise<void> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');
  const response = await fetch(`${config.url}/rest/v1/rpc/increment_weekend_story_reaction`, {
    method: 'POST',
    headers: getHeaders(config, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ p_story_id: id, p_emoji: emoji })
  });
  await assertResponse(response, 'reaction update');
}

export async function uploadSupabaseStoryImage(dataUrl: string, prefix = 'photo'): Promise<string> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported image data');
  const mime = match[1];
  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const body = Buffer.from(match[2], 'base64');
  if (body.length === 0 || body.length > 15 * 1024 * 1024) throw new Error('Image size is invalid');

  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'photo';
  const objectPath = `story-images/${safePrefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || 'stories').trim();
  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: getHeaders(config, { 'Content-Type': mime, 'x-upsert': 'false' }),
    body
  });
  await assertResponse(response, 'image upload');
  return `${config.url}/storage/v1/object/public/${bucket}/${objectPath}`;
}

export interface SupabaseSignedImageUpload {
  signedUrl: string;
  publicUrl: string;
  path: string;
}

export async function createSupabaseStoryImageUpload(
  prefix: string,
  mime: string,
  size: number
): Promise<SupabaseSignedImageUpload> {
  const config = getSupabaseServerConfig();
  if (!config.isConfigured) throw new Error('Supabase server configuration is missing');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    throw new Error('Unsupported image type');
  }
  if (!Number.isFinite(size) || size <= 0 || size > 15 * 1024 * 1024) {
    throw new Error('Image size is invalid');
  }

  const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'photo';
  const objectPath = `story-images/${safePrefix}-${Date.now()}-${randomUUID()}.${extension}`;
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const bucket = (process.env.SUPABASE_STORAGE_BUCKET || 'stories').trim();
  const storageApiUrl = `${config.url}/storage/v1`;

  const response = await fetch(`${storageApiUrl}/object/upload/sign/${encodeURIComponent(bucket)}/${encodedPath}`, {
    method: 'POST',
    headers: getHeaders(config, { 'Content-Type': 'application/json' }),
    body: '{}'
  });
  await assertResponse(response, 'signed image upload creation');

  const payload = await response.json();
  const relativeSignedUrl = typeof payload?.url === 'string' ? payload.url : '';
  if (!relativeSignedUrl) throw new Error('Supabase signed upload URL is missing');

  const signedUrl = /^https?:\/\//i.test(relativeSignedUrl)
    ? relativeSignedUrl
    : `${storageApiUrl}${relativeSignedUrl.startsWith('/') ? '' : '/'}${relativeSignedUrl}`;

  return {
    signedUrl,
    publicUrl: `${storageApiUrl}/object/public/${encodeURIComponent(bucket)}/${encodedPath}`,
    path: objectPath
  };
}
