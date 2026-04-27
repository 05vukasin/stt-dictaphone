import type { RecordingBlob, RecordingId } from "@/types/recording";
import { getDB, RECORDINGS_STORE } from "./idb";

export async function putRecording(rec: RecordingBlob): Promise<void> {
  const db = await getDB();
  await db.put(RECORDINGS_STORE, rec);
}

export async function getRecording(id: RecordingId): Promise<RecordingBlob | undefined> {
  const db = await getDB();
  return db.get(RECORDINGS_STORE, id);
}

export async function deleteRecording(id: RecordingId): Promise<void> {
  const db = await getDB();
  await db.delete(RECORDINGS_STORE, id);
}

export async function listRecordingIds(): Promise<RecordingId[]> {
  const db = await getDB();
  const keys = await db.getAllKeys(RECORDINGS_STORE);
  return keys.map((k) => String(k));
}

export async function clearAllRecordings(): Promise<void> {
  const db = await getDB();
  await db.clear(RECORDINGS_STORE);
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
