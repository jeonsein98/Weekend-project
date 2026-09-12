const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const DIRECT_UPLOAD_CACHE_SECONDS = '31536000';

interface SignedUploadResponse {
  success?: boolean;
  signedUrl?: string;
  publicUrl?: string;
  path?: string;
  error?: string;
}

export interface UploadedPhoto {
  url: string;
  path?: string;
  usedLegacyFallback: boolean;
}

function safeFilename(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return `${cleaned || 'photo'}.jpg`;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.error || `${fallback} (${response.status})`);
}

async function uploadDirectlyToSupabase(blob: Blob, name: string): Promise<UploadedPhoto> {
  const signatureResponse = await fetch('/api/upload-signature', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      contentType: blob.type || 'image/jpeg',
      size: blob.size
    })
  });

  if (!signatureResponse.ok) {
    throw await responseError(signatureResponse, '업로드 권한을 만들 수 없습니다.');
  }

  const signature = await signatureResponse.json() as SignedUploadResponse;
  if (!signature.signedUrl || !signature.publicUrl) {
    throw new Error('업로드 권한 응답이 올바르지 않습니다.');
  }

  // Supabase Storage's browser upload format keeps the JPEG binary intact.
  const formData = new FormData();
  formData.append('cacheControl', DIRECT_UPLOAD_CACHE_SECONDS);
  formData.append('', blob, safeFilename(name));

  const uploadResponse = await fetch(signature.signedUrl, {
    method: 'PUT',
    headers: { 'x-upsert': 'false' },
    body: formData
  });

  if (!uploadResponse.ok) {
    throw await responseError(uploadResponse, 'Supabase 사진 업로드에 실패했습니다.');
  }

  return {
    url: signature.publicUrl,
    path: signature.path,
    usedLegacyFallback: false
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('사진을 변환할 수 없습니다.'));
    reader.readAsDataURL(blob);
  });
}

async function uploadThroughLegacyProxy(blob: Blob, name: string): Promise<UploadedPhoto> {
  const imageBase64 = await blobToDataUrl(blob);
  const response = await fetch('/api/upload-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, name })
  });

  if (!response.ok) {
    throw await responseError(response, '사진 업로드에 실패했습니다.');
  }

  const payload = await response.json();
  if (typeof payload?.url !== 'string' || !payload.url.startsWith('http')) {
    throw new Error('사진 업로드 주소를 받지 못했습니다.');
  }

  return { url: payload.url, usedLegacyFallback: true };
}

export async function uploadOptimizedPhoto(blob: Blob, name: string): Promise<UploadedPhoto> {
  if (!blob || !blob.size || blob.size > MAX_IMAGE_BYTES) {
    throw new Error('지원되는 15MB 이하 이미지만 업로드할 수 있습니다.');
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
    throw new Error('지원하지 않는 이미지 형식입니다.');
  }

  try {
    return await uploadDirectlyToSupabase(blob, name);
  } catch (directError) {
    console.warn('[PhotoUpload] Direct upload failed; trying the compatibility route:', directError);
    return uploadThroughLegacyProxy(blob, name);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
