"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { AudioFormatSchema, SttProviderSchema, SummaryProviderSchema } from "@/types/settings";
import {
  createGroup as dbCreateGroup,
  deleteGroup as dbDeleteGroup,
  setDefaultGroup as dbSetDefaultGroup,
  setGroupConfig as dbSetGroupConfig,
  setUserGroup as dbSetUserGroup,
  type SettingsGroupRow,
} from "@/lib/settings/queries";

export type ActionOk<T = void> = { ok: true } & (T extends void ? object : T);
export type ActionErr = { ok: false; error: string };
export type ActionResult<T = void> = ActionOk<T> | ActionErr;

async function adminGuard(): Promise<{ ok: true; adminId: string } | ActionErr> {
  try {
    const session = requireAdmin(await getServerSession());
    return { ok: true, adminId: session.user.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Forbidden" };
  }
}

const createGroupSchema = z.object({
  name: z.string().trim().min(2).max(64),
  description: z.string().trim().max(500).optional().default(""),
});

export async function createGroup(
  input: unknown,
): Promise<ActionResult<{ group: SettingsGroupRow }>> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const group = await dbCreateGroup({ ...parsed.data, createdBy: guard.adminId });
    revalidatePath("/admin/groups");
    return { ok: true, group };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return { ok: false, error: /unique/i.test(message) ? "Group name already exists." : message };
  }
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  try {
    const r = await dbDeleteGroup(groupId);
    if (!r.deleted) return { ok: false, error: "Group not found." };
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

const groupConfigPatchSchema = z
  .object({
    description: z.string().trim().max(500).optional(),
    sttProvider: SttProviderSchema.optional(),
    summaryProvider: SummaryProviderSchema.optional(),
    openaiApiKey: z.string().max(512).optional(),
    groqApiKey: z.string().max(512).optional(),
    anthropicApiKey: z.string().max(512).optional(),
    language: z.string().min(1).max(16).optional(),
    autoSummarize: z.boolean().optional(),
    audioFormat: AudioFormatSchema.optional(),
    sttPrompt: z.string().max(4000).optional(),
    summaryPrompt: z.string().max(8000).optional(),
    allowSummaryPromptOverride: z.boolean().optional(),
  })
  .strict();

export async function setGroupConfig(groupId: string, patch: unknown): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  const parsed = groupConfigPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const r = await dbSetGroupConfig(groupId, parsed.data);
    if (!r) return { ok: false, error: "Group not found." };
    revalidatePath("/admin/groups");
    revalidatePath(`/admin/groups/${groupId}`);
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function setDefaultGroup(groupId: string): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  try {
    await dbSetDefaultGroup(groupId);
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function moveUserToGroup(
  userId: string,
  groupId: string | null,
): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  try {
    await dbSetUserGroup(userId, groupId);
    revalidatePath("/admin/users");
    revalidatePath("/admin/groups");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
