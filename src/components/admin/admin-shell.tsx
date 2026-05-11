import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";
import { IconButton } from "@/components/ui/icon-button";

export interface AdminShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function AdminShell({ title, description, children }: AdminShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 pb-16 pt-5 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Link href="/" className="contents">
          <IconButton label="Back to recorder" size="sm">
            <FiArrowLeft aria-hidden />
          </IconButton>
        </Link>
        <div className="flex items-center gap-2 text-[12px] font-medium tracking-tight text-[var(--muted)]">
          <span className="size-2 rounded-full bg-[var(--fg)]" aria-hidden />
          Admin
        </div>
      </header>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-[12px] text-[var(--muted)]">{description}</p> : null}
      </div>

      <nav className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-1">
        <NavLink href="/admin">Overview</NavLink>
        <NavLink href="/admin/users">Users</NavLink>
        <NavLink href="/admin/groups">Groups</NavLink>
        <NavLink href="/admin/requests">Requests</NavLink>
      </nav>

      {children}
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex-1 rounded-lg px-3 py-1.5 text-center text-[12px] font-medium text-[var(--muted)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--fg)]"
    >
      {children}
    </Link>
  );
}
