import { openDB, type IDBPDatabase } from "idb";
import type { RecordingBlob } from "@/types/recording";

const DB_PREFIX = "stt-dictaphone";
const DB_VERSION = 1;
const STORE = "recordings";

export interface DictaphoneDBSchema {
  recordings: {
    key: string;
    value: RecordingBlob;
    indexes: { "by-createdAt": number };
  };
}

const handles = new Map<string, Promise<IDBPDatabase<DictaphoneDBSchema>>>();

export function dbNameFor(userId: string): string {
  return `${DB_PREFIX}:${userId}`;
}

export function getDB(userId: string): Promise<IDBPDatabase<DictaphoneDBSchema>> {
  if (!userId) throw new Error("getDB requires a userId");
  const name = dbNameFor(userId);
  let h = handles.get(name);
  if (!h) {
    h = openDB<DictaphoneDBSchema>(name, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-createdAt", "createdAt");
        }
      },
    });
    handles.set(name, h);
  }
  return h;
}

export async function dropDB(userId: string): Promise<void> {
  const name = dbNameFor(userId);
  const existing = handles.get(name);
  if (existing) {
    try {
      const db = await existing;
      db.close();
    } catch {
      // ignore
    }
    handles.delete(name);
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

export const RECORDINGS_STORE = STORE;

export async function __resetDbForTests() {
  for (const [name, p] of handles) {
    try {
      const db = await p;
      db.close();
    } catch {
      // ignore
    }
    try {
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    } catch {
      // ignore
    }
  }
  handles.clear();
}
