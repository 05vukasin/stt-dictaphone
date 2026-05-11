import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { Providers } from "./providers";
import { getServerSession } from "@/lib/auth/session";
import { getPublicEffectiveSettings } from "@/lib/settings/effective";
import type { ClientEffectiveSettings } from "@/lib/settings/client-context";
import { PATHNAME_HEADER } from "@/proxy";

export const metadata: Metadata = {
  title: "STT Dictaphone",
  description:
    "A minimal, professional speech-to-text dictaphone — records voice, transcribes with Whisper, summarizes with AI, all stored on-device.",
  applicationName: "STT Dictaphone",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Dictaphone",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3ef" },
    { media: "(prefers-color-scheme: dark)", color: "#161616" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const hdrs = await headers();
  const pathname = hdrs.get(PATHNAME_HEADER) ?? "";
  let userId: string | null = null;
  let effectiveSettings: ClientEffectiveSettings | null = null;
  let mustChangePassword = false;
  try {
    const session = await getServerSession();
    userId = session?.user?.id ?? null;
    if (session?.user) {
      mustChangePassword = Boolean(
        (session.user as { mustChangePassword?: boolean }).mustChangePassword,
      );
    }
    if (userId) {
      effectiveSettings = await getPublicEffectiveSettings(userId);
    }
  } catch {
    // DB unreachable (e.g. during local dev before migrations) — fall back to
    // anonymous so the app still renders.
    userId = null;
    effectiveSettings = null;
  }
  // Force the change-password flow before any other authenticated render.
  // /login is open to everyone (the user could sign in only to be sent here
  // again). /change-password renders the form itself, so let it through.
  if (
    userId &&
    mustChangePassword &&
    pathname &&
    pathname !== "/change-password" &&
    pathname !== "/login" &&
    !pathname.startsWith("/api/auth")
  ) {
    redirect("/change-password");
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers userId={userId} effectiveSettings={effectiveSettings}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
