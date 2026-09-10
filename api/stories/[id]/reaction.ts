import {
  fetchSupabaseStories,
  getSupabaseServerConfig,
  incrementSupabaseStoryReaction
} from '../../../lib/supabaseServer';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  if (!getSupabaseServerConfig().isConfigured) {
    return res.status(503).json({ success: false, error: 'Supabase 서버 설정이 필요합니다.' });
  }

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  const emoji = typeof req.body?.emoji === 'string' ? req.body.emoji : '';
  if (!id || !emoji || emoji.length > 16) {
    return res.status(400).json({ success: false, error: '유효한 게시글과 반응이 필요합니다.' });
  }

  try {
    await incrementSupabaseStoryReaction(id, emoji);
    const updatedStories = await fetchSupabaseStories();
    const reactions = updatedStories.find((story) => story.id === id)?.reactions || {};
    return res.status(200).json({ success: true, reactions, stories: updatedStories });
  } catch (error) {
    console.error('[Supabase stories API] reaction failed:', error);
    return res.status(500).json({ success: false, error: '반응 저장 중 오류가 발생했습니다.' });
  }
}
