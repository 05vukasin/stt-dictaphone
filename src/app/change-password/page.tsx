import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { ForcedChangePasswordForm } from "./forced-form";

export const metadata = {
  title: "Set a new password · Dictaphone",
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect("/login?next=/change-password");
  }
  // If they don't actually need to change, send them home — this route is
  // only the forced flow. Normal password changes go through the account
  // dropdown.
  const mustChange = Boolean((session.user as { mustChangePassword?: boolean }).mustChangePassword);
  if (!mustChange) {
    redirect("/");
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 flex items-center gap-2 text-[12px] font-medium tracking-tight text-[var(--muted)]">
          <span className="size-2 rounded-full bg-[var(--fg)]" aria-hidden />
          Set a new password
        </header>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-5">
          <p className="mb-3 text-[12px] text-[var(--muted)]">
            Choose a permanent password to continue. You can&apos;t use the rest of the app until
            this is done.
          </p>
          <ForcedChangePasswordForm email={session.user.email ?? ""} />
        </div>
      </div>
    </main>
  );
}
