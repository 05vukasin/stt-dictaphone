"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiKey, FiLogOut, FiShield, FiUser } from "react-icons/fi";
import { useSession, signOut } from "@/lib/auth/client";
import { IconButton } from "@/components/ui/icon-button";
import { softResetCachesFor } from "@/lib/storage/wipe";
import { useUserId } from "@/lib/storage/user-scope";
import { ChangePasswordDialog } from "./change-password-dialog";

export function AuthButton() {
  const userId = useUserId();
  const { data, isPending } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (isPending) return null;
  if (!data?.user) return null;

  const role = data.user.role ?? "user";

  async function doSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      softResetCachesFor(userId);
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="relative">
      <IconButton label="Account" size="sm" onClick={() => setOpen((v) => !v)}>
        <FiUser aria-hidden />
      </IconButton>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 shadow-[0_4px_18px_rgba(0,0,0,0.08)]"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="px-3 pb-1 pt-2 text-[11px] text-[var(--muted)]">{data.user.email}</div>
          {role === "admin" ? (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] hover:bg-[var(--surface)]"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <FiShield aria-hidden /> Admin panel
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPasswordOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-[var(--fg)] hover:bg-[var(--surface)]"
          >
            <FiKey aria-hidden /> Change password
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={doSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12px] text-[var(--fg)] hover:bg-[var(--surface)] disabled:opacity-60"
          >
            <FiLogOut aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}

      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
