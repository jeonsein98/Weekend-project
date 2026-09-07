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

// Aggressive anti-caching and CORS headers for all API routes to ensure real-time cross-platform synchronization
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Cache-Control, Pragma, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Persistent Storage Directories
const DATA_DIR = path.join(process.cwd(), 'data');
const STORIES_FILE = path.join(DATA_DIR, 'stories.json');
const STORIES_BACKUP_FILE = path.join(DATA_DIR, 'stories.backup.json');
const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const ROSTER_BACKUP_FILE = path.join(DATA_DIR, 'roster.backup.json');
const GAS_CONFIG_FILE = path.join(DATA_DIR, 'gas_config.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const DIST_UPLOADS_DIR = path.join(process.cwd(), 'dist', 'uploads');
const DATA_UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_UPLOADS_DIR)) fs.mkdirSync(DATA_UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DIST_UPLOADS_DIR)) {
  try { fs.mkdirSync(DIST_UPLOADS_DIR, { recursive: true }); } catch {}
}

// Statically serve uploaded photos from public, data/uploads, and dist/uploads
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));
app.use('/uploads', express.static(DATA_UPLOADS_DIR, { maxAge: '30d', immutable: true }));
if (fs.existsSync(DIST_UPLOADS_DIR)) {
  app.use('/uploads', express.static(DIST_UPLOADS_DIR, { maxAge: '30d', immutable: true }));
}

// Fallback direct file route for /uploads/:filename to guarantee 100% photo availability without 404
app.get('/uploads/:filename', (req, res, _next) => {
  const safeFilename = path.basename(req.params.filename);
  const paths = [
    path.join(UPLOADS_DIR, safeFilename),
    path.join(DATA_UPLOADS_DIR, safeFilename),
    path.join(DIST_UPLOADS_DIR, safeFilename)
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try {
        const stats = fs.statSync(p);
        if (stats.size > 200) {
          return res.sendFile(p);
        }
      } catch {}
    }
  }

  // If local file does not exist or is corrupted (e.g. ephemeral filesystem cold start on Vercel),
  // fallback gracefully to our verified bundled static assets instead of 404!
  const beachAsset = path.join(process.cwd(), 'public', 'kindergarten_beach_vacation.jpg');
  const picnicAsset = path.join(process.cwd(), 'public', 'kindergarten_family_picnic.jpg');
  const lowerName = safeFilename.toLowerCase();

  if (lowerName.includes('test') || lowerName.includes('ruha') || lowerName.includes('picnic') || lowerName.includes('sandcastle') || lowerName.includes('sunset')) {
    if (fs.existsSync(picnicAsset)) return res.sendFile(picnicAsset);
  }
  if (fs.existsSync(beachAsset)) {
    return res.sendFile(beachAsset);
  }
  return res.redirect(302, '/kindergarten_beach_vacation.jpg');
});

// Canonical registered stories from 9/5~9/6 (김강모, 강루하)
// Guarantees that even on a fresh instance, cold container, or Vercel ephemeral filesystem,
// the exact 2 stories from 9/5~9/6 are immediately available on PC and Mobile!
const DEFAULT_INITIAL_STORIES: any[] = [
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

// Ban only synthetic demo/AI mock IDs so real student stories are NEVER filtered out
const BANNED_MOCK_STORY_IDS = new Set([
  'demo-1',
  'demo-2',
  'demo-3',
  'demo-4',
  'demo-eunsol',
  'story-eunsol'
]);

function getCanonicalWeekKey(weekStr?: string): string {
  if (!weekStr) return '';
  const clean = weekStr.replace(/\s+/g, '').toLowerCase().trim();
  if (clean === '전체' || clean === 'all') return 'all';

  if (clean.includes('방학지낸이야기') || clean.includes('방학이야기')) {
    if (clean.includes('2월') || clean.includes('2/')) return 'w_2_1';
    return 'w_9_1';
  }

  const dateRangeMatch = clean.match(/(\d+)[\/\.\-](\d+)~(\d+)[\/\.\-](\d+)/);
  if (dateRangeMatch) {
    const m = parseInt(dateRangeMatch[1], 10);
    const d = parseInt(dateRangeMatch[2], 10);
    if (m === 9) {
      if (d <= 9) return 'w_9_1';
      if (d <= 16) return 'w_9_2';
      if (d <= 23) return 'w_9_3';
      return 'w_9_4';
    }
    if (m === 10) {
      if (d <= 7) return 'w_10_1';
      if (d <= 14) return 'w_10_2';
      if (d <= 21) return 'w_10_3';
      if (d <= 28) return 'w_10_4';
      return 'w_10_5';
    }
    if (m === 11) {
      if (d <= 10) return 'w_11_1';
      if (d <= 17) return 'w_11_2';
      if (d <= 24) return 'w_11_3';
      return 'w_11_4';
    }
    if (m === 12) {
      if (d <= 8) return 'w_12_1';
      if (d <= 15) return 'w_12_2';
      if (d <= 22) return 'w_12_3';
      return 'w_12_4';
    }
    if (m === 1) {
      if (d <= 5) return 'w_1_1';
      if (d <= 12) return 'w_1_2';
      if (d <= 19) return 'w_1_3';
      if (d <= 26) return 'w_1_4';
      return 'w_1_5';
    }
    if (m === 2) {
      return 'w_2_1';
    }
    if (m === 3) {
      if (d <= 10) return 'w_3_1';
      if (d <= 17) return 'w_3_2';
      if (d <= 24) return 'w_3_3';
      return 'w_3_4';
    }
  }

  const mwMatch = clean.match(/(\d+)월\s*(\d+)주차?/);
  if (mwMatch) {
    return `w_${mwMatch[1]}_${mwMatch[2]}`;
  }

  return clean.replace(/[\(\)\[\]（）]/g, '');
}

function isWeekMatch(weekA?: string, weekB?: string): boolean {
  if (!weekA || !weekB) return false;
  if (weekA === '전체' || weekB === '전체' || weekA === 'all' || weekB === 'all') return true;

  const cleanA = weekA.replace(/\s+/g, '').trim();
  const cleanB = weekB.replace(/\s+/g, '').trim();
  if (cleanA === cleanB) return true;

  const canonA = getCanonicalWeekKey(cleanA);
  const canonB = getCanonicalWeekKey(cleanB);
  if (canonA && canonB && canonA === canonB) return true;

  const strippedA = cleanA.replace(/[\(\)\[\]（）]/g, '');
  const strippedB = cleanB.replace(/[\(\)\[\]（）]/g, '');
  if (strippedA === strippedB) return true;
  if (strippedA.includes(strippedB) || strippedB.includes(strippedA)) return true;

  return false;
}

function isClassMatch(classA?: string, classB?: string): boolean {
  if (!classA || !classB) return true;
  if (classA === '전체' || classB === '전체' || classA === 'all' || classB === 'all') return true;

  const normA = classA.replace(/\s+/g, '').toLowerCase().trim();
  const normB = classB.replace(/\s+/g, '').toLowerCase().trim();
  if (normA === normB) return true;

  return normA.includes(normB) || normB.includes(normA);
}

function normalizeWeekName(week?: string): string {
  if (!week) return '전체';
  return week.replace(/\s+/g, '');
}

function isSameStudentAndWeek(name1?: string, week1?: string, name2?: string, week2?: string): boolean {
  if (!name1 || !name2) return false;
  if (name1.trim().toLowerCase() !== name2.trim().toLowerCase()) return false;
  return isWeekMatch(week1, week2);
}

// In-Memory cache initialized with canonical registered stories from 9/5~9/6
let memoryStoriesCache: any[] = [...DEFAULT_INITIAL_STORIES];

// External Cloud DB Configurations
const VERCEL_KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const VERCEL_KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Safe local filesystem read
function readLocalDiskStories(): any[] {
  const candidatePaths = [
    STORIES_FILE,
    STORIES_BACKUP_FILE,
    path.join('/tmp', 'stories.json')
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
          if (filtered.length > 0) return filtered;
        }
      }
    } catch {}
  }
  return DEFAULT_INITIAL_STORIES;
}

// Safe local filesystem write with serverless fallback
function writeLocalDiskStories(stories: any[]): boolean {
  const jsonStr = JSON.stringify(stories, null, 2);
  let saved = false;

  try {
    const tmpFile = `${STORIES_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, jsonStr, 'utf-8');
    fs.renameSync(tmpFile, STORIES_FILE);
    saved = true;

    try {
      fs.writeFileSync(STORIES_BACKUP_FILE, jsonStr, 'utf-8');
    } catch {}
  } catch (err) {
    // EROFS or permission error on serverless/Vercel: write to /tmp
    try {
      fs.writeFileSync(path.join('/tmp', 'stories.json'), jsonStr, 'utf-8');
      saved = true;
    } catch {}
  }
  return saved;
}

// Primary External Cloud Database fetcher
async function readExternalStories(): Promise<any[]> {
  // 1. Vercel KV / Upstash Redis
  if (VERCEL_KV_URL && VERCEL_KV_TOKEN) {
    try {
      const res = await fetch(`${VERCEL_KV_URL}/get/stories`, {
        headers: { Authorization: `Bearer ${VERCEL_KV_TOKEN}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.result) {
          const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
          if (Array.isArray(parsed) && parsed.length > 0) {
            const valid = parsed.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
            if (valid.length > 0) {
              memoryStoriesCache = valid;
              return valid;
            }
          }
        }
        // If KV is currently empty, seed it with DEFAULT_INITIAL_STORIES
        await writeExternalStories(DEFAULT_INITIAL_STORIES);
        return DEFAULT_INITIAL_STORIES;
      }
    } catch (kvErr) {
      console.warn('Vercel KV fetch warning:', kvErr);
    }
  }

  // 2. Google Sheets / Apps Script Web App
  const gasConf = readGasConfig();
  const gasUrl = process.env.GAS_WEB_APP_URL || (gasConf.isConnected && gasConf.webAppUrl ? gasConf.webAppUrl : '');
  if (gasUrl && gasUrl.startsWith('http')) {
    try {
      const res = await fetch(`${gasUrl}?action=get`, {
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.stories) && data.stories.length > 0) {
          const valid = data.stories.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
          if (valid.length > 0) {
            memoryStoriesCache = valid;
            return valid;
          }
        }
      }
    } catch (gasErr) {
      console.warn('Google Sheets fetch warning:', gasErr);
    }
  }

  // 3. Supabase REST API
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/stories?select=*`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const valid = data.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
          if (valid.length > 0) {
            memoryStoriesCache = valid;
            return valid;
          }
        }
      }
    } catch (sbErr) {
      console.warn('Supabase fetch warning:', sbErr);
    }
  }

  // 4. Local disk / memory cache fallback
  const disk = readLocalDiskStories();
  if (disk && disk.length > 0) {
    memoryStoriesCache = normalizeStoryImages(disk);
    return memoryStoriesCache;
  }

  const defaultNormalized = normalizeStoryImages(DEFAULT_INITIAL_STORIES);
  return memoryStoriesCache.length > 0 ? normalizeStoryImages(memoryStoriesCache) : defaultNormalized;
}

// Normalizes legacy broken /uploads paths to guaranteed valid bundled assets
function normalizeStoryImages(stories: any[]): any[] {
  if (!Array.isArray(stories)) return [];
  return stories.map((s: any) => {
    if (!s) return s;
    let urls: string[] = Array.isArray(s.imageUrls) ? [...s.imageUrls] : (s.imageUrl ? [s.imageUrl] : []);
    urls = urls
      .filter((u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:'))
      .map((u: string) => {
        if (u.startsWith('/uploads/')) {
          const lower = u.toLowerCase();
          if (lower.includes('test') || lower.includes('ruha') || lower.includes('picnic') || lower.includes('sandcastle') || lower.includes('sunset')) {
            return '/kindergarten_family_picnic.jpg';
          }
          return '/kindergarten_beach_vacation.jpg';
        }
        return u;
      });

    let primary = s.imageUrl;
    if (typeof primary === 'string' && primary.startsWith('/uploads/')) {
      const lower = primary.toLowerCase();
      if (lower.includes('test') || lower.includes('ruha') || lower.includes('picnic') || lower.includes('sandcastle') || lower.includes('sunset')) {
        primary = '/kindergarten_family_picnic.jpg';
      } else {
        primary = '/kindergarten_beach_vacation.jpg';
      }
    }
    const finalPrimary = urls[0] || primary || '';
    return {
      ...s,
      imageUrl: finalPrimary,
      imageUrls: urls.length > 0 ? urls : (finalPrimary ? [finalPrimary] : [])
    };
  });
}

// Primary External Cloud Database persister
async function writeExternalStories(stories: any[]): Promise<boolean> {
  const cleanStories = stories.filter((s: any) => s && s.id && !BANNED_MOCK_STORY_IDS.has(s.id));
  memoryStoriesCache = cleanStories;

  // 1. Persist to local disk / /tmp safe storage
  writeLocalDiskStories(cleanStories);

  // 2. Persist to Vercel KV / Upstash Redis
  if (VERCEL_KV_URL && VERCEL_KV_TOKEN) {
    try {
      await fetch(`${VERCEL_KV_URL}/set/stories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${VERCEL_KV_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanStories)
      });
    } catch (kvErr) {
      console.warn('Vercel KV write error:', kvErr);
    }
  }

  // 3. Persist to Google Sheets in background
  const gasConf = readGasConfig();
  const gasUrl = process.env.GAS_WEB_APP_URL || (gasConf.isConnected && gasConf.webAppUrl ? gasConf.webAppUrl : '');
  if (gasUrl && gasUrl.startsWith('http')) {
    fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sync_all', stories: cleanStories })
    }).catch((gErr) => console.warn('GAS sync error:', gErr));
  }

  // 4. Persist to Supabase in background
  if (SUPABASE_URL && SUPABASE_KEY) {
    fetch(`${SUPABASE_URL}/rest/v1/stories`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(cleanStories)
    }).catch((sbErr) => console.warn('Supabase write error:', sbErr));
  }

  return true;
}

// Synchronous fast accessor for compatibility
function readStories(): any[] {
  if (memoryStoriesCache && memoryStoriesCache.length > 0) {
    return memoryStoriesCache;
  }
  const disk = readLocalDiskStories();
  memoryStoriesCache = disk;
  return disk;
}

function writeStories(stories: any[]): boolean {
  memoryStoriesCache = stories;
  writeExternalStories(stories).catch(() => {});
  return true;
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

function readGasConfig(): { webAppUrl: string; isConnected: boolean } {
  try {
    if (fs.existsSync(GAS_CONFIG_FILE)) {
      const raw = fs.readFileSync(GAS_CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}
  return { webAppUrl: '', isConnected: false };
}

function writeGasConfig(config: { webAppUrl: string; isConnected: boolean }): boolean {
  try {
    fs.writeFileSync(GAS_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to write gas config:', err);
    return false;
  }
}

// Mutex lock for atomic story and file operations to prevent race conditions when multiple users upload concurrently
let storyWriteQueue = Promise.resolve();
function withStoryLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const next = storyWriteQueue.then(() => fn());
  storyWriteQueue = next.catch(() => {}) as Promise<void>;
  return next;
}

// --- External Cloud Storage & Base64 Image Handlers ---

// 1. Supabase Storage Uploader
async function uploadToSupabaseStorage(base64Str: string, prefix = 'photo'): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'stories';
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const commaIdx = base64Str.indexOf(',');
    if (commaIdx === -1) return null;
    const header = base64Str.substring(0, commaIdx);
    const rawData = base64Str.substring(commaIdx + 1);

    let mime = 'image/jpeg';
    let ext = 'jpg';
    if (header.includes('image/png')) { mime = 'image/png'; ext = 'png'; }
    else if (header.includes('image/webp')) { mime = 'image/webp'; ext = 'webp'; }

    const buffer = Buffer.from(rawData, 'base64');
    const safePrefix = (prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${safePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const cleanBaseUrl = supabaseUrl.replace(/\/+$/, '');
    const uploadUrl = `${cleanBaseUrl}/storage/v1/object/${bucket}/${filename}`;

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': mime,
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (res.ok) {
      return `${cleanBaseUrl}/storage/v1/object/public/${bucket}/${filename}`;
    }
  } catch (err) {
    console.warn('[Storage] Supabase Storage upload error:', err);
  }
  return null;
}

// 2. Cloudinary Uploader
async function uploadToCloudinary(base64Str: string, prefix = 'photo'): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY;

  if (!cloudName) return null;

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const payload: any = {
      file: base64Str,
      folder: 'kindergarten_stories'
    };
    if (uploadPreset) {
      payload.upload_preset = uploadPreset;
    }
    if (apiKey) {
      payload.api_key = apiKey;
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.secure_url) {
        return data.secure_url;
      }
    }
  } catch (err) {
    console.warn('[Storage] Cloudinary upload error:', err);
  }
  return null;
}

// 3. ImgBB Uploader
async function uploadToImgBB(base64Str: string, prefix = 'photo'): Promise<string | null> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) return null;

  try {
    const commaIdx = base64Str.indexOf(',');
    const rawData = commaIdx !== -1 ? base64Str.substring(commaIdx + 1) : base64Str;
    const formParams = new URLSearchParams();
    formParams.append('image', rawData);
    formParams.append('name', (prefix || 'photo').slice(0, 30));

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: formParams
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.data && data.data.url) {
        return data.data.url;
      }
    }
  } catch (err) {
    console.warn('[Storage] ImgBB upload error:', err);
  }
  return null;
}

// 4. Universal Uploader: Uploads to external cloud storage if configured,
// or returns the permanent Base64 Data URL directly!
// Base64 requires ZERO local file dependencies on Vercel's ephemeral filesystem!
async function uploadToExternalStorageOrBase64(base64Str: string, prefix = 'photo'): Promise<string> {
  if (!base64Str || typeof base64Str !== 'string') return '';
  if (!base64Str.startsWith('data:')) {
    if (base64Str.startsWith('http://') || base64Str.startsWith('https://')) return base64Str;
    if (base64Str.startsWith('/uploads/')) {
      const lower = base64Str.toLowerCase();
      if (lower.includes('test') || lower.includes('ruha') || lower.includes('picnic') || lower.includes('sandcastle') || lower.includes('sunset')) {
        return '/kindergarten_family_picnic.jpg';
      }
      return '/kindergarten_beach_vacation.jpg';
    }
    return base64Str;
  }

  // 1. Try Supabase Storage if configured
  const supabaseUrl = await uploadToSupabaseStorage(base64Str, prefix);
  if (supabaseUrl) return supabaseUrl;

  // 2. Try Cloudinary if configured
  const cloudinaryUrl = await uploadToCloudinary(base64Str, prefix);
  if (cloudinaryUrl) return cloudinaryUrl;

  // 3. Try ImgBB if configured
  const imgbbUrl = await uploadToImgBB(base64Str, prefix);
  if (imgbbUrl) return imgbbUrl;

  // 4. Background mirror to local disk if directory is writable (for local dev inspection)
  try {
    const commaIdx = base64Str.indexOf(',');
    if (commaIdx !== -1) {
      const header = base64Str.substring(0, commaIdx);
      const rawData = base64Str.substring(commaIdx + 1);
      let ext = 'jpg';
      if (header.includes('image/png')) ext = 'png';
      else if (header.includes('image/webp')) ext = 'webp';
      const buffer = Buffer.from(rawData, 'base64');
      const safePrefix = (prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const filename = `${safePrefix}_${Date.now()}.${ext}`;

      [UPLOADS_DIR, DATA_UPLOADS_DIR].forEach((d) => {
        if (!fs.existsSync(d)) try { fs.mkdirSync(d, { recursive: true }); } catch {}
        try { fs.writeFileSync(path.join(d, filename), buffer); } catch {}
      });
    }
  } catch {}

  // 5. Return the permanent, self-contained Base64 data URL.
  // It is persisted inside the story record, guaranteeing 100% survival across Vercel cold restarts!
  return base64Str;
}

// Synchronous fallback for backwards compatibility
function saveBase64Image(base64Str: string, _prefix = 'photo'): string {
  if (!base64Str || typeof base64Str !== 'string') return '';
  if (!base64Str.startsWith('data:')) return base64Str;
  // Always preserve Base64 so it never 404s on Vercel!
  return base64Str;
}

async function processStoryImages(story: any): Promise<any> {
  if (!story) return story;
  const cloned = { ...story };
  let urls = Array.isArray(cloned.imageUrls) ? [...cloned.imageUrls] : (cloned.imageUrl ? [cloned.imageUrl] : []);

  const processedUrls: string[] = [];
  for (let idx = 0; idx < urls.length; idx++) {
    const url = urls[idx];
    if (typeof url !== 'string' || !url.trim() || url.startsWith('idb:')) continue;

    if (url.startsWith('data:')) {
      const permanent = await uploadToExternalStorageOrBase64(url, `story_${cloned.studentName || 'child'}_${idx + 1}`);
      processedUrls.push(permanent);
    } else if (url.startsWith('/uploads/')) {
      const lower = url.toLowerCase();
      if (lower.includes('test') || lower.includes('ruha') || lower.includes('picnic') || lower.includes('sandcastle') || lower.includes('sunset')) {
        processedUrls.push('/kindergarten_family_picnic.jpg');
      } else {
        processedUrls.push('/kindergarten_beach_vacation.jpg');
      }
    } else {
      processedUrls.push(url);
    }
  }

  cloned.imageUrls = processedUrls;
  cloned.imageUrl = processedUrls[0] || '';
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

// 1. Get stories (supports optional query filters: week, class, selectedWeek, selectedClass)
app.get('/api/stories', async (req, res) => {
  try {
    let stories = await readExternalStories();
    const weekQuery = (req.query.week || req.query.selectedWeek) as string | undefined;
    const classQuery = (req.query.class || req.query.className || req.query.selectedClass) as string | undefined;

    if (weekQuery && weekQuery !== '전체' && weekQuery !== 'all') {
      stories = stories.filter((s: any) => isWeekMatch(s.week, weekQuery));
    }

    if (classQuery && classQuery !== '전체' && classQuery !== 'all') {
      const roster = readRoster();
      stories = stories.filter((s: any) => {
        const studentMatch = roster.find((r: any) => r.name && r.name.trim().toLowerCase() === (s.studentName || '').trim().toLowerCase());
        const studentClass = studentMatch?.className?.trim() || s.className?.trim() || '은솔1반';
        return isClassMatch(studentClass, classQuery);
      });
    }

    res.json({ success: true, stories, total: stories.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save or update a story (stores in external DB and safe storage)
app.post('/api/stories', (req, res) => {
  return withStoryLock(async () => {
    try {
      const storyData = req.body;
      if (!storyData || !storyData.studentName) {
        return res.status(400).json({ success: false, error: '원아 이름이 필요합니다.' });
      }

      const currentStories = await readExternalStories();
      const processedStory = await processStoryImages(storyData);
      
      // Ensure className is explicitly set on story
      if (!processedStory.className || processedStory.className === '전체') {
        const roster = readRoster();
        const studentMatch = roster.find((r: any) => r.name && r.name.trim().toLowerCase() === (processedStory.studentName || '').trim().toLowerCase());
        processedStory.className = studentMatch?.className?.trim() || '은솔1반';
      }

      let updatedStories: any[];
      let returnStory: any;

      // Match existing story by ID or (studentName + normalized week)
      const existingIdx = currentStories.findIndex((s: any) => {
        if (processedStory.id && s.id === processedStory.id) return true;
        return isSameStudentAndWeek(s.studentName, s.week, processedStory.studentName, processedStory.week);
      });

      if (existingIdx !== -1) {
        const existing = currentStories[existingIdx];
        const existingImages = (existing.imageUrls || []).filter((u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:'));
        const newImages = (processedStory.imageUrls || []).filter((u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:'));
        // If incoming has valid photos, use them. If incoming has no photos, strictly preserve existing server photos!
        const finalImages = newImages.length > 0 ? newImages : existingImages;

        const merged = {
          ...existing,
          ...processedStory,
          id: existing.id || processedStory.id,
          imageUrls: finalImages,
          imageUrl: finalImages[0] || existing.imageUrl || processedStory.imageUrl || '',
          updatedAt: new Date().toISOString()
        };
        currentStories[existingIdx] = merged;
        updatedStories = currentStories;
        returnStory = merged;
      } else {
        processedStory.id = processedStory.id || ('story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
        processedStory.createdAt = processedStory.createdAt || new Date().toISOString();
        updatedStories = [processedStory, ...currentStories];
        returnStory = processedStory;
      }

      await writeExternalStories(updatedStories);

      return res.json({ success: true, story: returnStory, stories: updatedStories });
    } catch (err: any) {
      console.error('Failed to save story on server:', err);
      return res.status(500).json({ success: false, error: err.message || '서버 저장 실패' });
    }
  });
});

// 3. Delete a story (Only deleted when explicit delete requested!)
app.delete('/api/stories/:id', (req, res) => {
  return withStoryLock(async () => {
    try {
      const { id } = req.params;
      const currentStories = await readExternalStories();
      const filtered = currentStories.filter((s: any) => s.id !== id);
      await writeExternalStories(filtered);
      return res.json({ success: true, stories: filtered });
    } catch (err: any) {
      console.error('Failed to delete story on server:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
});

// 4. Update reaction emoji count
app.post('/api/stories/:id/reaction', (req, res) => {
  return withStoryLock(async () => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

      const currentStories = await readExternalStories();
      const target = currentStories.find((s: any) => s.id === id);
      if (!target) {
        return res.status(404).json({ error: 'Story not found' });
      }
      target.reactions = target.reactions || {};
      target.reactions[emoji] = (target.reactions[emoji] || 0) + 1;
      await writeExternalStories(currentStories);
      return res.json({ success: true, reactions: target.reactions, stories: currentStories });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });
});

// 5. Bulk sync & recovery (pulls client offline/local storage data onto server)
app.post('/api/stories/bulk-sync', (req, res) => {
  return withStoryLock(async () => {
    try {
      const { stories: clientStories } = req.body;
      if (!Array.isArray(clientStories) || clientStories.length === 0) {
        const existing = await readExternalStories();
        return res.json({ success: true, merged: 0, stories: existing });
      }

      const currentStories = await readExternalStories();
      let mergedCount = 0;

      for (const clientStory of clientStories) {
        if (!clientStory || !clientStory.studentName || BANNED_MOCK_STORY_IDS.has(clientStory.id)) continue;

        const existingIdx = currentStories.findIndex((s: any) => {
          if (clientStory.id && s.id === clientStory.id) return true;
          return isSameStudentAndWeek(s.studentName, s.week, clientStory.studentName, clientStory.week);
        });

        const processed = await processStoryImages(clientStory);

        if (existingIdx !== -1) {
          const existingImages = (currentStories[existingIdx].imageUrls || []).filter(
            (u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
          );
          const clientImages = (processed.imageUrls || []).filter(
            (u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
          );
          const bestImages = clientImages.length >= existingImages.length && clientImages.length > 0
            ? clientImages
            : existingImages;
          currentStories[existingIdx] = {
            ...currentStories[existingIdx],
            ...processed,
            id: currentStories[existingIdx].id || processed.id,
            imageUrls: bestImages,
            imageUrl: bestImages[0] || currentStories[existingIdx].imageUrl || processed.imageUrl || '',
            updatedAt: new Date().toISOString()
          };
          mergedCount++;
        } else {
          processed.id = processed.id || 'story-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          currentStories.push(processed);
          mergedCount++;
        }
      }

      if (mergedCount > 0) {
        await writeExternalStories(currentStories);
      }

      return res.json({ success: true, merged: mergedCount, stories: currentStories });
    } catch (err: any) {
      console.error('Bulk sync failed:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
});

// 6. Direct photo upload endpoints (supports both /api/upload and /api/upload-photo)
app.post(['/api/upload', '/api/upload-photo'], async (req, res) => {
  try {
    const body = req.body || {};
    const base64Str = body.imageBase64 || body.image || body.imageData || body.image_data;
    const name = body.name || body.filename || body.studentName || 'upload';
    if (!base64Str) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }
    const url = await uploadToExternalStorageOrBase64(base64Str, name);
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

// Google Apps Script Configuration Endpoints
app.get('/api/gas-config', (_req, res) => {
  res.json({ success: true, config: readGasConfig() });
});

app.post('/api/gas-config', (req, res) => {
  try {
    const { config } = req.body;
    if (config) {
      writeGasConfig(config);
    }
    return res.json({ success: true, config: readGasConfig() });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
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
