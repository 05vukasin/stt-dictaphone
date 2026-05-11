"use client";

import { useState } from "react";
import { FiLock, FiUserPlus } from "react-icons/fi";
import { SignInForm } from "./sign-in-form";
import { RequestAccessForm } from "./request-access-form";

type Tab = "signin" | "request";

export interface LoginShellProps {
  initialTab?: Tab;
  nextPath?: string;
}

export function LoginShell({ initialTab = "signin", nextPath }: LoginShellProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10 sm:px-8">
      <div className="w-full max-w-sm">
        <header className="mb-6 flex items-center gap-2 text-[12px] font-medium tracking-tight text-[var(--muted)]">
          <span className="size-2 rounded-full bg-[var(--fg)]" aria-hidden />
          Dictaphone
        </header>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)] p-1 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
          <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1">
            <TabButton active={tab === "signin"} onClick={() => setTab("signin")} icon={<FiLock />}>
              Sign in
            </TabButton>
            <TabButton
              active={tab === "request"}
              onClick={() => setTab("request")}
              icon={<FiUserPlus />}
            >
              Request access
            </TabButton>
          </div>

          <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5">
            {tab === "signin" ? <SignInForm nextPath={nextPath} /> : <RequestAccessForm />}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--muted)]">
          Your recordings stay on this device. Accounts only gate access to the recorder.
        </p>
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors " +
        (active
          ? "bg-[var(--bg)] text-[var(--fg)] shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          : "text-[var(--muted)] hover:text-[var(--fg)]")
      }
    >
      <span aria-hidden className="text-[13px]">
        {icon}
      </span>
      {children}
    </button>
  );
}
