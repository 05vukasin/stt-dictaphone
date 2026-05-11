import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth/server";
import { db } from "../src/lib/db/client";
import { settingsGroup, userProfile } from "../src/lib/db/schema/groups";
import { newId } from "../src/lib/id";
import { DEFAULT_SUMMARY_PROMPT } from "../src/types/settings";

export interface SeedResult {
  ok: boolean;
  reason: string;
}

export async function seedAdmin(): Promise<SeedResult> {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    await ensureDefaultGroup();
    return { ok: true, reason: "ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed." };
  }

  const ctx = await auth.$context;

  // Default group BEFORE createUser so the after-hook can attach the new
  // admin to it on the same insert path. Without this the admin ends up with
  // group_id=null until the resolver self-heals on first read.
  const groupId = await ensureDefaultGroup();

  const adminCount = await ctx.internalAdapter.countTotalUsers([
    { field: "role", operator: "eq", value: "admin" },
  ]);

  if (adminCount > 0) {
    await ensureAdminProfile(groupId);
    return { ok: true, reason: "admin user already exists — no-op." };
  }

  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: false });
  if (existing?.user) {
    const role = (existing.user as { role?: string }).role ?? "user";
    return {
      ok: true,
      reason: `user ${email} exists with role "${role}" — refusing to overwrite. Promote them via /admin/users instead.`,
    };
  }

  const hashed = await ctx.password.hash(password);
  const user = await ctx.internalAdapter.createUser({
    email,
    name: "Admin",
    role: "admin",
    banned: false,
  });
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashed,
  });
  // Belt-and-braces — the after-hook already inserted a profile row pointing
  // at the default group; this upsert is idempotent.
  await upsertUserProfile(user.id, groupId);
  return { ok: true, reason: `created admin user ${email}` };
}

// Returns the id of the existing or newly-created default group. Idempotent.
export async function ensureDefaultGroup(): Promise<string> {
  const existing = await db
    .select({ id: settingsGroup.id })
    .from(settingsGroup)
    .where(eq(settingsGroup.isDefault, true))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const id = newId();
  await db.insert(settingsGroup).values({
    id,
    name: "default",
    description: "Default settings group. New users join this group automatically.",
    isDefault: true,
    summaryPrompt: DEFAULT_SUMMARY_PROMPT,
  });
  return id;
}

async function ensureAdminProfile(groupId: string): Promise<void> {
  const ctx = await auth.$context;
  const admins = await ctx.internalAdapter.listUsers(1, 0, undefined, [
    { field: "role", operator: "eq", value: "admin" },
  ]);
  const admin = admins?.[0];
  if (!admin) return;
  const profile = await db
    .select({ userId: userProfile.userId })
    .from(userProfile)
    .where(eq(userProfile.userId, admin.id))
    .limit(1);
  if (profile[0]) return;
  await upsertUserProfile(admin.id, groupId);
}

async function upsertUserProfile(userId: string, groupId: string): Promise<void> {
  await db
    .insert(userProfile)
    .values({ userId, groupId })
    .onConflictDoNothing({ target: userProfile.userId });
}

const isMain = process.argv[1]?.endsWith("seed-admin.ts");
if (isMain) {
  seedAdmin()
    .then((r) => {
      console.log(`[seed-admin] ${r.reason}`);
      process.exit(r.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error("[seed-admin] fatal", err);
      process.exit(1);
    });
}
