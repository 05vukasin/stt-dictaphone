import "server-only";
import type { AudioFormat, SttProvider, SummaryProvider } from "@/types/settings";
import { decryptSecret } from "@/lib/crypto/secrets";
import {
  getDefaultGroup,
  getGroupById,
  getUserProfile,
  setUserGroup,
  type SettingsGroupRow,
  type UserProfileRow,
} from "./queries";

export interface EffectiveSettings {
  groupId: string;
  groupName: string;
  sttProvider: SttProvider;
  summaryProvider: SummaryProvider;
  openaiApiKey: string;
  groqApiKey: string;
  anthropicApiKey: string;
  language: string;
  autoSummarize: boolean;
  audioFormat: AudioFormat;
  sttPrompt: string;
  summaryPrompt: string;
  allowSummaryPromptOverride: boolean;
}

// Identical to EffectiveSettings minus the secret fields. The only variant
// that should ever cross the network boundary into a client component.
export type PublicEffectiveSettings = Omit<
  EffectiveSettings,
  "openaiApiKey" | "groqApiKey" | "anthropicApiKey"
>;

function merge(group: SettingsGroupRow, profile: UserProfileRow | null): EffectiveSettings {
  const allowSummaryOverride = group.allowSummaryPromptOverride;
  // Decrypt the three API key columns. The crypto layer passes plaintext
  // and empty values through unchanged, so a pre-migration DB (still
  // plaintext) keeps working until `scripts/encrypt-secrets.ts` rewrites it.
  return {
    groupId: group.id,
    groupName: group.name,
    sttProvider: group.sttProvider as SttProvider,
    summaryProvider: group.summaryProvider as SummaryProvider,
    openaiApiKey: decryptSecret(group.openaiApiKey),
    groqApiKey: decryptSecret(group.groqApiKey),
    anthropicApiKey: decryptSecret(group.anthropicApiKey),
    autoSummarize: group.autoSummarize,
    audioFormat: group.audioFormat as AudioFormat,
    sttPrompt: group.sttPrompt,
    language: profile?.languageOverride ?? group.language,
    summaryPrompt:
      allowSummaryOverride && profile?.summaryPromptOverride
        ? profile.summaryPromptOverride
        : group.summaryPrompt,
    allowSummaryPromptOverride: allowSummaryOverride,
  };
}

export async function getEffectiveSettings(userId: string): Promise<EffectiveSettings> {
  const profile = await getUserProfile(userId);
  const groupId = profile?.groupId ?? null;
  const group = groupId ? await getGroupById(groupId) : null;
  const resolvedGroup = group ?? (await getDefaultGroup());
  if (!resolvedGroup) {
    throw new Error(
      "No settings group found. The default group should have been seeded at boot — check `scripts/seed-admin.ts`.",
    );
  }
  // Lazy migration: if the profile is missing or its group has been deleted,
  // attach the user to the default group so the next read is a single hop.
  if (!profile || (!group && resolvedGroup)) {
    await setUserGroup(userId, resolvedGroup.id);
  }
  return merge(resolvedGroup, profile);
}

export async function getPublicEffectiveSettings(userId: string): Promise<PublicEffectiveSettings> {
  const full = await getEffectiveSettings(userId);
  // Object rest destructuring drops the three key fields without giving them
  // names — guarantees the keys never appear on the returned object.
  const { openaiApiKey: _o, groqApiKey: _g, anthropicApiKey: _a, ...publicFields } = full;
  void _o;
  void _g;
  void _a;
  return publicFields;
}

// Ensures the user has a `user_profile` row pointing at the default group.
// Called from `databaseHooks.user.create.after` so every user (admin-approved
// access requests, the seeded admin, future flows) is enrolled immediately.
export async function ensureUserProfile(userId: string): Promise<void> {
  const existing = await getUserProfile(userId);
  if (existing) return;
  const def = await getDefaultGroup();
  await setUserGroup(userId, def?.id ?? null);
}
