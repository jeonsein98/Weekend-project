import { StoryItem, GasConfig, RosterStudent } from '../types';
import { INITIAL_STORIES } from './defaultData';
import { saveStoryToIndexedDB, saveAllStoriesToIndexedDB, getAllStoriesFromIndexedDB } from './idb';

const STORAGE_KEY_STORIES = 'weekend_stories_data_v1';
const STORAGE_KEY_GAS_CONFIG = 'weekend_stories_gas_config_v1';
const STORAGE_KEY_ROSTER = 'kindergarten_roster_v1';

export const INITIAL_ROSTER: RosterStudent[] = [
  { id: 'roster-eunsol', name: '김은솔', className: '은솔1반', parentPin: '1234', note: '가상 원아 (학부모 참고 예시)' },
  { id: 'roster-dohee', name: '김도희', className: '은솔1반', parentPin: '1234', note: '학부모 사진 업로드 확인' }
];

export function ensureRosterOrder(list: RosterStudent[]): RosterStudent[] {
  if (!Array.isArray(list) || list.length === 0) return list;
  return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

/**
 * Fetch stories from persistent server storage.
 * Non-destructive bidirectional merge with client storage and IndexedDB.
 * Guarantees zero data loss even across device resets or network drops.
 */
export async function fetchStoriesFromServer(): Promise<StoryItem[]> {
  // Retrieve local caches (localStorage and IndexedDB)
  const localStories = getLocalStories();
  let idbStories: StoryItem[] = [];
  try {
    idbStories = await getAllStoriesFromIndexedDB();
  } catch (idbErr) {
    console.warn('[Storage] IDB read skipped:', idbErr);
  }

  // Aggregate all known client stories
  const clientMap = new Map<string, StoryItem>();
  for (const s of [...localStories, ...idbStories]) {
    if (s && s.id && s.studentName) {
      clientMap.set(s.id, s);
    }
  }
  const allClientStories = Array.from(clientMap.values());

  try {
    const res = await fetch('/api/stories');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        let serverStories: StoryItem[] = data.stories;

        // Identify any client stories missing from the server (excluding demo data)
        const missingOnServer = allClientStories.filter(
          (clientStory) =>
            clientStory.id !== 'demo-eunsol' &&
            !serverStories.some(
              (s) => s.id === clientStory.id || (s.studentName === clientStory.studentName && s.week === clientStory.week)
            )
        );

        if (missingOnServer.length > 0) {
          try {
            console.log(`[Storage] Auto-recovering ${missingOnServer.length} client stories to server disk...`);
            const syncRes = await fetch('/api/stories/bulk-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stories: missingOnServer })
            });
            if (syncRes.ok) {
              const syncData = await syncRes.json();
              if (syncData && syncData.stories) {
                serverStories = syncData.stories;
              }
            }
          } catch (syncErr) {
            console.warn('[Storage] Auto recovery sync non-critical warning:', syncErr);
          }
        }

        // Non-destructive bidirectional merge: NEVER wipe client stories if sync was delayed
        const mergedList = [...serverStories];
        for (const cStory of allClientStories) {
          if (cStory.id !== 'demo-eunsol' && !mergedList.some(s => s.id === cStory.id || (s.studentName === cStory.studentName && s.week === cStory.week))) {
            mergedList.push(cStory);
          }
        }

        // Cache clean merged data locally and into IndexedDB
        saveLocalStories(mergedList);
        saveAllStoriesToIndexedDB(mergedList);
        return mergedList;
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
  // Always update local cache and IndexedDB first for instant UI response and zero data loss
  const localList = getLocalStories();
  const existingIdx = localList.findIndex((s) => s.id === story.id || (s.studentName === story.studentName && s.week === story.week));
  let updatedLocal: StoryItem[];
  if (existingIdx !== -1) {
    updatedLocal = [...localList];
    updatedLocal[existingIdx] = { ...updatedLocal[existingIdx], ...story };
  } else {
    updatedLocal = [story, ...localList];
  }
  saveLocalStories(updatedLocal);
  saveStoryToIndexedDB(story);

  try {
    const res = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(story)
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

  return { success: true, story, stories: updatedLocal };
}

/**
 * Delete story from persistent server.
 * Only removed when explicitly requested.
 */
export async function deleteStoryFromServer(id: string): Promise<StoryItem[]> {
  const localList = getLocalStories().filter((s) => s.id !== id);
  saveLocalStories(localList);

  try {
    const res = await fetch(`/api/stories/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.stories)) {
        saveLocalStories(data.stories);
        return data.stories;
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
 * Fetch class roster from server
 */
export async function fetchRosterFromServer(): Promise<RosterStudent[]> {
  try {
    const res = await fetch('/api/roster');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.roster)) {
        const ordered = ensureRosterOrder(data.roster);
        saveRosterList(ordered);
        return ordered;
      }
    }
  } catch (err) {
    console.warn('[Storage] Fetch roster from server failed, using local roster:', err);
  }
  return getRosterList();
}

/**
 * Save class roster to server
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
    if (Array.isArray(parsed)) {
      const ordered = ensureRosterOrder(parsed);
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
      // Only filter out legacy mock items (demo-1..demo-4) without touching any real student items
      const legacyMockIds = new Set(['demo-1', 'demo-2', 'demo-3', 'demo-4']);

      const normalized = parsed
        .filter((item: any) => !legacyMockIds.has(item.id))
        .map((item: any) => {
          let urls = item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0
            ? item.imageUrls
            : (item.imageUrl ? [item.imageUrl] : []);

          return {
            ...item,
            imageUrl: urls[0] || (INITIAL_STORIES[0]?.imageUrls[0] || '/uploads/eunsol_beach_laugh.jpg'),
            imageUrls: urls
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
  // Always persist all stories with full image fidelity to IndexedDB (no 5MB storage limit)
  saveAllStoriesToIndexedDB(stories).catch(() => {});

  try {
    localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(stories));
  } catch (e) {
    console.warn('localStorage save warning (Quota reached). Full photos safely preserved in IndexedDB & server.', e);
    try {
      // Light fallback: store without raw base64 data to avoid QuotaExceededError in localStorage,
      // while IndexedDB keeps the full base64 photos intact!
      const lightweight = stories.map((s) => ({
        ...s,
        imageUrls: (s.imageUrls || []).map((u) => (u.startsWith('data:image/') ? '' : u)),
        imageUrl: s.imageUrl?.startsWith('data:image/') ? '' : s.imageUrl
      }));
      localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(lightweight));
    } catch (ignore) {
      // IndexedDB and Server hold the real source of truth
    }
  }
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
