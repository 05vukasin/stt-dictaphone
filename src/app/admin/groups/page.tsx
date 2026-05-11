import Link from "next/link";
import { FiPlus, FiStar } from "react-icons/fi";
import { AdminShell } from "@/components/admin/admin-shell";
import { listGroups, countGroupMembers } from "@/lib/settings/queries";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  let groups: Awaited<ReturnType<typeof listGroups>> = [];
  let listError: string | null = null;
  try {
    groups = await listGroups();
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load groups";
  }
  const memberCounts = await Promise.all(
    groups.map(async (g) => ({ id: g.id, count: await countGroupMembers(g.id).catch(() => 0) })),
  );
  const countById = new Map(memberCounts.map((m) => [m.id, m.count]));

  return (
    <AdminShell
      title="Groups"
      description="Each group has its own provider, prompts, and API keys. New users join the default group."
    >
      {listError ? (
        <p className="rounded-xl border border-[var(--record)]/30 bg-[var(--record)]/5 px-3 py-2 text-[12px] text-[var(--record)]">
          {listError}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Link
          href="/admin/groups/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)]"
        >
          <FiPlus aria-hidden /> New group
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {groups.length === 0 ? (
          <li className="text-[12px] text-[var(--muted)]">No groups yet.</li>
        ) : null}
        {groups.map((g) => (
          <li key={g.id}>
            <Link
              href={`/admin/groups/${g.id}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3 transition-colors hover:bg-[var(--surface)]"
            >
              <div className="flex items-center gap-2">
                {g.isDefault ? (
                  <FiStar aria-label="Default group" className="size-3.5 text-[var(--muted)]" />
                ) : (
                  <span className="size-3.5" aria-hidden />
                )}
                <div>
                  <div className="text-[13px] font-semibold">{g.name}</div>
                  {g.description ? (
                    <div className="text-[11px] text-[var(--muted)]">{g.description}</div>
                  ) : null}
                </div>
              </div>
              <span className="text-[11px] text-[var(--muted)]">
                {countById.get(g.id) ?? 0} member{(countById.get(g.id) ?? 0) === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
