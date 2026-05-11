"use client";

import { useTransition } from "react";
import { FiUserX } from "react-icons/fi";
import { moveUserToGroup } from "../actions";
import { toast } from "@/lib/use-toast";

interface Member {
  id: string;
  email: string;
  role: string;
}

interface Props {
  members: Member[];
}

export function MembersSection({ members }: Props) {
  const [pending, start] = useTransition();

  function remove(userId: string, email: string) {
    if (!confirm(`Remove ${email} from this group? They will fall back to the default group.`)) {
      return;
    }
    start(async () => {
      const r = await moveUserToGroup(userId, null);
      if (r.ok) toast.success(`Removed ${email}`);
      else toast.error("Failed", r.error);
    });
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-4">
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        Members ({members.length})
      </h3>
      {members.length === 0 ? (
        <p className="text-[12px] text-[var(--muted)]">
          No members yet. Move users into this group from <code>/admin/users</code>.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[12px]"
            >
              <span className="truncate">
                {m.email} <span className="text-[11px] text-[var(--muted)]">· {m.role}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(m.id, m.email)}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:opacity-50"
              >
                <FiUserX aria-hidden /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
