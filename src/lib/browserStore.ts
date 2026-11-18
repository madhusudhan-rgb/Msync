import type { Track } from './types';

/**
 * Browser preview persistence. IndexedDB keeps the actual file blobs, so files
 * added in the browser survive a reload even though blob: URLs do not.
 */
const DB_NAME = 'musicplayer';
const STORE = 'files';
const DB_VERSION = 1;

export interface StoredBrowserTrack {
  id: string;
  blob: Blob;
  track: Omit<Track, 'path'>;
}

let database: Promise<IDBDatabase | null> | null = null;

function getDatabase(): Promise<IDBDatabase | null> {
  if (database) return database;

  database = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });

  return database;
}

function finish(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

export async function putBrowserTrack(entry: StoredBrowserTrack): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put(entry);
    await finish(transaction);
  } catch {
    // A full or blocked store should not stop playback.
  }
}

export async function getBrowserTracks(): Promise<StoredBrowserTrack[]> {
  const db = await getDatabase();
  if (!db) return [];

  try {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    const rows = await new Promise<StoredBrowserTrack[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as StoredBrowserTrack[]);
      request.onerror = () => reject(request.error);
    });
    return rows.filter((row) => row && row.blob && row.track);
  } catch {
    return [];
  }
}

export async function removeBrowserTrack(id: string): Promise<void> {
  const db = await getDatabase();
  if (!db) return;
  try {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).delete(id);
    await finish(transaction);
  } catch {
    // Ignore a failed cleanup; the entry is simply gone from the UI.
  }
}
