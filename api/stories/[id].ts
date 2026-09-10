import { deleteSupabaseStory, fetchSupabaseStories, getSupabaseServerConfig } from '../../lib/supabaseServer';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  if (!getSupabaseServerConfig().isConfigured) {
    return res.status(503).json({ success: false, error: 'Supabase 서버 설정이 필요합니다.' });
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ success: false, error: '게시글 ID가 필요합니다.' });

  try {
    await deleteSupabaseStory(id);
    const stories = await fetchSupabaseStories();
    return res.status(200).json({ success: true, stories });
  } catch (error) {
    console.error('[Supabase stories API] delete failed:', error);
    return res.status(500).json({ success: false, error: '게시글 삭제 중 오류가 발생했습니다.' });
  }
}
