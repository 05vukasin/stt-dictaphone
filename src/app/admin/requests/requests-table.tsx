"use client";

import { useState, useTransition } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { approve, reject } from "./actions";
import { toast } from "@/lib/use-toast";
import { formatRelativeTime } from "@/lib/format";
import { CredentialModal } from "@/components/admin/credential-modal";

export interface RequestRow {
  id: string;
  email: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  decidedAt: number | null;
  note: string | null;
}

interface RequestsTableProps {
  rows: RequestRow[];
}

export function RequestsTable({ rows }: RequestsTableProps) {
  const [credential, setCredential] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <div className="flex flex-col gap-4">
      <Section title={`Pending (${pending.length})`}>
        {pending.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">No pending requests.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((r) => (
              <PendingRow key={r.id} row={r} onApproved={setCredential} />
            ))}
          </ul>
        )}
      </Section>

      {decided.length > 0 ? (
        <Section title={`Decided (${decided.length})`}>
          <ul className="flex flex-col gap-1.5">
            {decided.map((r) => (
              <DecidedRow key={r.id} row={r} />
            ))}
          </ul>
        </Section>
      ) : null}

      {credential ? (
        <CredentialModal credential={credential} onClose={() => setCredential(null)} />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PendingRow({
  row,
  onApproved,
}: {
  row: RequestRow;
  onApproved: (c: { email: string; tempPassword: string }) => void;
}) {
  const [working, start] = useTransition();

  function doApprove() {
    start(async () => {
      const r = await approve(row.id);
      if (r.ok) {
        onApproved({ email: r.email, tempPassword: r.tempPassword });
        toast.success("Request approved", `User created for ${r.email}`);
      } else {
        toast.error("Approve failed", r.error);
      }
    });
  }

  function doReject() {
    const note = prompt("Reason (shown nowhere — for your records):") ?? "";
    start(async () => {
      const r = await reject(row.id, note || null);
      if (r.ok) toast.success("Request rejected");
      else toast.error("Reject failed", r.error);
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{row.email}</div>
        <div className="mt-0.5 text-[11px] text-[var(--muted)]">
          {formatRelativeTime(row.requestedAt)}
          {row.reason ? ` · ${row.reason}` : ""}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={doApprove}
          disabled={working}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--bg)] transition-opacity disabled:opacity-50"
        >
          <FiCheck aria-hidden /> Approve
        </button>
        <button
          type="button"
          onClick={doReject}
          disabled={working}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
        >
          <FiX aria-hidden /> Reject
        </button>
      </div>
    </li>
  );
}

function DecidedRow({ row }: { row: RequestRow }) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]">
      <span className="truncate">{row.email}</span>
      <span
        className={
          "ml-2 text-[11px] capitalize " +
          (row.status === "approved" ? "text-[var(--fg)]" : "text-[var(--muted)]")
        }
      >
        {row.status}
        {row.decidedAt ? ` · ${formatRelativeTime(row.decidedAt)}` : ""}
      </span>
    </li>
  );
}
