import Link from "next/link";
import { FiUsers, FiInbox } from "react-icons/fi";
import { AdminShell } from "@/components/admin/admin-shell";
import { listPending } from "@/lib/access-requests/queries";

export default async function AdminLandingPage() {
  let pendingCount = 0;
  try {
    pendingCount = (await listPending()).length;
  } catch {
    pendingCount = 0;
  }
  return (
    <AdminShell title="Admin" description="Manage users and approve access requests.">
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminCard
          href="/admin/users"
          icon={<FiUsers aria-hidden />}
          label="Users"
          hint="Roles, ban, remove"
        />
        <AdminCard
          href="/admin/requests"
          icon={<FiInbox aria-hidden />}
          label="Access requests"
          hint={pendingCount === 0 ? "No pending requests" : `${pendingCount} pending`}
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
      </div>
    </AdminShell>
  );
}

function AdminCard({
  href,
  icon,
  label,
  hint,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-3 transition-colors hover:bg-[var(--surface)]"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--muted)]">
          {icon}
        </span>
        <div>
          <div className="text-[13px] font-semibold">{label}</div>
          <div className="text-[11px] text-[var(--muted)]">{hint}</div>
        </div>
      </div>
      {badge !== undefined ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--bg)]">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
