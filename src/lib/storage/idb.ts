import { openDB, type IDBPDatabase } from "idb";
import type { RecordingBlob } from "@/types/recording";

const DB_NAME = "stt-dictaphone";
const DB_VERSION = 1;
const STORE = "recordings";

export interface DictaphoneDBSchema {
  recordings: {
    key: string;
    value: RecordingBlob;
    indexes: { "by-createdAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<DictaphoneDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<DictaphoneDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DictaphoneDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

export const RECORDINGS_STORE = STORE;

// Test-only: close any open connection and reset the cached DB promise so a
// fresh fake-indexeddb instance can take over without deadlocking.
export async function __resetDbForTests() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      db.close();
    } catch {
      // ignore
    }
  }
  dbPromise = null;
}
