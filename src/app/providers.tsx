"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { ToastStack } from "@/components/ui/toast";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { UserScopeProvider } from "@/lib/storage/user-scope";
import {
  EffectiveSettingsProvider,
  type ClientEffectiveSettings,
} from "@/lib/settings/client-context";

function ServiceWorkerBoot() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Silent — failed SW registration shouldn't break the app.
    });
  }, []);
  return null;
}

export interface ProvidersProps {
  userId: string | null | undefined;
  effectiveSettings: ClientEffectiveSettings | null;
  children: React.ReactNode;
}

export function Providers({ userId, effectiveSettings, children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <UserScopeProvider userId={userId}>
        <EffectiveSettingsProvider value={effectiveSettings}>
          {children}
          <ToastStack />
          <InstallPrompt />
          <ServiceWorkerBoot />
        </EffectiveSettingsProvider>
      </UserScopeProvider>
    </ThemeProvider>
  );
}
