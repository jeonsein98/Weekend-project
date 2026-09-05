import { StoryItem, RosterStudent } from '../types';

const DB_NAME = 'ClassgramOfflineDB_v1';
const DB_VERSION = 3;
const STORE_STORIES = 'stories';
const STORE_DRAFTS = 'drafts';
const STORE_ROSTER = 'roster';
const STORE_PHOTOS = 'photos';

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
      if (!db.objectStoreNames.contains(STORE_ROSTER)) {
        db.createObjectStore(STORE_ROSTER, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PHOTOS)) {
        db.createObjectStore(STORE_PHOTOS, { keyPath: 'photoKey' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save a single photo permanently into the dedicated photos store
 */
export async function savePhotoToIndexedDB(
  photoKey: string,
  dataUrl: string,
  meta?: { studentName?: string; week?: string; photoIndex?: number }
): Promise<void> {
  if (!photoKey || !dataUrl || typeof dataUrl !== 'string' || dataUrl.startsWith('idb:')) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_PHOTOS, 'readwrite');
    const store = tx.objectStore(STORE_PHOTOS);
    store.put({
      photoKey,
      dataUrl,
      studentName: meta?.studentName || '',
      week: meta?.week || '',
      photoIndex: meta?.photoIndex ?? 0,
      savedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[IDB] savePhotoToIndexedDB failed:', err);
  }
}

/**
 * Get a photo by its exact photoKey
 */
export async function getPhotoFromIndexedDB(photoKey: string): Promise<string | null> {
  if (!photoKey || photoKey.startsWith('idb:')) return null;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const store = tx.objectStore(STORE_PHOTOS);
      const req = store.get(photoKey);
      req.onsuccess = () => {
        const val = req.result?.dataUrl || null;
        if (val && typeof val === 'string' && !val.startsWith('idb:')) {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Self-healing: Find any archived photo for a student in IndexedDB
 */
export async function findPhotoForStudent(
  studentName: string,
  week?: string,
  photoIndex = 0
): Promise<string | null> {
  if (!studentName) return null;
  const cleanName = studentName.trim().toLowerCase();

  try {
    const db = await openDB();

    // 1. Check dedicated photos store
    if (db.objectStoreNames.contains(STORE_PHOTOS)) {
      const photoMatch = await new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_PHOTOS, 'readonly');
        const store = tx.objectStore(STORE_PHOTOS);
        const req = store.getAll();
        req.onsuccess = () => {
          const items = req.result || [];
          // Search with week match first
          const exact = items.find(
            (it: any) =>
              it &&
              it.studentName?.trim().toLowerCase() === cleanName &&
              (!week || week === '전체' || it.week === week) &&
              it.photoIndex === photoIndex &&
              typeof it.dataUrl === 'string' &&
              it.dataUrl.length > 0 &&
              !it.dataUrl.startsWith('idb:')
          );
          if (exact) return resolve(exact.dataUrl);

          // Search any photo for this student and week
          const anyForWeek = items.find(
            (it: any) =>
              it &&
              it.studentName?.trim().toLowerCase() === cleanName &&
              (!week || week === '전체' || it.week === week) &&
              typeof it.dataUrl === 'string' &&
              it.dataUrl.length > 0 &&
              !it.dataUrl.startsWith('idb:')
          );
          if (anyForWeek) return resolve(anyForWeek.dataUrl);

          // Search any photo for this student regardless of week
          const anyStudentPhoto = items.find(
            (it: any) =>
              it &&
              it.studentName?.trim().toLowerCase() === cleanName &&
              typeof it.dataUrl === 'string' &&
              it.dataUrl.length > 0 &&
              !it.dataUrl.startsWith('idb:')
          );
          if (anyStudentPhoto) return resolve(anyStudentPhoto.dataUrl);

          resolve(null);
        };
        req.onerror = () => resolve(null);
      });
      if (photoMatch) return photoMatch;
    }

    // 2. Check stories store
    if (db.objectStoreNames.contains(STORE_STORIES)) {
      const storyMatch = await new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_STORIES, 'readonly');
        const store = tx.objectStore(STORE_STORIES);
        const req = store.getAll();
        req.onsuccess = () => {
          const items: StoryItem[] = req.result || [];
          const matchedStory = items.find(
            (s) =>
              s &&
              s.studentName?.trim().toLowerCase() === cleanName &&
              (!week || week === '전체' || s.week === week)
          );
          if (matchedStory) {
            const urls = (matchedStory.imageUrls || []).filter(
              (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
            );
            if (urls[photoIndex]) return resolve(urls[photoIndex]);
            if (urls[0]) return resolve(urls[0]);
            if (matchedStory.imageUrl && !matchedStory.imageUrl.startsWith('idb:')) {
              return resolve(matchedStory.imageUrl);
            }
          }
          resolve(null);
        };
        req.onerror = () => resolve(null);
      });
      if (storyMatch) return storyMatch;
    }

    // 3. Check drafts store
    if (db.objectStoreNames.contains(STORE_DRAFTS)) {
      const draftMatch = await new Promise<string | null>((resolve) => {
        const tx = db.transaction(STORE_DRAFTS, 'readonly');
        const store = tx.objectStore(STORE_DRAFTS);
        const req = store.get(studentName.trim());
        req.onsuccess = () => {
          if (req.result && req.result.draft) {
            const draft = req.result.draft;
            const urls = (draft.imageUrls || []).filter(
              (u: any) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
            );
            if (urls[photoIndex]) return resolve(urls[photoIndex]);
            if (urls[0]) return resolve(urls[0]);
          }
          resolve(null);
        };
        req.onerror = () => resolve(null);
      });
      if (draftMatch) return draftMatch;
    }
  } catch (err) {
    console.warn('[IDB] findPhotoForStudent error:', err);
  }

  return null;
}

/**
 * Save story to IndexedDB with intelligent photo preservation
 */
export async function saveStoryToIndexedDB(story: StoryItem): Promise<void> {
  if (!story || !story.id) return;
  try {
    const db = await openDB();

    // Check existing story first to avoid wiping valid photos with an empty update
    const existing = await new Promise<StoryItem | null>((resolve) => {
      const tx = db.transaction(STORE_STORIES, 'readonly');
      const store = tx.objectStore(STORE_STORIES);
      const req = store.get(story.id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });

    let mergedStory = { ...story };
    if (existing) {
      const existingUrls = (existing.imageUrls || []).filter(
        (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
      );
      const incomingUrls = (story.imageUrls || []).filter(
        (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
      );

      // If incoming has fewer photos or empty cover, preserve existing photos
      if (existingUrls.length > incomingUrls.length) {
        mergedStory.imageUrls = existingUrls;
        mergedStory.imageUrl = existingUrls[0] || existing.imageUrl || mergedStory.imageUrl;
      }
    }

    const tx = db.transaction(STORE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_STORIES);
    store.put(mergedStory);

    // Also permanently archive photos into STORE_PHOTOS (only real images)
    const finalUrls = (mergedStory.imageUrls || []).filter(
      (u) => typeof u === 'string' && u.trim().length > 0 && !u.startsWith('idb:')
    );
    for (let idx = 0; idx < finalUrls.length; idx++) {
      const url = finalUrls[idx];
      const photoKey = `${mergedStory.studentName}_${mergedStory.week}_${idx}`;
      savePhotoToIndexedDB(photoKey, url, {
        studentName: mergedStory.studentName,
        week: mergedStory.week,
        photoIndex: idx
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[IDB] saveStoryToIndexedDB failed:', err);
  }
}

/**
 * Save all stories to IndexedDB - Non-destructive upsert (NEVER store.clear()!)
 */
export async function saveAllStoriesToIndexedDB(stories: StoryItem[]): Promise<void> {
  if (!Array.isArray(stories) || stories.length === 0) return;
  try {
    const db = await openDB();

    // Read all existing stories first to prevent overwriting rich photos with empty ones
    const existingList: StoryItem[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE_STORIES, 'readonly');
      const store = tx.objectStore(STORE_STORIES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const existingMap = new Map<string, StoryItem>();
    for (const ex of existingList) {
      if (ex && ex.id) {
        existingMap.set(ex.id, ex);
        existingMap.set(`${ex.studentName}_${ex.week}`, ex);
      }
    }

    const tx = db.transaction(STORE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_STORIES);

    for (const s of stories) {
      if (!s || !s.id) continue;
      const existing = existingMap.get(s.id) || existingMap.get(`${s.studentName}_${s.week}`);

      let toSave = { ...s };
      if (existing) {
        const existingUrls = (existing.imageUrls || []).filter(
          (u) => typeof u === 'string' && u.trim().length > 0
        );
        const incomingUrls = (s.imageUrls || []).filter(
          (u) => typeof u === 'string' && u.trim().length > 0
        );

        // Preserve existing photos if incoming has none or fewer
        if (existingUrls.length > incomingUrls.length) {
          toSave.imageUrls = existingUrls;
          toSave.imageUrl = existingUrls[0] || existing.imageUrl || toSave.imageUrl;
        }
      }

      store.put(toSave);

      // Archive photos permanently
      const urls = (toSave.imageUrls || []).filter(
        (u) => typeof u === 'string' && u.trim().length > 0
      );
      for (let idx = 0; idx < urls.length; idx++) {
        const photoKey = `${toSave.studentName}_${toSave.week}_${idx}`;
        savePhotoToIndexedDB(photoKey, urls[idx], {
          studentName: toSave.studentName,
          week: toSave.week,
          photoIndex: idx
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[IDB] saveAllStoriesToIndexedDB failed:', err);
  }
}

export async function deleteStoryFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_STORIES, 'readwrite');
    const store = tx.objectStore(STORE_STORIES);
    store.delete(id);
  } catch (err) {
    console.warn('[IDB] deleteStoryFromIndexedDB failed:', err);
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

export async function saveRosterToIndexedDB(roster: RosterStudent[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_ROSTER, 'readwrite');
    const store = tx.objectStore(STORE_ROSTER);
    store.clear();
    for (const r of roster) {
      store.put(r);
    }
  } catch (err) {
    console.warn('[IDB] saveRosterToIndexedDB failed:', err);
  }
}

export async function getAllDraftsFromIndexedDB(): Promise<Array<{ studentName: string; draft: any }>> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const store = tx.objectStore(STORE_DRAFTS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getAllPhotosFromIndexedDB(): Promise<Array<{ photoKey: string; dataUrl: string; studentName?: string; week?: string }>> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_PHOTOS)) return [];
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PHOTOS, 'readonly');
      const store = tx.objectStore(STORE_PHOTOS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getRosterFromIndexedDB(): Promise<RosterStudent[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_ROSTER, 'readonly');
      const store = tx.objectStore(STORE_ROSTER);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}
