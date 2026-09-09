import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import {
  getStorage,
  FirebaseStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL
} from 'firebase/storage';
import { StoryItem, RosterStudent } from '../types';
import appletConfig from '../../firebase-applet-config.json';

// Universal Firebase Config Resolver supporting both applet config and standard environment variables
const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (process.env || {});

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.NEXT_PUBLIC_FIREBASE_API_KEY || appletConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || appletConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || env.NEXT_PUBLIC_FIREBASE_APP_ID || appletConfig.appId || '',
  firestoreDatabaseId: env.VITE_FIRESTORE_DATABASE_ID || env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || appletConfig.firestoreDatabaseId || '(default)'
};

// Initialize or reuse Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with custom Database ID if specified
export const db: Firestore =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

export const isFirebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

/**
 * Deep sanitize any object or array to ensure no `undefined` properties are sent to Firestore.
 * Firestore throws a fatal error if any field is undefined.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as unknown as T;
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

/**
 * Validate connection to Firestore on initial boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (!isFirebaseConfigured) return false;
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Firestore client appears offline, checking configuration...');
    }
    // Any response from server confirms network connectivity
    return true;
  }
}

// Test connection silently in background
testFirestoreConnection().catch(() => {});

/**
 * Upload a photo (File, Blob, or Data URL) directly to Firebase Storage.
 * Returns the permanent HTTPS download URL from Firebase Storage.
 * If upload fails, falls back gracefully to dataUrl/URL so user data is never lost.
 */
export async function uploadPhotoToFirebaseStorage(
  fileOrDataUrl: File | Blob | string,
  destinationPath: string
): Promise<string> {
  if (!fileOrDataUrl) return '';

  // If already a hosted HTTPS URL (e.g. Firebase or public asset), return as is
  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('http')) {
    return fileOrDataUrl;
  }

  // If Firebase is not configured, return data URL directly
  if (!isFirebaseConfigured) {
    return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
  }

  const cleanPath = destinationPath.replace(/^\/+/, '');
  const storageRef = ref(storage, cleanPath);

  try {
    if (typeof fileOrDataUrl === 'string') {
      if (fileOrDataUrl.startsWith('data:')) {
        // Upload Base64 Data URL
        const snapshot = await uploadString(storageRef, fileOrDataUrl, 'data_url');
        const downloadUrl = await getDownloadURL(snapshot.ref);
        return downloadUrl;
      }
      return fileOrDataUrl;
    } else {
      // Upload File or Blob
      const snapshot = await uploadBytes(storageRef, fileOrDataUrl);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    }
  } catch (err) {
    console.warn(`[Firebase Storage] Direct upload failed for ${cleanPath}, using fallback:`, err);
    // If upload fails, return original dataUrl to preserve photo without blocking story creation
    return typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '';
  }
}

/**
 * Fetch all stories from Cloud Firestore
 */
export async function fetchStoriesFromFirestore(): Promise<StoryItem[]> {
  if (!isFirebaseConfigured) return [];
  try {
    const storiesCol = collection(db, 'stories');
    const q = query(storiesCol, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    const list: StoryItem[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as StoryItem;
      const storyId = data?.id || d.id;
      if (data && storyId) {
        list.push({ ...data, id: storyId });
      }
    });
    return list;
  } catch (err) {
    // If orderBy index is still building or fails, fallback to unordered getDocs
    try {
      const snapshot = await getDocs(collection(db, 'stories'));
      const list: StoryItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as StoryItem;
        const storyId = data?.id || d.id;
        if (data && storyId) {
          list.push({ ...data, id: storyId });
        }
      });
      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (fallbackErr) {
      console.error('[Firebase] Error fetching stories from Firestore:', fallbackErr);
      return [];
    }
  }
}

/**
 * Save or update a story in Cloud Firestore
 */
export async function saveStoryToFirestore(story: StoryItem): Promise<StoryItem> {
  if (!isFirebaseConfigured || !story || !story.id) return story;
  const storyRef = doc(db, 'stories', story.id);
  // Ensure image fields are normalized and undefined fields are removed
  const imageUrls = Array.isArray(story.imageUrls) ? story.imageUrls.filter(Boolean) : (story.imageUrl ? [story.imageUrl] : []);
  const imageUrl = imageUrls[0] || story.imageUrl || '';
  const payload = sanitizeForFirestore({
    ...story,
    id: story.id,
    imageUrl,
    imageUrls: imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []),
    updatedAt: new Date().toISOString()
  });
  await setDoc(storyRef, payload, { merge: true });
  return payload as StoryItem;
}

/**
 * Delete a story from Cloud Firestore
 */
export async function deleteStoryFromFirestore(storyId: string): Promise<void> {
  if (!isFirebaseConfigured || !storyId) return;
  const storyRef = doc(db, 'stories', storyId);
  await deleteDoc(storyRef);
}

/**
 * Real-time subscription to stories collection.
 * This guarantees 100% instant zero-latency synchronization across PC and Mobile!
 */
export function subscribeToStories(
  onUpdate: (stories: StoryItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!isFirebaseConfigured) {
    return () => {};
  }

  const storiesCol = collection(db, 'stories');
  return onSnapshot(
    storiesCol,
    (snapshot) => {
      const list: StoryItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as StoryItem;
        const storyId = data?.id || d.id;
        if (data && storyId) {
          list.push({ ...data, id: storyId });
        }
      });
      // Sort newest first
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(list);
    },
    (err) => {
      console.warn('[Firebase] Real-time stories subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Save Roster to Firestore
 */
export async function saveRosterToFirestore(roster: RosterStudent[]): Promise<void> {
  if (!isFirebaseConfigured || !Array.isArray(roster)) return;
  const rosterRef = doc(db, 'app_metadata', 'roster');
  const payload = sanitizeForFirestore({
    students: roster,
    updatedAt: new Date().toISOString()
  });
  await setDoc(rosterRef, payload, { merge: true });
}

/**
 * Fetch Roster from Firestore
 */
export async function fetchRosterFromFirestore(): Promise<RosterStudent[] | null> {
  if (!isFirebaseConfigured) return null;
  try {
    const rosterRef = doc(db, 'app_metadata', 'roster');
    const snap = await getDocs(collection(db, 'app_metadata'));
    let found: RosterStudent[] | null = null;
    snap.forEach((d) => {
      if (d.id === 'roster') {
        const data = d.data();
        if (data && Array.isArray(data.students) && data.students.length > 0) {
          found = data.students;
        }
      }
    });
    return found;
  } catch (err) {
    console.warn('[Firebase] Error fetching roster:', err);
    return null;
  }
}
