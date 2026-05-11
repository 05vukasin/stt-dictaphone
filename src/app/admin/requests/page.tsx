import { AdminShell } from "@/components/admin/admin-shell";
import { listAll } from "@/lib/access-requests/queries";
import { RequestsTable, type RequestRow } from "./requests-table";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  let rows: RequestRow[] = [];
  let listError: string | null = null;
  try {
    const raw = await listAll();
    rows = raw.map((r) => ({
      id: r.id,
      email: r.email,
      reason: r.reason,
      status: r.status as "pending" | "approved" | "rejected",
      requestedAt: r.requestedAt.getTime(),
      decidedAt: r.decidedAt ? r.decidedAt.getTime() : null,
      note: r.note,
    }));
  } catch (err) {
    listError = err instanceof Error ? err.message : "Failed to load requests";
  }

  return (
    <AdminShell title="Access requests" description="Approve or reject pending requests.">
      {listError ? (
        <p className="rounded-xl border border-[var(--record)]/30 bg-[var(--record)]/5 px-3 py-2 text-[12px] text-[var(--record)]">
          {listError}
        </p>
      ) : (
        <RequestsTable rows={rows} />
      )}
    </AdminShell>
  );
}
