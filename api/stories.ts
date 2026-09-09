import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

// Universal Firebase Config Resolver supporting both applet config and standard environment variables
const fbConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: process.env.VITE_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_FIREBASE_APP_ID || appletConfig.appId || '',
  firestoreDatabaseId: process.env.VITE_FIRESTORE_DATABASE_ID || process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)'
};

const fbApp = getApps().length > 0 ? getApp() : initializeApp(fbConfig);
const db = fbConfig.firestoreDatabaseId && fbConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(fbApp, fbConfig.firestoreDatabaseId)
  : getFirestore(fbApp);

const isFirestoreReady = Boolean(fbConfig.projectId && fbConfig.apiKey);

function sanitizeForFirestore(data: any): any {
  if (data === null || data === undefined) return null;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

const DEFAULT_INITIAL_STORIES = [
  {
    id: "story-1788706123876-krj5",
    studentName: "김강모",
    week: "9월 1주차(방학지낸이야기)",
    className: "은솔1반",
    title: "모바일 연동 테스트",
    content: "테스트 내용입니다.",
    imageUrl: "/kindergarten_beach_vacation.jpg",
    imageUrls: ["/kindergarten_beach_vacation.jpg"],
    createdAt: "2026-09-06T14:48:43.876Z",
    reactions: { "❤️": 2, "👏": 1 }
  },
  {
    id: "story-1788705341837-06rn",
    studentName: "강루하",
    week: "9월 1주차(방학지낸이야기)",
    className: "은솔1반",
    title: "주말 이야기 테스트",
    content: "가족과 함께 재미있게 보냈어요.",
    imageUrl: "/kindergarten_family_picnic.jpg",
    imageUrls: ["/kindergarten_family_picnic.jpg"],
    createdAt: "2026-09-06T14:35:41.837Z",
    reactions: { "❤️": 1, "⭐": 2 }
  }
];

export default async function handler(req: any, res: any) {
  // Enforce zero caching and full CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch stories
  if (req.method === 'GET') {
    try {
      if (isFirestoreReady) {
        const snap = await getDocs(collection(db, 'stories'));
        const list: any[] = [];
        snap.forEach((d) => {
          const item = d.data();
          const storyId = item?.id || d.id;
          if (item && storyId) {
            list.push({ ...item, id: storyId });
          }
        });
        if (list.length > 0) {
          list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          return res.status(200).json({ success: true, stories: list, total: list.length });
        }
      }
      return res.status(200).json({ success: true, stories: DEFAULT_INITIAL_STORIES, total: DEFAULT_INITIAL_STORIES.length });
    } catch (err: any) {
      return res.status(200).json({ success: true, stories: DEFAULT_INITIAL_STORIES, total: DEFAULT_INITIAL_STORIES.length, warning: err.message });
    }
  }

  // POST: Save or update story
  if (req.method === 'POST') {
    try {
      const story = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!story || !story.studentName) {
        return res.status(400).json({ success: false, error: '원아 이름이 필요합니다.' });
      }
      const storyId = story.id || `story-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const imageUrls = Array.isArray(story.imageUrls) ? story.imageUrls.filter(Boolean) : (story.imageUrl ? [story.imageUrl] : []);
      const imageUrl = imageUrls[0] || story.imageUrl || '';
      const payload = sanitizeForFirestore({
        ...story,
        id: storyId,
        imageUrl,
        imageUrls: imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []),
        createdAt: story.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (isFirestoreReady) {
        await setDoc(doc(db, 'stories', storyId), payload, { merge: true });
      }

      return res.status(200).json({ success: true, story: payload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || '저장 실패' });
    }
  }

  // DELETE: Remove story
  if (req.method === 'DELETE') {
    try {
      const id = req.query?.id;
      if (id && isFirestoreReady) {
        await deleteDoc(doc(db, 'stories', id));
      }
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
