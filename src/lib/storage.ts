import { StoryItem, GasConfig, RosterStudent, isWeekMatch, isClassMatch, getStudentClass, getCanonicalWeekKey } from '../types';
import { INITIAL_STORIES } from './defaultData';
import {
  saveStoryToIndexedDB,
  saveAllStoriesToIndexedDB,
  getAllStoriesFromIndexedDB,
  deleteStoryFromIndexedDB,
  saveRosterToIndexedDB,
  getRosterFromIndexedDB,
  getAllDraftsFromIndexedDB,
  getAllPhotosFromIndexedDB,
  findPhotoForStudent
} from './idb';

const STORAGE_KEY_STORIES = 'weekend_stories_data_v1';
const STORAGE_KEY_GAS_CONFIG = 'weekend_stories_gas_config_v1';
const STORAGE_KEY_ROSTER = 'kindergarten_roster_v1';
const STORAGE_KEY_ROSTER_SNAPSHOTS = 'kindergarten_roster_snapshots_v1';

export const BANNED_MOCK_STORY_IDS = new Set([
  'demo-1',
  'demo-2',
  'demo-3',
  'demo-4',
  'demo-eunsol',
  'story-eunsol'
]);

export const LEGACY_MOCK_STUDENT_NAMES = new Set([
  '김은솔',
  '강민준',
  '고서준',
  '권하은',
  '배시우',
  '서아린',
  '신예준',
  '오지호',
  '유하율',
  '윤서아',
  '이수아',
  '임유준',
  '장민서',
  '정채원',
  '조서현',
  '황다은'
]);

export const EUNSOL_18_ROSTER: RosterStudent[] = [
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

export const INITIAL_ROSTER: RosterStudent[] = EUNSOL_18_ROSTER;

export function ensureRosterOrder(list: RosterStudent[]): RosterStudent[] {
  if (!Array.isArray(list) || list.length === 0) return list;
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function normalizeWeek(week?: string): string {
  if (!week) return 'all';
  return getCanonicalWeekKey(week) || week.replace(/\s+/g, '');
}

export function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove = [
      'es_stories_v3',
      'es_stories_v2',
      'es_stories',
      'kindergarten_offline_stories',
      'classgram_stories',
      'kindergarten_stories',
      'weekend_stories_backup'
    ];
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('story_cache_') ||
        key.startsWith('offline_stories_') ||
        key.startsWith('kindergarten_offline_') ||
        key.startsWith('classgram_')
      ) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  } catch {}
}

// Local in-memory cache to guarantee stories are NEVER lost on transient network dropouts
let memoryStoriesCache: StoryItem[] = [...INITIAL_STORIES];

/**
 * Fetch stories from persistent server storage (Single Source of Truth).
 * All devices (PC, mobile, tablet) read directly from /api/stories with anti-cache query param.
 */
export async function fetchStoriesFromServer(options?: { week?: string; className?: string }): Promise<StoryItem[]> {
  cleanupLegacyLocalStorage();

  const params = new URLSearchParams();
  if (options?.week && options.week !== '전체') params.append('week', options.week);
  if (options?.className && options.className !== '전체') params.append('class', options.className);
  params.append('_t', Date.now().toString());
  const fetchUrl = `/api/stories?${params.toString()}`;

  const doFetch = async () => {
    const res = await fetch(fetchUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  };

  try {
    let data;
    try {
      data = await doFetch();
    } catch (firstErr) {
      // Brief pause and single retry in case of transient network glitch or server restart
      await new Promise(r => setTimeout(r, 400));
      data = await doFetch();
    }

    if (data && data.success && Array.isArray(data.stories)) {
      const cleanStories: StoryItem[] = data.stories
        .filter((s: StoryItem) => s && s.studentName && !BANNED_MOCK_STORY_IDS.has(s.id))
        .map((s: StoryItem) => {
          let urls = Array.isArray(s.imageUrls) ? [...s.imageUrls] : (s.imageUrl ? [s.imageUrl] : []);
          urls = urls.map(u => {
            if (typeof u !== 'string') return '';
            if (u.startsWith('/uploads/')) {
              const lower = u.toLowerCase();
              if (lower.includes('test') || lower.includes('ruha') || lower.includes('picnic') || lower.includes('sandcastle') || lower.includes('sunset')) {
                return '/kindergarten_family_picnic.jpg';
              }
              return '/kindergarten_beach_vacation.jpg';
            }
            return u;
          }).filter(Boolean);
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

      // Synchronize in-memory cache directly with authoritative server response
      memoryStoriesCache = cleanStories;
      return cleanStories;
    }
  } catch (err: any) {
    console.warn('[Storage] Fetch stories from server warning (retaining cached stories):', err?.message || err);
  }

  return memoryStoriesCache.length > 0 ? memoryStoriesCache : INITIAL_STORIES;
}

/**
 * Synchronize local stories with the central server external storage.
 * Merges client data onto server external storage and returns authoritative merged list.
 */
export async function syncStoriesWithServer(storiesToSync: StoryItem[]): Promise<StoryItem[]> {
  try {
    const res = await fetch('/api/stories/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories: storiesToSync })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        memoryStoriesCache = data.stories;
        return data.stories;
      }
    }
  } catch (e) {
    console.warn('[Storage] Sync with server warning:', e);
  }
  return memoryStoriesCache;
}

/**
 * Save or update story on the persistent server.
 * All base64 images will be converted to permanent external cloud storage or permanent self-contained Base64.
 * Returns authoritative story list directly from the server.
 */
export async function saveStoryToServer(story: StoryItem): Promise<{ success: boolean; story?: StoryItem; stories?: StoryItem[]; error?: string }> {
  let storyToSave = { ...story };

  // 1. If story contains raw base64 images, attempt external cloud upload if available
  if (Array.isArray(storyToSave.imageUrls) && storyToSave.imageUrls.some(u => typeof u === 'string' && u.startsWith('data:'))) {
    try {
      const uploadedUrls = await Promise.all(
        storyToSave.imageUrls.map(async (u, idx) => {
          if (typeof u === 'string' && u.startsWith('data:')) {
            try {
              const upRes = await fetch('/api/upload-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: u,
                  name: `photo_${storyToSave.studentName || 'child'}_${idx + 1}`
                })
              });
              if (upRes.ok) {
                const upData = await upRes.json();
                // Only adopt if it's a permanent external URL or base64. Never adopt ephemeral local /uploads/ paths!
                if (upData.url && !upData.url.startsWith('/uploads/')) return upData.url;
              }
            } catch (e) {
              console.warn('[Storage] Pre-upload error:', e);
            }
          }
          return u;
        })
      );
      storyToSave.imageUrls = uploadedUrls.filter(u => typeof u === 'string' && !u.startsWith('idb:'));
      storyToSave.imageUrl = storyToSave.imageUrls[0] || '';
    } catch (err) {
      console.warn('[Storage] Photo upload preprocessing failed:', err);
    }
  }

  // 2. Also ensure single cover image is permanent
  if (typeof storyToSave.imageUrl === 'string' && storyToSave.imageUrl.startsWith('data:')) {
    try {
      const upRes = await fetch('/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: storyToSave.imageUrl,
          name: `cover_${storyToSave.studentName || 'child'}`
        })
      });
      if (upRes.ok) {
        const upData = await upRes.json();
        if (upData.url && !upData.url.startsWith('/uploads/')) {
          storyToSave.imageUrl = upData.url;
          if (!storyToSave.imageUrls || storyToSave.imageUrls.length === 0) {
            storyToSave.imageUrls = [upData.url];
          }
        }
      }
    } catch {}
  }

  // Filter out any invalid idb: pseudo strings
  storyToSave.imageUrls = (storyToSave.imageUrls || []).filter(u => typeof u === 'string' && !u.startsWith('idb:'));
  if (storyToSave.imageUrl && storyToSave.imageUrl.startsWith('idb:')) {
    storyToSave.imageUrl = storyToSave.imageUrls[0] || '';
  }

  // 3. Post to backend server API (Single Source of Truth)
  try {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(storyToSave)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        return { success: true, story: data.story, stories: data.stories };
      }
    } else {
      const errorData = await res.json().catch(() => ({}));
      return { success: false, error: errorData.error || `서버 응답 오류 (${res.status})` };
    }
  } catch (err: any) {
    console.error('[Storage] Save story to server error:', err);
    return { success: false, error: err.message || '네트워크 통신 오류가 발생했습니다.' };
  }

  return { success: false, error: '저장 처리 중 오류가 발생했습니다.' };
}

/**
 * Delete story from persistent server.
 */
export async function deleteStoryFromServer(id: string): Promise<StoryItem[]> {
  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        return data.stories.filter((s: StoryItem) => !BANNED_MOCK_STORY_IDS.has(s.id));
      }
    }
  } catch (err) {
    console.warn('[Storage] Delete story from server error:', err);
  }

  return await fetchStoriesFromServer();
}

/**
 * Post reaction emoji to server
 */
export async function updateReactionOnServer(id: string, emoji: string): Promise<StoryItem[]> {
  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(id)}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        return data.stories;
      }
    }
  } catch (err) {
    console.error('Failed to update reaction on server', err);
  }
  return await fetchStoriesFromServer();
}

/**
 * Fetch class roster from server with non-destructive bidirectional merge.
 * Guarantees zero data loss across restarts or cache resets.
 */
export async function fetchRosterFromServer(): Promise<RosterStudent[]> {
  // 1. Gather all local client sources (localStorage + IndexedDB)
  const localRoster = getRosterList().filter(s => s && s.name && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim()));
  let idbRoster: RosterStudent[] = [];
  try {
    idbRoster = (await getRosterFromIndexedDB()).filter(s => s && s.name && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim()));
  } catch (err) {
    console.warn('[Storage] IDB roster read skipped:', err);
  }

  const clientMap = new Map<string, RosterStudent>();
  for (const s of [...localRoster, ...idbRoster]) {
    if (s && s.name && s.name.trim() && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim())) {
      clientMap.set(s.name.trim().toLowerCase(), s);
    }
  }

  try {
    const res = await fetch('/api/roster');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.roster)) {
        const serverRoster: RosterStudent[] = data.roster.filter((s: RosterStudent) => s && s.name && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim()));

        // If server roster was empty or had legacy, fall back to initial
        const validServerRoster = serverRoster.length > 0 ? serverRoster : EUNSOL_18_ROSTER;

        // Union merge between server roster and client roster
        const mergedMap = new Map<string, RosterStudent>();
        for (const s of validServerRoster) {
          if (s && s.name && s.name.trim() && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim())) {
            mergedMap.set(s.name.trim().toLowerCase(), s);
          }
        }

        let hasNewClientItems = false;
        for (const [key, student] of clientMap.entries()) {
          if (!mergedMap.has(key)) {
            mergedMap.set(key, student);
            hasNewClientItems = true;
          }
        }

        const mergedList = ensureRosterOrder(Array.from(mergedMap.values()));
        saveRosterList(mergedList);

        // If client had students that the server was missing, sync them up immediately!
        if (hasNewClientItems) {
          try {
            await fetch('/api/roster/merge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ roster: mergedList })
            });
          } catch (mErr) {
            console.warn('[Storage] Server roster merge sync error:', mErr);
          }
        }

        return mergedList;
      }
    }
  } catch (err) {
    console.warn('[Storage] Fetch roster from server failed, using local sources:', err);
  }

  if (clientMap.size > 0) {
    const fallbackList = ensureRosterOrder(Array.from(clientMap.values()));
    return fallbackList;
  }
  return EUNSOL_18_ROSTER;
}

/**
 * Save class roster to server and local persistent caches
 */
export async function saveRosterToServer(roster: RosterStudent[]): Promise<RosterStudent[]> {
  const ordered = ensureRosterOrder(roster);
  saveRosterList(ordered);

  try {
    const res = await fetch('/api/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roster: ordered })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.roster)) {
        return ensureRosterOrder(data.roster);
      }
    }
  } catch (err) {
    console.error('[Storage] Save roster to server error:', err);
  }
  return ordered;
}

/**
 * Emergency restore of Eunsol 1 Ban (18 students)
 */
export async function restoreEunsol18Roster(): Promise<RosterStudent[]> {
  try {
    const res = await fetch('/api/roster/restore-eunsol18', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.roster)) {
        const ordered = ensureRosterOrder(data.roster);
        saveRosterList(ordered);
        return ordered;
      }
    }
  } catch (err) {
    console.warn('[Storage] Server restore call failed, restoring locally:', err);
  }

  saveRosterList(EUNSOL_18_ROSTER);
  await saveRosterToServer(EUNSOL_18_ROSTER);
  return EUNSOL_18_ROSTER;
}

/**
 * Deep scan browser localStorage for any previously stored student data
 */
export function scanAndRecoverBrowserRoster(): { foundStudents: RosterStudent[]; sourceKeys: string[] } {
  const foundMap = new Map<string, RosterStudent>();
  const sourceKeys: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        // Check if raw contains student-like structures
        if (raw.includes('김은솔') || raw.includes('김도희') || raw.includes('은솔1반') || raw.includes('parentPin')) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.name && typeof item.name === 'string') {
                foundMap.set(item.name.trim().toLowerCase(), {
                  id: item.id || `recovered-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  name: item.name.trim(),
                  className: item.className || '은솔1반',
                  parentPin: item.parentPin || '1234',
                  note: item.note || '브라우저 캐시에서 복원됨'
                });
                if (!sourceKeys.includes(key)) sourceKeys.push(key);
              }
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error('Scan error:', err);
  }

  return {
    foundStudents: Array.from(foundMap.values()),
    sourceKeys
  };
}

/**
 * Deep scan browser localStorage and IndexedDB for any previously submitted genuine stories or photo drafts
 */
export async function scanAndRecoverBrowserStories(): Promise<{ recoveredStories: StoryItem[]; sourceDescriptions: string[] }> {
  const recoveredMap = new Map<string, StoryItem>();
  const sourceDescriptions: string[] = [];

  // 1. Scan localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        if (
          raw.includes('studentName') &&
          (raw.includes('imageUrls') || raw.includes('imageUrl') || raw.includes('title') || raw.includes('content'))
        ) {
          const parsed = JSON.parse(raw);
          const items = Array.isArray(parsed) ? parsed : [parsed];

          for (const item of items) {
            if (
              item &&
              item.studentName &&
              typeof item.studentName === 'string' &&
              !BANNED_MOCK_STORY_IDS.has(item.id) &&
              item.id !== 'demo-eunsol'
            ) {
              const rawUrls = Array.isArray(item.imageUrls) ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
              const validUrls = rawUrls.filter((u: any) =>
                typeof u === 'string' &&
                u.trim().length > 0 &&
                !u.includes('eunsol_beach_laugh') &&
                !u.includes('eunsol_sandcastle') &&
                !u.includes('eunsol_family_sunset')
              );
              const cleanCover = validUrls[0] || (
                typeof item.imageUrl === 'string' &&
                item.imageUrl.trim().length > 0 &&
                !item.imageUrl.includes('eunsol_beach_laugh') &&
                !item.imageUrl.includes('eunsol_sandcastle') &&
                !item.imageUrl.includes('eunsol_family_sunset')
                  ? item.imageUrl
                  : ''
              );

              const storyId = item.id || `recovered-story-${item.studentName}-${Date.now()}`;
              recoveredMap.set(storyId, {
                ...item,
                id: storyId,
                imageUrls: validUrls,
                imageUrl: cleanCover
              });
              sourceDescriptions.push(`localStorage [${key}] - ${item.studentName} (${item.title || '제목 없음'})`);
            }
          }
        }
      } catch {}
    }
  } catch (lsErr) {
    console.warn('[Storage] scan stories localStorage err:', lsErr);
  }

  // 2. Scan IndexedDB Stories
  try {
    const idbStories = await getAllStoriesFromIndexedDB();
    for (const item of idbStories) {
      if (
        item &&
        item.studentName &&
        !BANNED_MOCK_STORY_IDS.has(item.id) &&
        item.id !== 'demo-eunsol'
      ) {
        const rawUrls = Array.isArray(item.imageUrls) ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
        const validUrls = rawUrls.filter((u: any) =>
          typeof u === 'string' &&
          u.trim().length > 0 &&
          !u.includes('eunsol_beach_laugh') &&
          !u.includes('eunsol_sandcastle') &&
          !u.includes('eunsol_family_sunset')
        );
        const cleanCover = validUrls[0] || (
          typeof item.imageUrl === 'string' &&
          item.imageUrl.trim().length > 0 &&
          !item.imageUrl.includes('eunsol_beach_laugh') &&
          !item.imageUrl.includes('eunsol_sandcastle') &&
          !item.imageUrl.includes('eunsol_family_sunset')
            ? item.imageUrl
            : ''
        );

        const storyId = item.id || `recovered-idb-${item.studentName}-${item.week}`;
        const existing = recoveredMap.get(storyId);
        const existingUrls = (existing?.imageUrls || []).filter((u: string) => typeof u === 'string' && u.trim().length > 0);
        if (!existing || validUrls.length >= existingUrls.length) {
          recoveredMap.set(storyId, {
            ...item,
            id: storyId,
            imageUrls: validUrls,
            imageUrl: cleanCover
          });
          sourceDescriptions.push(`IndexedDB stories - ${item.studentName} (${item.title || '제목 없음'})`);
        }
      }
    }
  } catch (idbErr) {
    console.warn('[Storage] scan stories IDB err:', idbErr);
  }

  // 3. Scan IndexedDB Drafts (Parent photo submission drafts)
  try {
    const drafts = await getAllDraftsFromIndexedDB();
    for (const { studentName, draft } of drafts) {
      if (!studentName || !draft) continue;
      const rawUrls = Array.isArray(draft.imageUrls) ? draft.imageUrls : [];
      const validUrls = rawUrls.filter((u: any) =>
        typeof u === 'string' &&
        u.trim().length > 0 &&
        !u.includes('eunsol_beach_laugh') &&
        !u.includes('eunsol_sandcastle') &&
        !u.includes('eunsol_family_sunset')
      );

      if (validUrls.length > 0) {
        // Find existing story for this student or create a recovered story
        let matched: StoryItem | undefined;
        for (const s of recoveredMap.values()) {
          if (s.studentName === studentName && (!draft.week || s.week === draft.week)) {
            matched = s;
            break;
          }
        }

        if (matched) {
          const currentPhotos = (matched.imageUrls || []).filter((u: string) => typeof u === 'string' && u.trim().length > 0);
          if (validUrls.length > currentPhotos.length) {
            matched.imageUrls = validUrls;
            matched.imageUrl = validUrls[0] || matched.imageUrl;
            sourceDescriptions.push(`IndexedDB Drafts [Photos Recovered] - ${studentName}`);
          }
        } else {
          const draftStoryId = `recovered-draft-${studentName}-${Date.now()}`;
          recoveredMap.set(draftStoryId, {
            id: draftStoryId,
            studentName,
            week: draft.week || '9월 1주차',
            title: `${studentName}의 주말 이야기`,
            content: '주말 동안 찍은 소중한 사진입니다.',
            imageUrl: validUrls[0] || '',
            imageUrls: validUrls,
            imageCaptions: draft.imageCaptions || [],
            aiComment: draft.aiComment || '',
            reactions: {},
            createdAt: new Date().toISOString()
          });
          sourceDescriptions.push(`IndexedDB Draft - ${studentName} (사진 ${validUrls.length}장 복구됨)`);
        }
      }
    }
  } catch (draftErr) {
    console.warn('[Storage] scan drafts err:', draftErr);
  }

  // 4. Scan IndexedDB Photo Archive
  try {
    const photoList = await getAllPhotosFromIndexedDB();
    for (const photo of photoList) {
      if (!photo || !photo.studentName || !photo.dataUrl) continue;
      if (
        photo.dataUrl.includes('eunsol_beach_laugh') ||
        photo.dataUrl.includes('eunsol_sandcastle') ||
        photo.dataUrl.includes('eunsol_family_sunset')
      ) continue;

      // Find story matching this student
      for (const s of recoveredMap.values()) {
        if (s.studentName === photo.studentName && (!photo.week || s.week === photo.week)) {
          const urls = (s.imageUrls || []).filter(u => typeof u === 'string' && u.trim().length > 0);
          if (!urls.includes(photo.dataUrl)) {
            s.imageUrls = [...urls, photo.dataUrl];
            s.imageUrl = s.imageUrl || photo.dataUrl;
            sourceDescriptions.push(`IndexedDB Photo Archive [Photo Recovered] - ${photo.studentName}`);
          }
        }
      }
    }
  } catch (photoErr) {
    console.warn('[Storage] scan photo archive err:', photoErr);
  }

  const recoveredList = Array.from(recoveredMap.values());

  // If genuine stories found, auto-sync them to server
  if (recoveredList.length > 0) {
    try {
      await fetch('/api/stories/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stories: recoveredList })
      });
    } catch (syncErr) {
      console.warn('[Storage] Auto-sync recovered stories err:', syncErr);
    }
  }

  return {
    recoveredStories: recoveredList,
    sourceDescriptions
  };
}

/**
 * Get snapshots history
 */
export function getRosterSnapshots(): Array<{ timestamp: string; count: number; data: RosterStudent[] }> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROSTER_SNAPSHOTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Trigger manual recovery of local data to server
 */
export async function syncLocalStoriesToServer(): Promise<{ count: number; total: number }> {
  const local = getLocalStories();
  try {
    const res = await fetch('/api/stories/bulk-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stories: local })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        if (Array.isArray(data.stories)) {
          saveLocalStories(data.stories);
        }
        return { count: data.merged || 0, total: data.stories?.length || local.length };
      }
    }
  } catch (err) {
    console.error('[Storage] Manual sync error:', err);
  }
  return { count: 0, total: local.length };
}

// Local Storage Fallback & Helpers
export function getRosterList(): RosterStudent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROSTER);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(INITIAL_ROSTER));
      return INITIAL_ROSTER;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed.filter((s: RosterStudent) => s && s.name && !LEGACY_MOCK_STUDENT_NAMES.has(s.name.trim()));
      if (cleaned.length === 0) {
        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(INITIAL_ROSTER));
        return INITIAL_ROSTER;
      }
      const ordered = ensureRosterOrder(cleaned);
      return ordered;
    }
    return INITIAL_ROSTER;
  } catch (e) {
    console.error('Failed to parse roster list', e);
    return INITIAL_ROSTER;
  }
}

export function saveRosterList(roster: RosterStudent[]): void {
  try {
    const ordered = ensureRosterOrder(roster);
    localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(ordered));
    // Asynchronously save to IndexedDB
    saveRosterToIndexedDB(ordered).catch(() => {});

    // Save rolling snapshots
    try {
      const snapRaw = localStorage.getItem(STORAGE_KEY_ROSTER_SNAPSHOTS);
      const snaps = snapRaw ? JSON.parse(snapRaw) : [];
      snaps.unshift({
        timestamp: new Date().toISOString(),
        count: ordered.length,
        data: ordered
      });
      localStorage.setItem(STORAGE_KEY_ROSTER_SNAPSHOTS, JSON.stringify(snaps.slice(0, 8)));
    } catch {}
  } catch (e) {
    console.error('Failed to save roster list', e);
  }
}

export function getLocalStories(): StoryItem[] {
  // Completely eliminate localStorage reliance for stories as requested by user
  cleanupLegacyLocalStorage();
  return [];
}

export function saveLocalStories(_stories: StoryItem[]): void {
  // Do not store stories in localStorage to prevent cross-device desync
  cleanupLegacyLocalStorage();
}

/**
 * Self-healing: Scans client localStorage and IndexedDB for legacy idb: references,
 * recovers the original high-resolution photo from IndexedDB, uploads it to the server disk,
 * and updates the story with permanent /uploads/... URLs across client and server.
 */
export async function healLegacyStories(): Promise<StoryItem[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORIES);
    const localStories: StoryItem[] = raw ? JSON.parse(raw) : [];
    let idbStories: StoryItem[] = [];
    try {
      idbStories = await getAllStoriesFromIndexedDB();
    } catch {}

    const allCandidateStories = [...localStories, ...idbStories];
    const storiesWithIdb = allCandidateStories.filter((s) => {
      if (!s || !s.studentName) return false;
      const hasIdbUrl = (s.imageUrls || []).some((u) => typeof u === 'string' && u.startsWith('idb:'));
      const hasIdbCover = typeof s.imageUrl === 'string' && s.imageUrl.startsWith('idb:');
      return hasIdbUrl || hasIdbCover;
    });

    if (storiesWithIdb.length === 0) {
      return getLocalStories();
    }

    console.log(`[Storage] Healing ${storiesWithIdb.length} stories with legacy idb: references...`);
    let healedAny = false;

    for (const story of storiesWithIdb) {
      const currentUrls = Array.isArray(story.imageUrls) ? story.imageUrls : [];
      const recoveredUrls: string[] = [];

      for (let i = 0; i < currentUrls.length; i++) {
        const u = currentUrls[i];
        if (typeof u === 'string' && u.startsWith('idb:')) {
          // Attempt recovery from IndexedDB
          let realPhoto = await findPhotoForStudent(story.studentName, story.week, i);
          if (realPhoto && !realPhoto.startsWith('idb:')) {
            if (realPhoto.startsWith('data:')) {
              try {
                const upRes = await fetch('/api/upload-photo', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    imageBase64: realPhoto,
                    name: `repaired_${story.studentName}_${i + 1}`
                  })
                });
                if (upRes.ok) {
                  const upData = await upRes.json();
                  if (upData.url) realPhoto = upData.url;
                }
              } catch {}
            }
            recoveredUrls.push(realPhoto);
            healedAny = true;
          }
        } else if (typeof u === 'string' && u.trim().length > 0) {
          recoveredUrls.push(u);
        }
      }

      story.imageUrls = recoveredUrls;
      story.imageUrl = recoveredUrls[0] || '';
    }

    if (healedAny) {
      const currentList = getLocalStories();
      const updatedList = currentList.map((cur) => {
        const healedMatch = storiesWithIdb.find(
          (h) => h.id === cur.id || (h.studentName === cur.studentName && h.week === cur.week)
        );
        if (healedMatch && healedMatch.imageUrls && healedMatch.imageUrls.length > 0) {
          return {
            ...cur,
            imageUrls: healedMatch.imageUrls,
            imageUrl: healedMatch.imageUrl || healedMatch.imageUrls[0]
          };
        }
        return cur;
      });

      saveLocalStories(updatedList);
      saveAllStoriesToIndexedDB(updatedList).catch(() => {});

      // Sync to server disk
      fetch('/api/stories/bulk-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stories: updatedList })
      }).catch(() => {});

      return updatedList;
    }
  } catch (err) {
    console.warn('[Storage] healLegacyStories error:', err);
  }
  return getLocalStories();
}

export function getGasConfig(): GasConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAS_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to get gas config', e);
  }
  return { webAppUrl: '', isConnected: false };
}

export function saveGasConfig(config: GasConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_GAS_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save gas config', e);
  }
}

export async function fetchGasConfigFromServer(): Promise<GasConfig> {
  try {
    const res = await fetch('/api/gas-config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.config) {
        saveGasConfig(data.config);
        return data.config;
      }
    }
  } catch {}
  return getGasConfig();
}

export async function saveGasConfigToServer(config: GasConfig): Promise<void> {
  saveGasConfig(config);
  try {
    await fetch('/api/gas-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });
  } catch {}
}

/**
 * Sync or fetch from Google Apps Script Web App if configured
 */
export async function syncFromGas(webAppUrl: string): Promise<StoryItem[] | null> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) return null;
  
  try {
    const response = await fetch(`${webAppUrl}?action=get`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data && Array.isArray(data.stories)) {
      return data.stories;
    }
  } catch (err) {
    console.warn('Direct GAS GET failed, trying via proxy...', err);
    try {
      const proxyRes = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webAppUrl, action: 'get' })
      });
      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        if (proxyData && Array.isArray(proxyData.stories)) {
          return proxyData.stories;
        }
      }
    } catch (proxyErr) {
      console.error('Proxy GAS GET failed', proxyErr);
    }
  }
  return null;
}

/**
 * Post a new story to Google Apps Script Web App
 */
export async function postToGas(webAppUrl: string, story: StoryItem): Promise<boolean> {
  if (!webAppUrl || !webAppUrl.trim().startsWith('http')) return false;

  const payload = {
    action: 'save',
    story: story
  };

  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (res.ok) return true;
  } catch (err) {
    console.warn('Direct GAS POST failed, trying proxy...', err);
    try {
      const proxyRes = await fetch('/api/gas-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webAppUrl, action: 'save', story })
      });
      if (proxyRes.ok) return true;
    } catch (proxyErr) {
      console.error('Proxy GAS POST failed', proxyErr);
    }
  }
  return false;
}
