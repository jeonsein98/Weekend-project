import { getSupabaseServerConfig, uploadSupabaseStoryImage } from '../lib/supabaseServer.js';

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
    const imageBase64 = body?.imageBase64 || body?.image || body?.imageData || body?.image_data;
    if (typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: '이미지 데이터가 필요합니다.' });
    }
    const prefix = typeof body?.name === 'string'
      ? body.name
      : (typeof body?.studentName === 'string' ? body.studentName : 'photo');
    const url = await uploadSupabaseStoryImage(imageBase64, prefix);
    return res.status(200).json({ success: true, url });
  } catch (error) {
    console.error('[Supabase upload API] upload failed:', error);
    return res.status(400).json({ success: false, error: '지원되는 15MB 이하 이미지가 필요합니다.' });
  }
}
