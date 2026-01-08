
const DB_NAME = 'SoundSpotDB';
const STORE_NAME = 'audios';
const DB_VERSION = 1;

export interface AudioData {
  id: string;
  title: string;
  author: string;
  authorUsername?: string;
  authorId?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  distance: string;
  duration: string;
  likes: number;
  comments: number;
  category: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  isLiked?: boolean;
  privacy?: 'public' | 'hidden' | 'private';
  blob?: Blob; // The actual audio file
  audioUrl?: string; // The blob URL for playback (generated at runtime)
  moderation_status?: 'pending' | 'safe' | 'flagged';
  moderation_reason?: string;
  color?: string;
}

const CACHE_STORE_NAME = 'audio_cache';

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION + 1); // Increment version for new store

    request.onerror = (event) => {
      console.error("IndexedDB error:", event);
      reject("Error opening database");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveAudioCache = async (id: string, url: string): Promise<void> => {
    const db = await initDB();
    
    // Check if exists first
    const exists = await new Promise((resolve) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => resolve(!!request.result);
        request.onerror = () => resolve(false);
    });

    if (exists) return;

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        
        const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        store.put({ id, blob, timestamp: Date.now() });
    } catch (e) {
        console.error("Failed to cache audio", id, e);
    }
};

export const getCachedAudioBlob = async (id: string): Promise<Blob | null> => {
    const db = await initDB();
    return new Promise((resolve) => {
        const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CACHE_STORE_NAME);
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result?.blob || null);
        };
        request.onerror = () => resolve(null);
    });
};

export const saveAudioToDB = async (audio: AudioData, blob: Blob): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // We store the blob directly in the object
    // Note: We don't store the audioUrl string as it is temporary
    const { audioUrl, ...audioData } = audio;
    const record = { ...audioData, blob };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Error saving audio");
  });
};

export const updateAudioMetadataInDB = async (id: string, updates: Partial<AudioData>): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        reject("Audio not found");
        return;
      }

      // Merge updates, keeping the existing blob
      const updatedRecord = { ...record, ...updates };
      // Remove audioUrl if it somehow got into updates (shouldn't be stored)
      delete updatedRecord.audioUrl;

      const putRequest = store.put(updatedRecord);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject("Error updating audio");
    };

    getRequest.onerror = () => reject("Error fetching audio for update");
  });
};

export const getAudiosFromDB = async (): Promise<AudioData[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = request.result;
      // Convert blobs back to URLs for the app to use
      const audios = records.map((record: any) => ({
        ...record,
        audioUrl: record.blob ? URL.createObjectURL(record.blob) : undefined
      }));
      resolve(audios);
    };
    request.onerror = () => reject("Error fetching audios");
  });
};

export const deleteAudioFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject("Error deleting audio");
  });
};
