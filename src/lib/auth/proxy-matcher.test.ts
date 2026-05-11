import { describe, expect, it } from "vitest";
import { isPublic, SESSION_COOKIE } from "@/proxy";

describe("proxy isPublic()", () => {
  it("lets auth endpoints through", () => {
    expect(isPublic("/api/auth")).toBe(true);
    expect(isPublic("/api/auth/jwks")).toBe(true);
    expect(isPublic("/api/auth/session")).toBe(true);
  });

  it("lets the health probe through", () => {
    expect(isPublic("/api/health")).toBe(true);
  });

  it("lets static manifest + service-worker assets through", () => {
    expect(isPublic("/manifest.json")).toBe(true);
    expect(isPublic("/sw.js")).toBe(true);
    expect(isPublic("/sw.js.map")).toBe(true);
    expect(isPublic("/favicon.ico")).toBe(true);
    expect(isPublic("/icons/icon-192.png")).toBe(true);
  });

  it("lets /login through", () => {
    expect(isPublic("/login")).toBe(true);
    expect(isPublic("/login?next=/history")).toBe(false); // matcher uses pathname only
  });

  it("gates the recorder and admin", () => {
    expect(isPublic("/")).toBe(false);
    expect(isPublic("/history")).toBe(false);
    expect(isPublic("/recording/abc")).toBe(false);
    expect(isPublic("/admin")).toBe(false);
    expect(isPublic("/admin/users")).toBe(false);
  });

  it("gates the transcribe/summarize APIs", () => {
    expect(isPublic("/api/transcribe")).toBe(false);
    expect(isPublic("/api/summarize")).toBe(false);
  });

  // Lock the cookie name — Better Auth's default. If this drifts, proxy.ts
  // silently lets unauthenticated requests through.
  it("uses the documented session cookie name", () => {
    expect(SESSION_COOKIE).toBe("better-auth.session_token");
  });
});

describe("proxy() routing", async () => {
  // Avoid pulling in `next/server` at module-evaluation time of the test
  // file; just import the default export inside the test.
  const { NextRequest } = await import("next/server");
  const proxy = (await import("@/proxy")).default;

  function go(path: string, cookies?: Record<string, string>) {
    const req = new NextRequest(new URL(path, "http://x"));
    if (cookies) for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
    return proxy(req);
  }

  it("redirects unauthenticated HTML requests to /login", () => {
    const res = go("/history");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.headers.get("location")).toContain("next=%2Fhistory");
  });

  it("returns 401 JSON for unauthenticated /api/* requests", async () => {
    const res = go("/api/transcribe");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("passes authenticated requests through", () => {
    const res = go("/", { [SESSION_COOKIE]: "token" });
    expect(res.status).toBe(200); // NextResponse.next() — no redirect
  });

  it("passes public prefixes through without a cookie", () => {
    expect(go("/api/auth/jwks").status).toBe(200);
    expect(go("/login").status).toBe(200);
    expect(go("/api/health").status).toBe(200);
  });
});
