import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settingsGroup, userProfile } from "@/lib/db/schema/groups";
import { user } from "@/lib/db/schema/auth";
import { newId } from "@/lib/id";
import { encryptSecret } from "@/lib/crypto/secrets";

export type SettingsGroupRow = typeof settingsGroup.$inferSelect;
export type UserProfileRow = typeof userProfile.$inferSelect;

// Admin-mutable subset of a group's config. The "name" and "isDefault" fields
// have their own dedicated actions because flipping is_default needs a
// transaction.
export type GroupConfigPatch = Partial<
  Pick<
    SettingsGroupRow,
    | "description"
    | "sttProvider"
    | "summaryProvider"
    | "openaiApiKey"
    | "groqApiKey"
    | "anthropicApiKey"
    | "language"
    | "autoSummarize"
    | "audioFormat"
    | "sttPrompt"
    | "summaryPrompt"
    | "allowSummaryPromptOverride"
  >
>;

export async function listGroups(): Promise<SettingsGroupRow[]> {
  return db.select().from(settingsGroup).orderBy(asc(settingsGroup.name));
}

export async function getGroupById(id: string): Promise<SettingsGroupRow | null> {
  const rows = await db.select().from(settingsGroup).where(eq(settingsGroup.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getDefaultGroup(): Promise<SettingsGroupRow | null> {
  const rows = await db
    .select()
    .from(settingsGroup)
    .where(eq(settingsGroup.isDefault, true))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserProfile(userId: string): Promise<UserProfileRow | null> {
  const rows = await db.select().from(userProfile).where(eq(userProfile.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function createGroup(input: {
  name: string;
  description?: string;
  createdBy?: string;
}): Promise<SettingsGroupRow> {
  const id = newId();
  const rows = await db
    .insert(settingsGroup)
    .values({
      id,
      name: input.name,
      description: input.description ?? "",
      createdBy: input.createdBy ?? null,
    })
    .returning();
  if (!rows[0]) throw new Error("createGroup: insert did not return a row");
  return rows[0];
}

export async function deleteGroup(id: string): Promise<{ deleted: boolean }> {
  const group = await getGroupById(id);
  if (!group) return { deleted: false };
  if (group.isDefault) {
    throw new Error("Cannot delete the default group");
  }
  await db.delete(settingsGroup).where(eq(settingsGroup.id, id));
  return { deleted: true };
}

export async function setGroupConfig(
  id: string,
  patch: GroupConfigPatch,
): Promise<SettingsGroupRow | null> {
  // Encrypt the three API key fields before they hit the DB. The crypto
  // module is a no-op on empty strings (the "no key configured" default)
  // and on values that are already encrypted, so this is safe whether the
  // admin is clearing, rotating, or leaving a key alone.
  const protectedPatch: GroupConfigPatch = { ...patch };
  if (protectedPatch.openaiApiKey !== undefined) {
    protectedPatch.openaiApiKey = encryptSecret(protectedPatch.openaiApiKey);
  }
  if (protectedPatch.groqApiKey !== undefined) {
    protectedPatch.groqApiKey = encryptSecret(protectedPatch.groqApiKey);
  }
  if (protectedPatch.anthropicApiKey !== undefined) {
    protectedPatch.anthropicApiKey = encryptSecret(protectedPatch.anthropicApiKey);
  }
  const rows = await db
    .update(settingsGroup)
    .set({ ...protectedPatch, updatedAt: new Date() })
    .where(eq(settingsGroup.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function setDefaultGroup(id: string): Promise<void> {
  // Two-step within a transaction so we don't violate the partial unique
  // index by having two rows with is_default=true mid-flight.
  await db.transaction(async (tx) => {
    await tx
      .update(settingsGroup)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(settingsGroup.isDefault, true));
    await tx
      .update(settingsGroup)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(settingsGroup.id, id));
  });
}

export async function setUserGroup(userId: string, groupId: string | null): Promise<void> {
  await db
    .insert(userProfile)
    .values({ userId, groupId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfile.userId,
      set: { groupId, updatedAt: new Date() },
    });
}

export async function setUserOverrides(
  userId: string,
  patch: { languageOverride?: string | null; summaryPromptOverride?: string | null },
): Promise<void> {
  // Ensure a profile row exists first — keeps the override write a single op.
  await db
    .insert(userProfile)
    .values({ userId })
    .onConflictDoNothing({ target: userProfile.userId });
  await db
    .update(userProfile)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(userProfile.userId, userId));
}

// Counts members of a group. Used by the admin Groups page to show member
// counts without round-tripping the full user list per group.
export async function countGroupMembers(groupId: string): Promise<number> {
  const rows = await db
    .select({ id: userProfile.userId })
    .from(userProfile)
    .where(eq(userProfile.groupId, groupId));
  return rows.length;
}

// Returns the user records that belong to a given group (used by the group
// members section in the admin UI).
export async function listGroupMembers(groupId: string) {
  return db
    .select({
      id: user.id,
      email: user.email,
      role: user.role,
    })
    .from(userProfile)
    .innerJoin(user, eq(user.id, userProfile.userId))
    .where(and(eq(userProfile.groupId, groupId)));
}
