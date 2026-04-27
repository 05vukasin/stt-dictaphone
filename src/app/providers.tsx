"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { ToastStack } from "@/components/ui/toast";
import { InstallPrompt } from "@/components/pwa/install-prompt";

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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <ToastStack />
      <InstallPrompt />
      <ServiceWorkerBoot />
    </ThemeProvider>
  );
}
