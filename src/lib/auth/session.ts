import "server-only";
import { headers } from "next/headers";
import { auth } from "./server";

export type ServerSession = Awaited<ReturnType<typeof auth.api.getSession>>;

// Fetches the active session for the current request. Returns null when the
// user is not signed in. Centralised so callers don't repeat `await headers()`.
export async function getServerSession(): Promise<ServerSession> {
  return auth.api.getSession({ headers: await headers() });
}
