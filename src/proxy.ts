import { NextResponse, type NextRequest } from "next/server";

export const SESSION_COOKIE = "better-auth.session_token";
export const PATHNAME_HEADER = "x-dictaphone-pathname";

const PUBLIC_PREFIXES = ["/api/auth", "/api/health", "/_next", "/icons", "/login"];
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/sw.js.map",
  "/robots.txt",
]);

export function isPublic(pathname: string): boolean {
  if (PUBLIC_FILES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Forwards the current pathname to the request headers so server components
// (root layout especially) can branch on it via `headers().get(...)`. Next.js
// doesn't expose the pathname to layouts natively in v16.
function withPathname(req: NextRequest, pathname: string) {
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);
  return NextResponse.next({ request: { headers } });
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return withPathname(req, pathname);

  // Optimistic cookie check only — the cookie is signed and validated by
  // Better Auth on every server render. Real role enforcement lives in
  // server layouts via requireAdmin(). A stale cookie cannot escalate
  // because requireAdmin() reads the live session row.
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
  if (!hasSession) {
    // For API requests, JSON 401 is friendlier than a redirect — `fetch`
    // doesn't auto-follow cross-origin redirects and the client wants a
    // structured error, not an HTML login page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return withPathname(req, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|workbox-|swe-worker-|sw\\.js|icons/|favicon\\.ico|manifest\\.json|robots\\.txt).*)",
  ],
};
