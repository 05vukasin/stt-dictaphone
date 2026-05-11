import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/session";
import { LoginShell } from "./login-shell";

export const metadata = {
  title: "Sign in · Dictaphone",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; tab?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  let session;
  try {
    session = await getServerSession();
  } catch {
    session = null;
  }
  if (session?.user?.id) {
    redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/");
  }
  return <LoginShell initialTab={sp.tab === "request" ? "request" : "signin"} nextPath={sp.next} />;
}
