import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body payload limit for image base64 uploads (up to 100mb for ultra high-res mobile photos)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Persistent Storage Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const STORIES_BACKUP_FILE = path.join(DATA_DIR, 'stories.backup.json');
const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const ROSTER_BACKUP_FILE = path.join(DATA_DIR, 'roster.backup.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Statically serve uploaded photos so they load lightning fast & permanently
app.use('/uploads', express.static(UPLOADS_DIR));

const DEFAULT_INITIAL_STORIES = [
  {
    id: 'demo-eunsol',
    week: '9월 1주차(방학지낸이야기)',
    studentName: '김은솔',
    parentPin: '1234',
    title: '신나는 여름방학 동해 바다 체험과 우리가족 모래성 쌓기',
    content: '안녕하세요! 은솔이네 가족의 즐거웠던 여름방학 주말 이야기입니다.\n\n방학 동안 은솔이와 함께 동해 바다로 여름 휴가를 다녀왔어요. 바닷가에서 맑은 파도 소리도 듣고, 아빠 엄마와 힘을 합쳐 커다란 인어공주 모래성도 만들었답니다. 조개껍데기를 주워서 모래성을 예쁘게 꾸미는 동안 은솔이 얼굴에 웃음꽃이 피어났어요. 저녁에는 신선한 해산물도 맛있게 먹고 밤하늘의 반짝이는 별도 관찰하며 소중한 추억을 가득 쌓았습니다.\n\n우리 유치원 친구들도 방학 동안 모두 건강하고 즐겁게 보냈기를 바라요! 💕',
    imageUrls: [
      '/uploads/eunsol_beach_laugh.jpg',
      '/uploads/eunsol_sandcastle.jpg',
      '/uploads/eunsol_family_sunset.jpg'
    ],
    imageCaptions: [
      '파도가 넘실거리는 에메랄드빛 동해 바닷가에서 찰칵! 🌊',
      '조개껍데기로 예쁘게 꾸민 커다란 모래성 앞에서 포즈 🏰',
      '노을 지는 해변을 걸으며 가족과 함께 나누는 소중한 행복 🌅'
    ],
    aiComment: '자연 속에서 가족과의 따뜻한 사랑과 협동심을 배운 최고의 여름방학 이야기입니다! 조개껍데기로 꾸민 모래성이 정말 동화 속 풍경 같아요. ✨🐚🌊',
    createdAt: new Date().toISOString(),
    reactions: { '❤️': 24, '👏': 18, '⭐': 15 }
  }
];

export const DEFAULT_INITIAL_ROSTER = [
  { id: 'roster-es-1', name: '강루하', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-2', name: '김강모', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-3', name: '김강민', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-4', name: '김도희', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-5', name: '김리한', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-6', name: '김재하', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-7', name: '김이찬', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-8', name: '문시안', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-9', name: '박지안', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-10', name: '박지우', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-11', name: '서채연', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-12', name: '안세은', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-13', name: '안지유', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-14', name: '엄소율', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-15', name: '임하윤', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-16', name: '최인율', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-17', name: '하시윤', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' },
  { id: 'roster-es-18', name: '하시훈', className: '은솔1반', parentPin: '1234', note: '은솔1반 원아' }
];

const BANNED_MOCK_STORY_IDS = new Set([
  'demo-1',
  'demo-2',
  'demo-3',
  'demo-4',
  'story-luha',
  'story-dohee'
]);

function readStories(): any[] {
  try {
    if (fs.existsSync(STORIES_FILE)) {
      const data = fs.readFileSync(STORIES_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
        if (filtered.length !== parsed.length) {
          writeStories(filtered);
        }
        return filtered.length > 0 ? filtered : DEFAULT_INITIAL_STORIES;
      }
    }
  } catch (err) {
    console.error('Error reading stories file, checking backup:', err);
    try {
      if (fs.existsSync(STORIES_BACKUP_FILE)) {
        const backupData = fs.readFileSync(STORIES_BACKUP_FILE, 'utf-8');
        const parsedBackup = JSON.parse(backupData);
        if (Array.isArray(parsedBackup)) {
          const filtered = parsedBackup.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
          return filtered.length > 0 ? filtered : DEFAULT_INITIAL_STORIES;
        }
      }
    } catch (bErr) {
      console.error('Backup read failed:', bErr);
    }
  }
  writeStories(DEFAULT_INITIAL_STORIES);
  return DEFAULT_INITIAL_STORIES;
}

function writeStories(stories: any[]): boolean {
  try {
    const jsonStr = JSON.stringify(stories, null, 2);
    fs.writeFileSync(STORIES_FILE, jsonStr, 'utf-8');
    fs.writeFileSync(STORIES_BACKUP_FILE, jsonStr, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write stories to disk:', err);
    return false;
  }
}

function readRoster(): any[] {
  try {
    if (fs.existsSync(ROSTER_FILE)) {
      const data = fs.readFileSync(ROSTER_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read roster, checking backup:', err);
    try {
      if (fs.existsSync(ROSTER_BACKUP_FILE)) {
        const backupData = fs.readFileSync(ROSTER_BACKUP_FILE, 'utf-8');
        const parsedBackup = JSON.parse(backupData);
        if (Array.isArray(parsedBackup) && parsedBackup.length > 0) {
          return parsedBackup;
        }
      }
    } catch (bErr) {
      console.error('Failed to read roster backup:', bErr);
    }
  }
  writeRoster(DEFAULT_INITIAL_ROSTER);
  return DEFAULT_INITIAL_ROSTER;
}

function writeRoster(roster: any[]): boolean {
  try {
    const jsonStr = JSON.stringify(roster, null, 2);
    fs.writeFileSync(ROSTER_FILE, jsonStr, 'utf-8');
    fs.writeFileSync(ROSTER_BACKUP_FILE, jsonStr, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write roster:', err);
    return false;
  }
}

function saveBase64Image(base64Str: string, prefix = 'photo'): string {
  if (!base64Str || typeof base64Str !== 'string') return '';
  if (!base64Str.startsWith('data:image/')) {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) {
      return base64Str;
    }
    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const buffer = Buffer.from(matches[2], 'base64');
    const safePrefix = prefix.replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    const filename = `${safePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving image to disk:', err);
    return base64Str;
  }
}

function processStoryImages(story: any): any {
  const cloned = { ...story };
  let urls = Array.isArray(cloned.imageUrls) ? [...cloned.imageUrls] : (cloned.imageUrl ? [cloned.imageUrl] : []);
  urls = urls.map((url: string, idx: number) => {
    if (typeof url === 'string' && url.startsWith('data:image/')) {
      return saveBase64Image(url, `story_${cloned.studentName || 'child'}_${idx + 1}`);
    }
    return url;
  });
  cloned.imageUrls = urls;
  cloned.imageUrl = urls[0] || '';
  return cloned;
}

// Initialize Gemini API client on the server side
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY environment variable is not defined.');
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Health Check API
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Gemini AI Assistant API Endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { studentName, title, content, week, imageBase64, mimeType } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback response when GEMINI_API_KEY is not configured
      return res.json({
        success: true,
        aiComment: `${studentName || '학생'}의 주말 이야기를 읽어보니 참 흥미롭군요! 주말 경험을 솔직하게 기록하고 관찰한 점이 인상 깊습니다. 🌟`
      });
    }

    const systemInstruction = `
너는 대한민국 유치원 다정하고 사랑스러운 교사(선생님)야.
유치원 학부모님께서 제출하신 유아의 '주말 지낸 이야기' 사진과 글을 보고, 다음과 같은 원칙으로 1~2문장의 따뜻하고 인상적인 교육적 한 줄 평(칭찬/소감)을 작성해줘:
1. 유아의 이름(예: OOO 어린이)을 꼭 포함하여 다정하고 정답게 다가갈 것.
2. 유아의 주말 놀이 및 활동 속에서 감성, 신체발달, 가족과의 유대감, 오감 체험, 생명 존중 등 유치원 누리과정 관점의 긍정적 의미를 찾아 밝게 칭찬할 것.
3. 알맞은 감성 이모지(🌸, 🐶, 🎈, 🧸, 🌿 등)를 1~2개 곁들일 것.
4. 부드럽고 다정한 존댓말(~했군요, ~이에요)을 사용할 것.
    `.trim();

    const textPrompt = `
[학생 정보 및 주말 이야기]
- 주차: ${week || '이번 주'}
- 학생 이름: ${studentName || '학생'}
- 제목: ${title || '주말 지낸 이야기'}
- 학생이 쓴 내용: ${content || '주말에 재미있는 일을 했습니다.'}

위 내용과 함께 첨부된 이미지(있는 경우)를 참고하여, 교사가 학생에게 전해줄 격려와 칭찬의 한 줄 평(교육적 소감)을 2문장 이내로 작성해주세요.
    `.trim();

    const contentsParts: any[] = [];

    // Add Image part if base64 provided
    if (imageBase64 && typeof imageBase64 === 'string') {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contentsParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg'
        }
      });
    }

    contentsParts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contentsParts.length === 1 ? contentsParts[0].text : { parts: contentsParts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        topP: 0.9
      }
    });

    const aiComment = response.text ? response.text.trim() : `${studentName} 학생의 알차고 보람찬 주말 이야기였네요! 최고예요! 👍`;

    return res.json({
      success: true,
      aiComment: aiComment
    });
  } catch (error: any) {
    console.error('Gemini API execution error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Gemini API 호출 중 오류가 발생했습니다.',
      fallbackComment: '주말 경험을 솔직하게 기록하여 친구들과 나누는 따뜻한 마음이 돋보입니다! ✨'
    });
  }
});

// Gemini AI Photo Caption Recommendation Endpoint
app.post('/api/gemini-caption-recommendation', async (req, res) => {
  try {
    const { studentName, title, content, imageBase64, photoIndex } = req.body;

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackCaptions = [
        '가족과 함께 즐거운 신나는 주말 경험! 🎈',
        '직접 체험하며 찍은 멋진 스냅 사진 📸',
        '행복한 웃음이 가득한 순간 🌟'
      ];
      return res.json({
        success: true,
        caption: fallbackCaptions[(photoIndex || 0) % fallbackCaptions.length]
      });
    }

    const systemInstruction = `
너는 유치원 어린이 주말 이야기 앨범의 사진 설명 코멘트를 추천해주는 AI 조교야.
학부모님이 올리신 사진과 이야기 주제를 보고, 그 사진에 어울리는 자연스럽고 사랑스러운 한 문장의 코멘트(15자~35자 내외)를 추천해줘.
원칙:
1. 사진 속 생생한 감정이나 구체적인 장면 표현을 담을 것.
2. 예쁜 어조(~하는 모습, ~한 신나는 순간, ~했어요)와 알맞은 이모지 1개 사용.
3. 오직 1문장의 코멘트만 깔끔하게 출력할 것.
    `.trim();

    const textPrompt = `
- 어린이 이름: ${studentName || 'OOO'}
- 주말 이야기 제목: ${title || '주말 지낸 이야기'}
- 본문 내용: ${content || ''}
- 사진 번호: ${photoIndex + 1}번째 사진

이 사진에 달아줄 딱 어울리는 감성적인 사진 설명 한 문장을 추천해주세요.
    `.trim();

    const contentsParts: any[] = [];
    if (imageBase64 && typeof imageBase64 === 'string') {
      if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
        try {
          const imgRes = await fetch(imageBase64);
          if (imgRes.ok) {
            const arrayBuffer = await imgRes.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
            contentsParts.push({
              inlineData: {
                data: base64Data,
                mimeType: mimeType.split(';')[0]
              }
            });
          }
        } catch (imgErr) {
          console.error('Failed to fetch image URL for Gemini caption:', imgErr);
        }
      } else if (imageBase64.startsWith('/')) {
        try {
          const filePath = path.join(process.cwd(), 'public', imageBase64);
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString('base64');
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            contentsParts.push({
              inlineData: {
                data: base64Data,
                mimeType
              }
            });
          }
        } catch (localFileErr) {
          console.error('Failed to read local static file for Gemini caption:', localFileErr);
        }
      } else {
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        contentsParts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/jpeg'
          }
        });
      }
    }
    contentsParts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: { parts: contentsParts },
      config: {
        systemInstruction,
        temperature: 0.8
      }
    });

    const caption = response.text ? response.text.trim() : '즐거움과 웃음이 가득한 순간 📸';

    return res.json({ success: true, caption });
  } catch (error: any) {
    console.error('Caption AI error:', error);
    return res.json({
      success: true,
      caption: '주말 동안 찍은 참 소중하고 예쁜 추억 🌟'
    });
  }
});

// --- Persistent Stories & Photo APIs ---

// 1. Get all stories
app.get('/api/stories', (_req, res) => {
  try {
    const stories = readStories();
    res.json({ success: true, stories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save or update a story (stores photos permanently on disk)
app.post('/api/stories', (req, res) => {
  try {
    const storyData = req.body;
    if (!storyData || !storyData.studentName) {
      return res.status(400).json({ success: false, error: '원아 이름이 필요합니다.' });
    }

    const currentStories = readStories();
    const processedStory = processStoryImages(storyData);
    let updatedStories: any[];

    if (processedStory.id) {
      const idx = currentStories.findIndex((s: any) => s.id === processedStory.id);
      if (idx !== -1) {
        currentStories[idx] = {
          ...currentStories[idx],
          ...processedStory,
          updatedAt: new Date().toISOString()
        };
        updatedStories = currentStories;
      } else {
        processedStory.createdAt = processedStory.createdAt || new Date().toISOString();
        updatedStories = [processedStory, ...currentStories];
      }
    } else {
      // Check if story already exists for this student and week
      const existingIdx = currentStories.findIndex(
        (s: any) => s.studentName === processedStory.studentName && s.week === processedStory.week
      );
      if (existingIdx !== -1) {
        currentStories[existingIdx] = {
          ...currentStories[existingIdx],
          ...processedStory,
          id: currentStories[existingIdx].id,
          updatedAt: new Date().toISOString()
        };
        updatedStories = currentStories;
      } else {
        processedStory.id = 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        processedStory.createdAt = new Date().toISOString();
        updatedStories = [processedStory, ...currentStories];
      }
    }

    writeStories(updatedStories);
    return res.json({ success: true, story: processedStory, stories: updatedStories });
  } catch (err: any) {
    console.error('Failed to save story on server:', err);
    return res.status(500).json({ success: false, error: err.message || '서버 저장 실패' });
  }
});

// 3. Delete a story (Only deleted when explicit delete requested!)
app.delete('/api/stories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const currentStories = readStories();
    const filtered = currentStories.filter((s: any) => s.id !== id);
    writeStories(filtered);
    return res.json({ success: true, stories: filtered });
  } catch (err: any) {
    console.error('Failed to delete story on server:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update reaction emoji count
app.post('/api/stories/:id/reaction', (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    const currentStories = readStories();
    const target = currentStories.find((s: any) => s.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Story not found' });
    }
    target.reactions = target.reactions || {};
    target.reactions[emoji] = (target.reactions[emoji] || 0) + 1;
    writeStories(currentStories);
    return res.json({ success: true, reactions: target.reactions, stories: currentStories });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Bulk sync & recovery (pulls client offline/local storage data onto server)
app.post('/api/stories/bulk-sync', (req, res) => {
  try {
    const { stories: clientStories } = req.body;
    if (!Array.isArray(clientStories) || clientStories.length === 0) {
      return res.json({ success: true, merged: 0, stories: readStories() });
    }

    const currentStories = readStories();
    let mergedCount = 0;

    for (const clientStory of clientStories) {
      if (!clientStory || !clientStory.studentName || BANNED_MOCK_STORY_IDS.has(clientStory.id)) continue;

      const existingIdx = currentStories.findIndex(
        (s: any) =>
          (clientStory.id && s.id === clientStory.id) ||
          (s.studentName === clientStory.studentName && s.week === clientStory.week)
      );

      const processed = processStoryImages(clientStory);

      if (existingIdx !== -1) {
        const existingImages = currentStories[existingIdx].imageUrls || [];
        const clientImages = processed.imageUrls || [];
        // If client has photos or updated content, merge it in
        if (clientImages.length > existingImages.length || !currentStories[existingIdx].imageUrl) {
          currentStories[existingIdx] = {
            ...currentStories[existingIdx],
            ...processed
          };
          mergedCount++;
        }
      } else {
        processed.id = processed.id || 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        currentStories.push(processed);
        mergedCount++;
      }
    }

    if (mergedCount > 0) {
      writeStories(currentStories);
    }

    return res.json({ success: true, merged: mergedCount, stories: currentStories });
  } catch (err: any) {
    console.error('Bulk sync failed:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Direct photo upload endpoint
app.post('/api/upload-photo', (req, res) => {
  try {
    const { imageBase64, name } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    const url = saveBase64Image(imageBase64, name || 'upload');
    return res.json({ success: true, url });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Roster management APIs
app.get('/api/roster', (_req, res) => {
  try {
    const roster = readRoster();
    res.json({ success: true, roster });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/roster', (req, res) => {
  try {
    const { roster } = req.body;
    if (Array.isArray(roster)) {
      writeRoster(roster);
      return res.json({ success: true, roster });
    }
    return res.status(400).json({ error: 'Roster must be an array' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Non-destructive roster merge endpoint
app.post('/api/roster/merge', (req, res) => {
  try {
    const { roster: clientRoster } = req.body;
    const currentRoster = readRoster();
    const map = new Map<string, any>();

    // Put current roster first
    for (const s of currentRoster) {
      if (s && s.name) {
        map.set(s.name.trim().toLowerCase(), s);
      }
    }

    // Merge in client roster without deleting existing
    if (Array.isArray(clientRoster)) {
      for (const s of clientRoster) {
        if (s && s.name) {
          const key = s.name.trim().toLowerCase();
          if (!map.has(key)) {
            map.set(key, s);
          } else {
            // Update fields if provided
            const existing = map.get(key);
            map.set(key, {
              ...existing,
              className: s.className || existing.className,
              parentPin: s.parentPin || existing.parentPin,
              note: s.note || existing.note
            });
          }
        }
      }
    }

    const merged = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    writeRoster(merged);
    return res.json({ success: true, roster: merged, total: merged.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Emergency 1-click restore for Eunsol 1 Ban (18 students)
app.post('/api/roster/restore-eunsol18', (_req, res) => {
  try {
    writeRoster(DEFAULT_INITIAL_ROSTER);
    return res.json({ success: true, roster: DEFAULT_INITIAL_ROSTER, count: DEFAULT_INITIAL_ROSTER.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 8. Full backup & restore endpoints
app.get('/api/backup', (_req, res) => {
  try {
    const stories = readStories();
    const roster = readRoster();
    res.json({
      app: 'weekend-stories',
      exportedAt: new Date().toISOString(),
      stories,
      roster
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/restore', (req, res) => {
  try {
    const { stories, roster } = req.body;
    if (Array.isArray(stories)) {
      writeStories(stories);
    }
    if (Array.isArray(roster)) {
      writeRoster(roster);
    }
    return res.json({ success: true, stories: readStories(), roster: readRoster() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Google Apps Script Proxy API
app.post('/api/gas-proxy', async (req, res) => {
  try {
    const { url, action, story } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid GAS URL is required.' });
    }

    if (action === 'get') {
      const targetUrl = `${url}${url.includes('?') ? '&' : '?'}action=get`;
      const gasRes = await fetch(targetUrl);
      const data = await gasRes.json();
      return res.json(data);
    } else if (action === 'save') {
      const gasRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'save', story })
      });
      const data = await gasRes.json().catch(() => ({ status: 'ok' }));
      return res.json(data);
    } else {
      return res.status(400).json({ error: 'Invalid action.' });
    }
  } catch (err: any) {
    console.error('GAS Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'GAS Proxy call failed' });
  }
});

async function startServer() {
  // Setup Vite development middleware in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
