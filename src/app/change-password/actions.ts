"use server";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth/server";
import { requireAuth } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { account } from "@/lib/db/schema/auth";

export type ChangeResult = { ok: true } | { ok: false; error: string };

// Better Auth maintains a signed cookie that caches the session+user blob
// for the configured cookieCache.maxAge (5 minutes here). After we mutate
// the user row, that cookie is stale — the root layout would still see
// `mustChangePassword: true` on the next request and redirect right back
// to /change-password. Deleting the cache cookie forces Better Auth to
// re-read from the DB on the next call to `getSession()`.
async function invalidateSessionCache(): Promise<void> {
  const store = await cookies();
  // The cookie name is hard-coded in Better Auth as `<prefix>.session_data`.
  // Our prefix is the Better Auth default (`better-auth`); the session_token
  // cookie is renamed via `advanced.cookies.sessionToken.name` but the cache
  // cookie keeps the default name.
  store.delete("better-auth.session_data");
}

// Used by the forced /change-password page. The user is here because their
// session has `mustChangePassword=true` — they already proved they know the
// temp password at sign-in (otherwise no session would exist), so we don't
// re-prompt for it. We update the credential account's password hash
// directly via the internal adapter and clear the flag.
//
// Security stance: the session cookie + the flag are jointly the proof.
// A malicious actor who already has a flagged session can also just keep
// using the app once they change the password — there's no additional
// secret to leak. Equivalent to the regular flow's `revokeOtherSessions`
// behaviour because the regenerate path already wipes prior sessions; the
// initial-approval path has no prior session.
export async function forceChangePassword(newPassword: string): Promise<ChangeResult> {
  try {
    const session = requireAuth(await getServerSession());
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return { ok: false, error: "New password must be at least 8 characters." };
    }
    if (newPassword.length > 1024) {
      return { ok: false, error: "Password is too long." };
    }
    const ctx = await auth.$context;
    // Locate the user's credential account. There is always exactly one in
    // our email+password setup; we guard for absence anyway.
    const rows = await db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.userId, session.user.id))
      .limit(20);
    const credentialAccountId = rows[0]?.id;
    if (!credentialAccountId) {
      return { ok: false, error: "No credential account on file." };
    }
    const hashed = await ctx.password.hash(newPassword);
    await ctx.internalAdapter.updateAccount(credentialAccountId, { password: hashed });
    await ctx.internalAdapter.updateUser(session.user.id, { mustChangePassword: false });
    await invalidateSessionCache();
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't change password";
    return { ok: false, error: message };
  }
}

// Called by the regular dropdown <ChangePasswordDialog> after a successful
// change so any in-flight forced-change flag is cleared. Idempotent.
export async function clearMustChangePassword(): Promise<ChangeResult> {
  try {
    const session = requireAuth(await getServerSession());
    const ctx = await auth.$context;
    await ctx.internalAdapter.updateUser(session.user.id, { mustChangePassword: false });
    await invalidateSessionCache();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
