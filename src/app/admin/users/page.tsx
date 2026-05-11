import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/lib/auth/server";
import { getServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { userProfile } from "@/lib/db/schema/groups";
import { listGroups } from "@/lib/settings/queries";
import { UsersTable, type AdminUserRow } from "./users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession();
  const hdrs = await headers();
  let rows: AdminUserRow[] = [];
  let groups: Awaited<ReturnType<typeof listGroups>> = [];
  let listError: string | null = null;
  try {
    const [result, allGroups, profiles] = await Promise.all([
      auth.api.listUsers({
        query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" },
        headers: hdrs,
      }),
      listGroups(),
      // Pull every profile in one query and join client-side so we don't make
      // N round-trips for N users.
      db.select().from(userProfile).where(eq(userProfile.userId, userProfile.userId)),
    ]);
    groups = allGroups;
    const profileByUserId = new Map(profiles.map((p) => [p.userId, p.groupId]));
    rows = (result.users ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: (u.role as string | null) ?? "user",
      banned: Boolean((u as { banned?: boolean }).banned),
      createdAt: new Date(u.createdAt).getTime(),
      groupId: profileByUserId.get(u.id) ?? null,
    }));
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load users";
  }

  return (
    <AdminShell title="Users" description="Roles, group assignment, bans, deletions.">
      {listError ? (
        <p className="rounded-xl border border-[var(--record)]/30 bg-[var(--record)]/5 px-3 py-2 text-[12px] text-[var(--record)]">
          {listError}
        </p>
      ) : (
        <UsersTable
          rows={rows}
          currentUserId={session?.user?.id ?? ""}
          groups={groups.map((g) => ({ id: g.id, name: g.name, isDefault: g.isDefault }))}
        />
      )}
    </AdminShell>
  );
}
