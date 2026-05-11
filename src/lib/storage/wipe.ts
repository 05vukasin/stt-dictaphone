"use client";

import { dropDB } from "./idb";
import { clearDeviceSettingsFor } from "./settings-store";
import { clearTranscriptsFor } from "./transcripts-store";

// Deletes every device-local trace of one user: the per-user IDB database
// and the per-user localStorage slots (device settings + transcripts). Used
// by the explicit "Wipe all data" button in settings.
export async function wipeCurrentUserLocalData(userId: string): Promise<void> {
  clearDeviceSettingsFor(userId);
  clearTranscriptsFor(userId);
  await dropDB(userId);
}

// Soft variant used by the regular sign-out: drops the in-memory caches so
// the next user's render starts clean, but leaves persisted slots intact so
// the original owner sees their data when they sign back in.
export function softResetCachesFor(userId: string) {
  clearDeviceSettingsFor(userId);
  clearTranscriptsFor(userId);
}
