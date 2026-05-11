# Auth

Better Auth 1.6 with the `admin` and `jwt` plugins, Drizzle adapter, email +
password as the only sign-in method. DB-backed opaque session cookie is the
primary credential; the JWT plugin is enabled so signed JWTs and JWKS are
available for future external consumers.

## Files

| File                                 | Purpose                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `src/lib/auth/server.ts`             | `betterAuth(...)` config: adapter, plugins, session, hooks.                     |
| `src/lib/auth/client.ts`             | `createAuthClient` + `adminClient` for the React layer.                         |
| `src/lib/auth/session.ts`            | `getServerSession()` wraps `auth.api.getSession({ headers: await headers() })`. |
| `src/lib/auth/roles.ts`              | `isAdmin`, `requireAuth`, `requireAdmin` (throw typed errors).                  |
| `src/lib/auth/errors.ts`             | `UnauthorizedError` (401), `ForbiddenError` (403).                              |
| `src/app/api/auth/[...all]/route.ts` | Mounts every Better Auth endpoint via `toNextJsHandler`.                        |

## Session model

- Cookie name: `better-auth.session_token` (locked in `advanced.cookies.session_token.name` so the proxy can't drift).
- Cookie value: opaque token (32 chars). Server validates against `session` table.
- Cookie cache (`session.cookieCache.maxAge = 5*60`) lets the proxy do an
  optimistic check without a DB round-trip. Real role enforcement happens in
  server layouts via `requireAdmin(await getServerSession())`, which always
  hits the live session row — instant revocation when an admin demotes / bans.
- TTL: 7 days, rolling refresh every 24h.

## JWT plugin

Exposes `/api/auth/jwks` (public JWKS doc with the active signing key) and
`/api/auth/token` (returns a signed JWT for the authenticated user). The
signing keys are stored in the `jwks` table and rotated by Better Auth. We
ship the plugin without an integration test because there is no current
external consumer; add one when first wiring up a downstream service.

## Admin plugin

Roles `admin` and `user`, default `user`. Endpoints (all admin-only):

- `POST /api/auth/admin/set-role`
- `POST /api/auth/admin/ban-user` / `unban-user`
- `POST /api/auth/admin/remove-user`
- `POST /api/auth/admin/create-user`
- `GET /api/auth/admin/list-users`

Wrapped by `src/app/admin/users/actions.ts` which adds the self-target guard
(an admin can't demote, ban, or delete themselves — prevents accidental
lockout). The recovery procedure for a true lockout is in `.claude/ADMIN.md`.

## Pending-user gate

`databaseHooks.user.create.before` in `server.ts`:

1. If `ctx === null` → allowed. Means a trusted server script (seed) is
   calling `internalAdapter.createUser` directly. Not reachable from HTTP.
2. If the calling session is an admin → allowed. Means the admin is creating
   a user via `/admin/requests` approve (or via the admin plugin endpoint).
3. Otherwise → look up an `access_request` row with `email = $1 AND status =
'approved'`. If absent → return `false` (Better Auth surfaces an error).

This is why public `signUpEmail` calls are blocked: they have `ctx` set
(endpoint context) and no admin session, and no pre-approved request.

The `access_request` table has a **partial unique index on `(email)` WHERE
status = 'pending'`** — guarantees one open request per email and prevents
double-approve races.

## Profile auto-provisioning

`databaseHooks.user.create.after(user)` calls `ensureUserProfile(user.id)`
from `src/lib/settings/effective.ts`. That helper inserts a `user_profile`
row pointing at the default group, so every new user is enrolled in
admin-managed settings immediately. Admin-approve flow, the seeded admin,
and any future user-creation path all hit this hook.

## Change password

`authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions })`
is exposed via Better Auth's `/api/auth/change-password` endpoint. Wrapped by
`src/components/auth/change-password-dialog.tsx`, mounted from the account
dropdown (`<AuthButton>`). `revokeOtherSessions: true` is always passed —
every other session is signed out by the time the call resolves. After
success the dialog also calls `clearMustChangePassword()` (server action,
idempotent) so any admin-issued forced-change flag is reset.

## Forced password change (admin-issued temp passwords)

`user.mustChangePassword: boolean` is registered as a Better Auth
`user.additionalFields` so it flows through `auth.api.getSession()` and the
cookie cache automatically. It's set to `true` in two places:

- `approveRequest` in `src/lib/access-requests/service.ts` — after creating
  the user from an approved access request.
- `regenerateTempPassword` in `src/app/admin/users/actions.ts` — when an
  admin rotates a user's temp password.

Enforcement:

- `src/proxy.ts` forwards the request path via `x-dictaphone-pathname`.
- `src/app/layout.tsx` reads the header + session and, if
  `mustChangePassword === true && pathname !== "/change-password"`,
  `redirect("/change-password")`. This fires before any nested page renders,
  so every gated route bounces.
- `/change-password` (`src/app/change-password/page.tsx`) renders the
  forced form for flagged users; redirects to `/` for everyone else (the
  regular dropdown change is the path for non-forced flow).
- `forceChangePassword(current, next)` in
  `src/app/change-password/actions.ts` calls `auth.api.changePassword` with
  `revokeOtherSessions: true`, then `internalAdapter.updateUser({
mustChangePassword: false })`. On success the form redirects to `/`.

Layout-level enforcement means there is no way for a flagged user to reach
any other route in the app until they have set a new password — they're
sent back to `/change-password` whether they typed `/`, `/history`,
`/admin/anything`, etc.

## Sign-out

Client clicks Sign out in `<AuthButton>`:

1. `authClient.signOut()` — Better Auth clears cookie + invalidates session.
2. `softResetCachesFor(userId)` — drops the in-memory caches in
   `settings-store` and `transcripts-store` for the user that just left, so
   the next user signing in on this browser starts with their own data.
3. `router.replace("/login")`.

Hard wipe (Settings → Data → Wipe all data) calls
`wipeCurrentUserLocalData(userId)` which additionally drops the per-user
IDB database (`stt-dictaphone:<userId>`) and removes the namespaced
localStorage keys.

## Vitest + `server-only`

The `server-only` package errors at import time outside an RSC bundle. The
vitest config aliases it to `vitest.server-only-stub.ts`, an empty module.
Scripts that run via tsx (migrate, seed-admin) pass `NODE_OPTIONS=
"--conditions=react-server"` so the same package resolves to its no-op
export.
