import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Increase body payload limit for image base64 uploads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

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
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      contentsParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/jpeg'
        }
      });
    }
    contentsParts.push({ text: textPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contentsParts.length === 1 ? contentsParts[0].text : { parts: contentsParts },
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
