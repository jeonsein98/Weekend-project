import { StoryItem, GasConfig, RosterStudent } from '../types';
import { INITIAL_STORIES } from './defaultData';

const STORAGE_KEY_STORIES = 'weekend_stories_data_v1';
const STORAGE_KEY_GAS_CONFIG = 'weekend_stories_gas_config_v1';
const STORAGE_KEY_ROSTER = 'kindergarten_roster_v1';

export const INITIAL_ROSTER: RosterStudent[] = [
  { id: 'roster-eunsol', name: '김은솔', className: '은솔1반', parentPin: '1234', note: '가상 원아 (학부모 참고 예시)' }
];

export function ensureRosterOrder(list: RosterStudent[]): RosterStudent[] {
  if (!Array.isArray(list) || list.length === 0) return list;
  const result = [...list];
  const idxA = result.findIndex((s) => s.name === '안세은');
  const idxB = result.findIndex((s) => s.name === '엄소율');

  if (idxA !== -1 && idxB !== -1 && idxA > idxB) {
    const [seEun] = result.splice(idxA, 1);
    const newIdxB = result.findIndex((s) => s.name === '엄소율');
    result.splice(newIdxB, 0, seEun);
  }
  return result;
}

export function getRosterList(): RosterStudent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROSTER);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(INITIAL_ROSTER));
      return INITIAL_ROSTER;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Filter out legacy demo students (roster-1..5) unless user added them
      const legacyDemoIds = new Set(['roster-1', 'roster-2', 'roster-3', 'roster-4', 'roster-5']);
      const filtered = parsed.filter((s: RosterStudent) => !legacyDemoIds.has(s.id));

      // Ensure Eunsol student exists in roster
      if (!filtered.some((s: RosterStudent) => s.name === '김은솔')) {
        const updated = ensureRosterOrder([INITIAL_ROSTER[0], ...filtered]);
        localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(updated));
        return updated;
      }
      const ordered = ensureRosterOrder(filtered);
      localStorage.setItem(STORAGE_KEY_ROSTER, JSON.stringify(ordered));
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
      localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(INITIAL_STORIES));
      return INITIAL_STORIES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Normalize stories so imageUrls is guaranteed
      const normalized = parsed.map((item: any) => ({
        ...item,
        imageUrls: item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0
          ? item.imageUrls
          : (item.imageUrl ? [item.imageUrl] : [])
      }));

      // Always sync Eunsol sample story images with latest default child photos
      const eunsolIdx = normalized.findIndex((s: any) => s.id === 'demo-eunsol' || s.studentName === '김은솔');
      if (eunsolIdx !== -1) {
        normalized[eunsolIdx] = {
          ...normalized[eunsolIdx],
          imageUrls: INITIAL_STORIES[0].imageUrls,
          imageCaptions: INITIAL_STORIES[0].imageCaptions
        };
        localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(normalized));
        return normalized;
      } else {
        const updated = [INITIAL_STORIES[0], ...normalized];
        localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(updated));
        return updated;
      }
    }
    return INITIAL_STORIES;
  } catch (e) {
    console.error('Failed to parse local stories', e);
    return INITIAL_STORIES;
  }
}

export function saveLocalStories(stories: StoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STORIES, JSON.stringify(stories));
  } catch (e) {
    console.error('Failed to save local stories', e);
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
    // Try fetching directly or via proxy endpoint
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
    // Note: GAS requires text/plain or no-cors for standard web app redirection
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
