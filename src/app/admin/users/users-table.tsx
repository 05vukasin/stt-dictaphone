"use client";

import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FiMoreHorizontal } from "react-icons/fi";
import { banUser, regenerateTempPassword, removeUser, setRole, unbanUser } from "./actions";
import { moveUserToGroup } from "@/app/admin/groups/actions";
import { toast } from "@/lib/use-toast";
import { formatRelativeTime } from "@/lib/format";
import { CredentialModal } from "@/components/admin/credential-modal";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  banned: boolean;
  createdAt: number;
  groupId: string | null;
}

export interface GroupOption {
  id: string;
  name: string;
  isDefault: boolean;
}

interface UsersTableProps {
  rows: AdminUserRow[];
  currentUserId: string;
  groups: GroupOption[];
}

export function UsersTable({ rows, currentUserId, groups }: UsersTableProps) {
  const [credential, setCredential] = useState<{ email: string; tempPassword: string } | null>(
    null,
  );
  if (rows.length === 0) {
    return <p className="text-[12px] text-[var(--muted)]">No users yet.</p>;
  }
  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-[12px]">
          <thead className="bg-[var(--bg-elev)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Group</th>
              <th className="px-3 py-2 font-medium">Created</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row
                key={row.id}
                row={row}
                isSelf={row.id === currentUserId}
                groups={groups}
                onCredential={setCredential}
              />
            ))}
          </tbody>
        </table>
      </div>
      {credential ? (
        <CredentialModal credential={credential} onClose={() => setCredential(null)} />
      ) : null}
    </>
  );
}

function Row({
  row,
  isSelf,
  groups,
  onCredential,
}: {
  row: AdminUserRow;
  isSelf: boolean;
  groups: GroupOption[];
  onCredential(c: { email: string; tempPassword: string }): void;
}) {
  const [pending, start] = useTransition();
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Anchor the menu's top-right to the button's bottom-right. Using fixed
    // positioning + viewport coordinates so it can escape any clipping
    // ancestor (the table wrapper has overflow-hidden for rounded corners).
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }
  function closeMenu() {
    setMenuStyle(null);
  }

  function run(action: () => Promise<{ ok: boolean; error?: string }>, label: string) {
    closeMenu();
    start(async () => {
      const r = await action();
      if (r.ok) toast.success(label);
      else toast.error(label + " failed", r.error ?? "Unknown error");
    });
  }

  function onGroupChange(next: string) {
    const value = next === "" ? null : next;
    if (value === (row.groupId ?? "")) return;
    run(() => moveUserToGroup(row.id, value), "Group updated");
  }

  function doRegenerate() {
    closeMenu();
    if (
      !confirm(
        `Generate a new temp password for ${row.email}? Their existing sessions will be revoked.`,
      )
    ) {
      return;
    }
    start(async () => {
      const r = await regenerateTempPassword(row.id);
      if (r.ok) {
        onCredential({ email: row.email, tempPassword: r.tempPassword });
        toast.success("Temp password generated");
      } else {
        toast.error("Couldn't regenerate", r.error);
      }
    });
  }

  return (
    <tr className="border-t border-[var(--border)] last:border-b-0">
      <td className="px-3 py-2">
        <div className="flex flex-col">
          <span className="font-medium">{row.email}</span>
          {row.banned ? (
            <span className="text-[10px] font-semibold uppercase text-[var(--record)]">Banned</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2 capitalize">{row.role}</td>
      <td className="px-3 py-2">
        <select
          value={row.groupId ?? ""}
          onChange={(e) => onGroupChange(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[11px] outline-none focus:border-[var(--border-strong)] disabled:opacity-50"
        >
          <option value="">— default —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.isDefault ? " ★" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{formatRelativeTime(row.createdAt)}</td>
      <td className="px-3 py-2 text-right">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (menuStyle ? closeMenu() : openMenu())}
          disabled={pending}
          aria-label="Row actions"
          aria-haspopup="menu"
          aria-expanded={menuStyle != null}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:opacity-50"
        >
          <FiMoreHorizontal aria-hidden />
        </button>
        {menuStyle ? (
          <Menu style={menuStyle} onClose={closeMenu}>
            <MenuButton
              disabled={isSelf}
              onClick={() =>
                run(() => setRole(row.id, row.role === "admin" ? "user" : "admin"), "Role updated")
              }
            >
              {row.role === "admin" ? "Demote to user" : "Promote to admin"}
            </MenuButton>
            <MenuButton onClick={doRegenerate}>Regenerate temp password</MenuButton>
            {row.banned ? (
              <MenuButton onClick={() => run(() => unbanUser(row.id), "User unbanned")}>
                Unban user
              </MenuButton>
            ) : (
              <MenuButton
                disabled={isSelf}
                onClick={() => run(() => banUser(row.id), "User banned")}
              >
                Ban user
              </MenuButton>
            )}
            <MenuButton
              disabled={isSelf}
              variant="danger"
              onClick={() => {
                if (confirm(`Delete ${row.email}? This cannot be undone.`)) {
                  run(() => removeUser(row.id), "User deleted");
                } else {
                  closeMenu();
                }
              }}
            >
              Delete user
            </MenuButton>
          </Menu>
        ) : null}
      </td>
    </tr>
  );
}

// Menu is portaled into <body> so it overflows the table's clipping border-radius.
function Menu({
  style,
  onClose,
  children,
}: {
  style: CSSProperties;
  onClose(): void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer the click handler until the current event loop tick so the click
    // that opened the menu doesn't immediately close it.
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onDocClick);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={style}
      className="z-50 min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuButton({
  onClick,
  disabled,
  variant,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={
        "block w-full rounded-lg px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40 " +
        (variant === "danger" ? "text-[var(--record)]" : "text-[var(--fg)]")
      }
    >
      {children}
    </button>
  );
}
