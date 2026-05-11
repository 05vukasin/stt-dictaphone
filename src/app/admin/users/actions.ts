"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { account } from "@/lib/db/schema/auth";
import { generateTempPassword } from "@/lib/access-requests/temp-password";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function adminGuard(): Promise<
  { ok: true; adminId: string; hdrs: Headers } | { ok: false; error: string }
> {
  try {
    const session = requireAdmin(await getServerSession());
    return { ok: true, adminId: session.user.id, hdrs: await headers() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Forbidden" };
  }
}

export async function setRole(userId: string, role: "admin" | "user"): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  if (userId === guard.adminId) {
    return { ok: false, error: "You cannot change your own role." };
  }
  try {
    await auth.api.setRole({ body: { userId, role }, headers: guard.hdrs });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function banUser(userId: string, banReason?: string): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  if (userId === guard.adminId) {
    return { ok: false, error: "You cannot ban yourself." };
  }
  try {
    await auth.api.banUser({
      body: { userId, banReason: banReason ?? "Banned by admin" },
      headers: guard.hdrs,
    });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function unbanUser(userId: string): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  try {
    await auth.api.unbanUser({ body: { userId }, headers: guard.hdrs });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function removeUser(userId: string): Promise<ActionResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  if (userId === guard.adminId) {
    return { ok: false, error: "You cannot delete yourself." };
  }
  try {
    await auth.api.removeUser({ body: { userId }, headers: guard.hdrs });
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export type RegenerateResult = { ok: true; tempPassword: string } | { ok: false; error: string };

// Rotates the user's credential password and forces them through the change-
// password flow on next sign-in. The new password is returned **once** — the
// admin shares it out-of-band. Existing sessions are revoked so the old
// cookie can't be used to bypass the gate.
export async function regenerateTempPassword(userId: string): Promise<RegenerateResult> {
  const guard = await adminGuard();
  if (!guard.ok) return guard;
  if (userId === guard.adminId) {
    return { ok: false, error: "You cannot reset your own password here. Use the account menu." };
  }
  try {
    const ctx = await auth.$context;
    // Only target the credential account — a future OAuth-linked account
    // for the same user must not have its (non-credential) row stomped.
    const credentials = await db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);
    const credentialRow = credentials[0];
    if (!credentialRow) {
      return { ok: false, error: "User has no credential account." };
    }
    const tempPassword = generateTempPassword();
    const hashed = await ctx.password.hash(tempPassword);
    await db
      .update(account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(account.id, credentialRow.id));
    await ctx.internalAdapter.updateUser(userId, { mustChangePassword: true });
    // Revoke any active sessions so the user must re-authenticate with the
    // new temp password (and immediately hit the forced-change flow).
    try {
      await auth.api.revokeUserSessions({ body: { userId }, headers: guard.hdrs });
    } catch {
      // Older Better Auth versions or call-path issues — fall back to a
      // direct delete via the internal adapter.
      await ctx.internalAdapter.deleteSessions(userId);
    }
    revalidatePath("/admin/users");
    return { ok: true, tempPassword };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
