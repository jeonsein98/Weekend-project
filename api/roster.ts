import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc
} from 'firebase/firestore';
import appletConfig from '../firebase-applet-config.json';

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
    return data.filter((item) => item !== undefined).map((item) => sanitizeForFirestore(item));
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

const DEFAULT_INITIAL_ROSTER = [
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      if (isFirestoreReady) {
        const snap = await getDocs(collection(db, 'app_metadata'));
        let found: any[] | null = null;
        snap.forEach((d) => {
          if (d.id === 'roster') {
            const data = d.data();
            if (data && Array.isArray(data.students) && data.students.length > 0) {
              found = data.students;
            }
          }
        });
        if (found) {
          return res.status(200).json({ success: true, roster: found });
        }
      }
      return res.status(200).json({ success: true, roster: DEFAULT_INITIAL_ROSTER });
    } catch {
      return res.status(200).json({ success: true, roster: DEFAULT_INITIAL_ROSTER });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const roster = body?.roster;
      if (!Array.isArray(roster)) {
        return res.status(400).json({ success: false, error: '명단 데이터가 필요합니다.' });
      }
      if (isFirestoreReady) {
        const cleanRoster = sanitizeForFirestore({
          students: roster,
          updatedAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'app_metadata', 'roster'), cleanRoster, { merge: true });
      }
      return res.status(200).json({ success: true, roster });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
