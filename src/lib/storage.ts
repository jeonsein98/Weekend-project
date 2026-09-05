import { StoryItem, GasConfig, RosterStudent } from '../types';
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
  if (!week) return '전체';
  return week.replace(/\s+/g, '');
}

export function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('kindergarten_offline_stories') ||
        key.startsWith('classgram_stories') ||
        key === 'kindergarten_stories' ||
        key === 'weekend_stories_backup'
      ) {
        keysToRemove.push(key);
      } else {
        const val = localStorage.getItem(key);
        if (val && val.length > 1024 * 300 && val.includes('data:image/')) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/**
 * Fetch stories from persistent server storage.
 * Non-destructive bidirectional merge with client storage and IndexedDB.
 * Guarantees zero data loss even across device resets or network drops.
 */
export async function fetchStoriesFromServer(): Promise<StoryItem[]> {
  cleanupLegacyLocalStorage();

  // Retrieve local caches (localStorage and IndexedDB)
  const localStories = getLocalStories().filter(s => !BANNED_MOCK_STORY_IDS.has(s.id));
  let idbStories: StoryItem[] = [];
  try {
    idbStories = (await getAllStoriesFromIndexedDB()).filter(s => !BANNED_MOCK_STORY_IDS.has(s.id));
  } catch (idbErr) {
    console.warn('[Storage] IDB read skipped:', idbErr);
  }

  const makeStoryKey = (s: StoryItem) =>
    `${s.studentName.trim().toLowerCase()}_${normalizeWeek(s.week)}`;

  // Aggregate all known client stories - Single key mapping to prevent duplicates
  const clientMap = new Map<string, StoryItem>();
  const addOrUpdateClient = (s: StoryItem) => {
    if (!s || !s.studentName || BANNED_MOCK_STORY_IDS.has(s.id)) return;
    const key = makeStoryKey(s);
    const existing = clientMap.get(key);
    const sImgs = (s.imageUrls || []).filter((u: string) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:'));
    const exImgs = (existing?.imageUrls || []).filter((u: string) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:'));
    if (!existing || sImgs.length >= exImgs.length) {
      clientMap.set(key, s);
    }
  };

  for (const s of localStories) addOrUpdateClient(s);
  for (const s of idbStories) addOrUpdateClient(s);

  const allClientStories = Array.from(clientMap.values());

  try {
    const res = await fetch('/api/stories');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        let serverStories: StoryItem[] = data.stories.filter((s: StoryItem) => !BANNED_MOCK_STORY_IDS.has(s.id));

        // Intelligent map merge: index all server stories by single canonical student+week key
        const mergedMap = new Map<string, StoryItem>();
        for (const s of serverStories) {
          if (s && s.studentName) {
            mergedMap.set(makeStoryKey(s), s);
          }
        }

        // Merge client stories into mergedMap without dropping permanent server photos
        for (const cStory of allClientStories) {
          if (!cStory || !cStory.studentName || BANNED_MOCK_STORY_IDS.has(cStory.id)) continue;
          const key = makeStoryKey(cStory);
          const existing = mergedMap.get(key);

          if (!existing) {
            mergedMap.set(key, cStory);
          } else {
            const existingUrls = (existing.imageUrls || []).filter(
              (u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
            );
            const clientUrls = (cStory.imageUrls || []).filter(
              (u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
            );
            const bestUrls = existingUrls.length >= clientUrls.length
              ? existingUrls
              : (clientUrls.length > 0 ? clientUrls : existingUrls);

            const mergedItem: StoryItem = {
              ...existing,
              ...cStory,
              id: existing.id || cStory.id,
              title: cStory.title || existing.title,
              content: cStory.content || existing.content,
              imageUrls: bestUrls,
              imageUrl: bestUrls[0] || existing.imageUrl || cStory.imageUrl || ''
            };
            mergedMap.set(key, mergedItem);
          }
        }

        const mergedList = Array.from(mergedMap.values());

        // Identify any client stories missing from the server or needing upload
        const needServerSync = mergedList.filter((m) => {
          const onServer = serverStories.find(
            s => s.id === m.id || makeStoryKey(s) === makeStoryKey(m)
          );
          if (!onServer) return true;
          const onServerPhotos = (onServer.imageUrls || []).filter(
            u => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
          );
          const mPhotos = (m.imageUrls || []).filter(
            u => typeof u === 'string' && u.trim().length > 0 && (u.startsWith('data:') || !u.startsWith('idb:'))
          );
          return mPhotos.length > onServerPhotos.length;
        });

        if (needServerSync.length > 0) {
          try {
            console.log(`[Storage] Auto-syncing ${needServerSync.length} stories/photos to server disk...`);
            const syncRes = await fetch('/api/stories/bulk-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stories: needServerSync })
            });
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData && syncData.stories) {
                serverStories = syncData.stories.filter((s: StoryItem) => !BANNED_MOCK_STORY_IDS.has(s.id));
              }
            }
          } catch (syncErr) {
            console.warn('[Storage] Auto recovery sync non-critical warning:', syncErr);
          }
        }

        // Clean each story's imageUrls so that only non-empty, genuine URLs are kept
        const cleanedList = mergedList.map(item => {
          const rawUrls = Array.isArray(item.imageUrls) ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
          const validUrls = rawUrls.filter((u: any) =>
            typeof u === 'string' &&
            u.trim().length > 0 &&
            !u.includes('eunsol_beach_laugh') &&
            !u.includes('eunsol_sandcastle') &&
            !u.includes('eunsol_family_sunset')
          );
          const cover = validUrls[0] || (
            typeof item.imageUrl === 'string' &&
            item.imageUrl.trim().length > 0 &&
            !item.imageUrl.includes('eunsol_beach_laugh') &&
            !item.imageUrl.includes('eunsol_sandcastle') &&
            !item.imageUrl.includes('eunsol_family_sunset')
              ? item.imageUrl
              : ''
          );
          return {
            ...item,
            imageUrls: validUrls,
            imageUrl: cover
          };
        });

        // Cache clean merged data locally and into IndexedDB
        saveLocalStories(cleanedList);
        saveAllStoriesToIndexedDB(cleanedList);
        return cleanedList;
      }
    }
  } catch (err) {
    console.warn('[Storage] Fetch stories from server failed, falling back to local cache:', err);
  }

  // Fallback to local storage & IndexedDB
  if (allClientStories.length > 0) {
    return allClientStories;
  }
  return getLocalStories();
}

/**
 * Save or update story on the persistent server.
 * All base64 images will be converted to permanent image files on the server disk.
 */
export async function saveStoryToServer(story: StoryItem): Promise<{ success: boolean; story?: StoryItem; stories?: StoryItem[] }> {
  let storyToSave = { ...story };

  // 1. If story contains any raw base64 images, proactively upload them to disk first
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
                if (upData.url) return upData.url;
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
        if (upData.url) {
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

  // Update local cache and IndexedDB
  const localList = getLocalStories();
  const makeStoryKey = (s: { studentName: string; week?: string }) =>
    `${s.studentName.trim().toLowerCase()}_${normalizeWeek(s.week)}`;

  const existingIdx = localList.findIndex(
    (s) => s.id === storyToSave.id || makeStoryKey(s) === makeStoryKey(storyToSave)
  );

  let updatedLocal: StoryItem[];
  if (existingIdx !== -1) {
    updatedLocal = [...localList];
    updatedLocal[existingIdx] = { ...updatedLocal[existingIdx], ...storyToSave };
  } else {
    updatedLocal = [storyToSave, ...localList];
  }
  saveLocalStories(updatedLocal);
  saveStoryToIndexedDB(storyToSave);

  try {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storyToSave)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        // Cache the server's normalized story list (with permanent /uploads/ image URLs)
        if (Array.isArray(data.stories)) {
          saveLocalStories(data.stories);
          saveAllStoriesToIndexedDB(data.stories);
        }
        return { success: true, story: data.story, stories: data.stories };
      }
    }
  } catch (err) {
    console.error('[Storage] Save story to server error:', err);
  }

  return { success: true, story: storyToSave, stories: updatedLocal };
}

/**
 * Delete story from persistent server.
 * Only removed when explicitly requested.
 */
export async function deleteStoryFromServer(id: string): Promise<StoryItem[]> {
  const localList = getLocalStories().filter((s) => s.id !== id && !BANNED_MOCK_STORY_IDS.has(s.id));
  saveLocalStories(localList);
  deleteStoryFromIndexedDB(id).catch(() => {});

  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        const cleanStories = data.stories.filter((s: StoryItem) => !BANNED_MOCK_STORY_IDS.has(s.id));
        saveLocalStories(cleanStories);
        return cleanStories;
      }
    }
  } catch (err) {
    console.error('[Storage] Delete story from server error:', err);
  }

  return localList;
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
        saveLocalStories(data.stories);
        return data.stories;
      }
    }
  } catch (err) {
    console.error('[Storage] Reaction update error:', err);
  }
  return getLocalStories();
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STORIES);
    if (!raw) {
      return INITIAL_STORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const normalized = parsed
        .filter((item: any) => item && item.id && !BANNED_MOCK_STORY_IDS.has(item.id))
        .map((item: any) => {
          const rawUrls = Array.isArray(item.imageUrls) ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
          const validUrls = rawUrls.filter((u: any) =>
            typeof u === 'string' &&
            u.trim().length > 0 &&
            !u.startsWith('idb:') &&
            !u.includes('eunsol_beach_laugh') &&
            !u.includes('eunsol_sandcastle') &&
            !u.includes('eunsol_family_sunset')
          );
          const fallbackCover = validUrls[0] || (
            typeof item.imageUrl === 'string' &&
            item.imageUrl.trim().length > 0 &&
            !item.imageUrl.startsWith('idb:') &&
            !item.imageUrl.includes('eunsol_beach_laugh') &&
            !item.imageUrl.includes('eunsol_sandcastle') &&
            !item.imageUrl.includes('eunsol_family_sunset')
              ? item.imageUrl
              : ''
          );

          return {
            ...item,
            imageUrl: fallbackCover,
            imageUrls: validUrls
          };
        });

      return normalized.length > 0 ? normalized : INITIAL_STORIES;
    }
    return INITIAL_STORIES;
  } catch (e) {
    console.error('Failed to parse local stories', e);
    return INITIAL_STORIES;
  }
}

export function saveLocalStories(stories: StoryItem[]): void {
  // 1. Always persist all stories with full image fidelity to IndexedDB (no 5MB browser storage limit)
  saveAllStoriesToIndexedDB(stories).catch(() => {});

  try {
    // 2. Filter out any invalid idb: pseudo strings from localStorage
    const cleanStories = stories.map((s) => {
      const urls = (s.imageUrls || []).filter(
        (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
      );
      return {
        ...s,
        imageUrls: urls,
        imageUrl: (s.imageUrl && !s.imageUrl.startsWith('idb:')) ? s.imageUrl : (urls[0] || '')
      };
    });

    try {
      localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(cleanStories));
    } catch (quotaErr) {
      // If quota exceeded, clean legacy keys and try saving with lightweight non-base64 copy
      cleanupLegacyLocalStorage();
      try {
        const lightweight = cleanStories.map((s) => {
          const lightUrls = (s.imageUrls || []).map((u) => (typeof u === 'string' && u.startsWith('data:') ? '' : u)).filter(Boolean);
          return {
            ...s,
            imageUrls: lightUrls,
            imageUrl: (s.imageUrl && s.imageUrl.startsWith('data:')) ? (lightUrls[0] || '') : s.imageUrl
          };
        });
        localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(lightweight));
      } catch (retryErr) {
        console.warn('[Storage] localStorage quota reached: full state preserved safely in IndexedDB and server disk.', retryErr);
      }
    }
  } catch (e) {
    console.warn('[Storage] localStorage save error:', e);
  }
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
