import {
  createSupabaseStoryImageUpload,
  getSupabaseServerConfig
} from '../lib/supabaseServer.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }
  if (!getSupabaseServerConfig().isConfigured) {
    return res.status(503).json({ success: false, error: 'Supabase 서버 설정이 필요합니다.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const name = typeof body?.name === 'string' ? body.name : 'photo';
    const contentType = typeof body?.contentType === 'string' ? body.contentType : '';
    const size = Number(body?.size);
    const upload = await createSupabaseStoryImageUpload(name, contentType, size);
    return res.status(200).json({ success: true, ...upload });
  } catch (error) {
    console.error('[Supabase upload signature API] creation failed:', error);
    return res.status(400).json({ success: false, error: '지원되는 15MB 이하 이미지가 필요합니다.' });
  }
}
