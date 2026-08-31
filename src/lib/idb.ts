import { StoryItem } from '../types';

const DB_NAME = 'ClassgramOfflineDB_v1';
const DB_VERSION = 1;
const STORE_STORIES = 'stories';
const STORE_DRAFTS = 'drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_STORIES)) {
        db.createObjectStore(STORE_STORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'studentName' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveStoryToIndexedDB(story: StoryItem): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_STORIES);
    store.put(story);
  } catch (err) {
    console.warn('[IDB] saveStoryToIndexedDB failed:', err);
  }
}

export async function saveAllStoriesToIndexedDB(stories: StoryItem[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_STORIES);
    for (const s of stories) {
      store.put(s);
    }
  } catch (err) {
    console.warn('[IDB] saveAllStoriesToIndexedDB failed:', err);
  }
}

export async function getAllStoriesFromIndexedDB(): Promise<StoryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_STORIES, 'readonly');
      const store = tx.objectStore(STORE_STORIES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

export async function saveDraftToIndexedDB(studentName: string, draft: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    store.put({ studentName, draft, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.warn('[IDB] saveDraftToIndexedDB failed:', err);
  }
}

export async function getDraftFromIndexedDB(studentName: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.get(studentName);
      req.onsuccess = () => resolve(req.result ? req.result.draft : null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

export async function clearDraftFromIndexedDB(studentName: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_DRAFTS, 'readwrite');
    const store = tx.objectStore(STORE_DRAFTS);
    store.delete(studentName);
  } catch (err) {
    console.warn('[IDB] clearDraftFromIndexedDB failed:', err);
  }
}
