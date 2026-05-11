"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { getEffectiveSettings } from "@/lib/settings/effective";
import { setUserOverrides } from "@/lib/settings/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function authGuard(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  try {
    const session = requireAuth(await getServerSession());
    return { ok: true, userId: session.user.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unauthorized" };
  }
}

// `null` means "clear the override and fall back to the group's value".
const languageSchema = z.string().min(1).max(16).nullable();

export async function setLanguageOverride(language: string | null): Promise<ActionResult> {
  const guard = await authGuard();
  if (!guard.ok) return guard;
  const parsed = languageSchema.safeParse(language);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid language" };
  }
  try {
    await setUserOverrides(guard.userId, { languageOverride: parsed.data });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

const summarySchema = z.string().max(8000).nullable();

export async function setSummaryPromptOverride(prompt: string | null): Promise<ActionResult> {
  const guard = await authGuard();
  if (!guard.ok) return guard;
  const parsed = summarySchema.safeParse(prompt);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid prompt" };
  }
  // Even with a valid value, the user's group can disallow overrides — the
  // resolver enforces this on read, but we also refuse the *write* so the
  // user gets clear feedback.
  const effective = await getEffectiveSettings(guard.userId);
  if (!effective.allowSummaryPromptOverride) {
    return { ok: false, error: "Your admin has locked the summary prompt for your group." };
  }
  try {
    await setUserOverrides(guard.userId, { summaryPromptOverride: parsed.data });
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
