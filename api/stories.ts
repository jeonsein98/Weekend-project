import {
  deleteSupabaseStory,
  fetchSupabaseStories,
  getSupabaseServerConfig,
  upsertSupabaseStories
} from '../lib/supabaseServer';

function normalizeStory(input: any) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const studentName = typeof input.studentName === 'string' ? input.studentName.trim() : '';
  if (!studentName || studentName.length > 80) return null;

  const id = typeof input.id === 'string' && input.id.trim()
    ? input.id.trim()
    : `story-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const imageUrls = Array.isArray(input.imageUrls)
    ? input.imageUrls.filter((url: unknown) => typeof url === 'string' && url.length > 0).slice(0, 3)
    : (typeof input.imageUrl === 'string' && input.imageUrl ? [input.imageUrl] : []);
  const createdAt = typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString();

  return {
    ...input,
    id,
    studentName,
    title: typeof input.title === 'string' ? input.title.slice(0, 200) : '',
    content: typeof input.content === 'string' ? input.content.slice(0, 10000) : '',
    imageUrls,
    imageUrl: imageUrls[0] || '',
    createdAt,
    updatedAt: new Date().toISOString()
  };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!getSupabaseServerConfig().isConfigured) {
    return res.status(503).json({ success: false, error: 'Supabase 서버 설정이 필요합니다.' });
  }

  try {
    if (req.method === 'GET') {
      const stories = await fetchSupabaseStories();
      return res.status(200).json({ success: true, stories, total: stories.length });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const story = normalizeStory(body);
      if (!story) {
        return res.status(400).json({ success: false, error: '유효한 원아 이름과 게시글이 필요합니다.' });
      }
      await upsertSupabaseStories([story]);
      const stories = await fetchSupabaseStories();
      return res.status(200).json({ success: true, story, stories });
    }

    if (req.method === 'DELETE') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) return res.status(400).json({ success: false, error: '게시글 ID가 필요합니다.' });
      await deleteSupabaseStory(id);
      const stories = await fetchSupabaseStories();
      return res.status(200).json({ success: true, stories });
    }

    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  } catch (error) {
    console.error('[Supabase stories API] operation failed:', error);
    return res.status(500).json({ success: false, error: '게시글 저장소 처리 중 오류가 발생했습니다.' });
  }
}
