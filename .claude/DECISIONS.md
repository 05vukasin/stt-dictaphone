# Decision log

ADR-style entries. Each: Context, Decision, Consequences. Update the file when
you make a load-bearing choice that future-you (or another agent) would
otherwise reverse on a whim.

## 1. Better Auth over NextAuth / Lucia / roll-your-own (2026-05-11)

**Context.** The project needs auth that runs in `docker compose`, supports
email+password, has roles, exposes JWTs for future external consumers, and is
maintained.

**Decision.** Better Auth 1.6 with `admin` + `jwt` plugins. Drizzle adapter on
Postgres.

**Consequences.** We get the admin plugin's role/ban/impersonation surface for
free, JWKS + token endpoint from the JWT plugin, and DB-backed sessions for
instant revocation. We're tied to Better Auth's session model (opaque cookie,
not stateless JWT access+refresh) — fine because instant revocation matches the
"admin un-approves a user" use case better than a stateless model would.
Migration cost if Better Auth becomes unmaintained: medium — the auth surface
is bounded to `src/lib/auth/` and the four `*.actions.ts` files.

## 2. Local-first content, server-side auth only (2026-05-11)

**Context.** The original app sells "everything on your device" as the privacy
story. Adding accounts could undermine that.

**Decision.** Postgres holds _only_ auth tables (`user`, `session`, `account`,
`verification`, `jwks`, `access_request`). Recordings, transcripts, settings
stay in IndexedDB + localStorage on the user's device.

**Consequences.** No cross-device sync. Acceptable trade-off for the stated
goal. Cross-device sync would require migrating the storage layer; the per-user
namespacing in Phase 4 doesn't preclude it but doesn't enable it either.

## 3. Per-user device-local namespacing (2026-05-11)

**Context.** Without isolation, signing user B in on user A's browser exposes
A's recordings. Browser storage is origin-scoped, not user-scoped.

**Decision.** Every IDB database is named `stt-dictaphone:<userId>` and every
localStorage key is suffixed with `:<userId>`. The recorder tree is wrapped in
`<UserScopeProvider>` so React hooks read the user id from context. Function-level
APIs take `userId` as the first arg.

**Consequences.** Phase 4 was the largest refactor in the upgrade. Existing
tests gained an explicit `TEST_USER` constant and a new `isolation by userId`
describe block. A new sentinel `__anon__` value is used when the user is not
signed in (e.g. on `/login`) so stores don't crash; the proxy ensures the
recorder never actually mounts under the sentinel in production. Soft wipe on
sign-out (drop in-memory caches but keep persisted slots) lets a user return to
the same browser and see their data; hard wipe behind the explicit "Wipe all
data" button removes the on-disk slot.

## 4. `databaseHooks.user.create.before` + `access_request` table — not the admin plugin's `banned` field (2026-05-11)

**Context.** "Request access → admin approves" can be modelled two ways:
(a) the admin plugin's `banned` flag (auto-create a banned user; admin
unbans), or (b) an external table that records requests, with a hook that
gates user creation on an approved row.

**Decision.** Option (b). The hook lives in `src/lib/auth/server.ts` and looks
up an `access_request` row with `status = 'approved'` for the user's email.

**Consequences.**

- Audit trail: `access_request` records who decided, when, with what note.
- Race safety: partial unique index on `(email) WHERE status = 'pending'`
  prevents two open requests for the same email.
- No half-created users on reject: rejection doesn't create a user row at all.
- Public `signUpEmail` calls are rejected with a generic error — we never
  surface the public endpoint and route everything through `requestAccess`.
- One footgun: the hook must permit calls from trusted server scripts. We
  identify those by `ctx === null` (no endpoint context).

## 5. Env-var admin seed, not a CLI wizard (2026-05-11)

**Context.** First-boot admin creation needs to be scriptable so `docker
compose up` produces a working app, including in CI smoke tests.

**Decision.** `ADMIN_EMAIL` + `ADMIN_PASSWORD` env vars. The entrypoint runs
`scripts/seed-admin.ts` after migrations. The script is idempotent and refuses
to overwrite a non-admin user with the seed email.

**Consequences.** The seed credentials are in the operator's `.env` file. The
operator is expected to either rotate them on first login or treat them as
break-glass. We do not force a password reset on first login — adding that
later is a self-contained change.

## 6. JWT plugin shipped without an integration test (2026-05-11)

**Context.** The user asked for JWT support. Better Auth's JWT plugin gives us
`/api/auth/jwks` + `/api/auth/token` with one line. We don't currently have a
downstream consumer of those tokens.

**Decision.** Ship the plugin; defer the integration test until there's a real
consumer.

**Consequences.** Bump in test coverage when a consumer lands. Risk: a silent
break of the JWT endpoint goes unnoticed in CI. Mitigated by the manual smoke
checklist ("curl /api/auth/jwks → key").

## 7. Tailwind v4 + webpack build (2026-05-11)

**Context.** The existing repo had `unset TURBOPACK; next build --webpack` in
the build script because Tailwind v4 + Serwist need webpack. Docker inherits
shell environment from the host.

**Decision.** The builder stage in `Dockerfile` runs `RUN unset TURBOPACK &&
npm run build` (one shell line). `TURBOPACK=1` must not appear in compose
`environment:` because `ENV` cannot be un-set, only overridden — and tests
showed Turbopack-built bundles miss Tailwind's CSS layer ordering.

**Consequences.** A 20s longer build than Turbopack would give us. Documented
in the Dockerfile + `.claude/DOCKER.md`. Will revisit when Serwist gains
Turbopack support (tracked upstream).

## 8. Node 25's built-in `localStorage` global (2026-05-11)

**Context.** Node 25 ships a Web Storage implementation as a global, but it's
stubbed (no methods) unless `--localstorage-file=...` is supplied. This
shadows jsdom's polyfill in vitest and broke every test that hit
`window.localStorage`.

**Decision.** `vitest.setup.ts` installs an in-memory `localStorage` /
`sessionStorage` stub before any test runs. Cleared in `afterEach`.

**Consequences.** Tests are robust against future Node bumps that further
strengthen the global. A small block of setup code we'd otherwise not need.

## 9. Admin-managed settings + API-key redaction (2026-05-11)

**Context.** Original design held every setting — including provider API
keys — in each user's `localStorage`. Useful for "all on device" but
incompatible with the enterprise control story the user asked for.

**Decision.** Move admin-tier settings (providers, keys, prompts,
autoSummarize, audioFormat, language default) to a new `settings_group`
Postgres table. The transcribe / summarize API routes call
`getEffectiveSettings(userId)` server-side and use the matching key. The
browser only ever sees a redacted `PublicEffectiveSettings` (no `*ApiKey`
fields) threaded through `<EffectiveSettingsProvider>` from the root layout.

**Consequences.** Privacy upgrade: API keys leave the browser entirely.
DevTools never carries an `x-api-key` header. A regression here (e.g. a
component importing `getEffectiveSettings` instead of the public variant)
would re-leak the keys — the only mitigation is that the resolver lives in
a `server-only` module, so any client import would error at build time.

## 10. One group per user, not many-to-many (2026-05-11)

**Context.** "Different teams should get different settings" can be modelled
as M:N (`user_group` join table, settings per join) or 1:N (user has one
`groupId`). The user asked for "one setting for one group of users and other
for the other group of user" — singular.

**Decision.** Single-group: `user_profile.group_id` foreign key, nullable
with `ON DELETE SET NULL`. The resolver falls back to the default group
when null or when the referenced group is gone.

**Consequences.** Trivial UI ("which group is this user in?"). Switching to
M:N later is a self-contained migration that touches only `queries.ts` and
`effective.ts`. Until then no need to define a "settings precedence" across
multiple memberships.

## 11. API keys stored encrypted at rest (2026-05-11, implemented 2026-05-11)

**Context.** Stored in `settings_group.openai_api_key` / `groq_api_key` /
`anthropic_api_key`. Plaintext through the first cut; the audit that asked
"are API keys encrypted?" flagged that anyone with the `postgres-data`
volume could lift them.

**Decision.** Wrap each column with AES-256-GCM. The data-encryption key is
derived from `BETTER_AUTH_SECRET` via HKDF-SHA256 with the info
`"settings-group-api-keys"` so the same secret can power other purposes
(Better Auth cookies, JWKS) without key reuse. Envelope format:
`v1:<base64url(nonce(12) || ciphertext || authTag(16))>`. The `v1:` prefix
lets us evolve the algorithm later without rewriting existing rows in a
breaking change.

Boundaries:

- `src/lib/crypto/secrets.ts` — `encryptSecret`, `decryptSecret`,
  `isEncrypted`. Pure functions, no external deps.
- `src/lib/settings/queries.ts` — `setGroupConfig` encrypts on write.
- `src/lib/settings/effective.ts` — `merge()` decrypts on read; the
  `getPublicEffectiveSettings` variant still strips the fields entirely
  before they reach the client.
- `scripts/encrypt-secrets.ts` — idempotent migration. Runs from the
  entrypoint after `scripts/migrate.ts` + `scripts/seed-admin.ts`, so
  existing deployments self-heal on the next rebuild.
- `scripts/rotate-secret-encryption.ts` — manual operator tool that
  re-encrypts every column under a new `BETTER_AUTH_SECRET`.

`decryptSecret` accepts non-`v1:` input and returns it unchanged, which
means a half-migrated DB still works and a rollback to plaintext is safe.
`encryptSecret` is a no-op on empty strings (the "no key configured"
default).

**Consequences.**

- A leaked Postgres dump or volume no longer hands over the API keys.
- Rotating `BETTER_AUTH_SECRET` requires the rotation script (docs in
  `.claude/DOCKER.md`). Forgetting to run it makes existing rows
  un-decryptable until you set the secret back.
- Admin UI changed: the API-key inputs no longer pre-populate. An empty
  input means "leave alone", a non-empty input rotates, and a Clear (X)
  button explicitly removes the key.

## 11b. Verification token storage hashing — deferred (2026-05-11)

**Context.** Better Auth has an undocumented option
`verification.storeIdentifier: "hashed"` that hashes the **identifier**
(typically an email) on the `verification` row. The `value` (the actual
token) remains plaintext.

**Decision.** Skip for now. We don't use any verification flow today
(no email verification, magic links, OTPs). Wiring an undocumented option
for a code path that never executes is brittle — if Better Auth renames
or removes the option, our config silently breaks.

**Follow-up.** Set this when we wire the first verification flow. The
config lives in `src/lib/auth/server.ts` once enabled.

## 12. Device-local settings shrink to v2 = `{ micDeviceId }` (2026-05-11)

**Context.** `settings-store` used to hold everything. After moving admin
config server-side, only the per-browser mic choice still needs to live on
the device.

**Decision.** New schema `DeviceSettingsSchema = { version: 2, micDeviceId }`.
The loader's existing schema-mismatch fallback drops the old v1 blob silently
on read — every device migrates on next sign-in with zero user action and
zero risk of an admin-managed value leaking from a stale cache.

**Consequences.** API keys formerly in localStorage are abandoned on the
device; `clearDeviceSettingsFor` also wipes the v1 key as belt-and-braces.
The test suite asserts both paths (`settings-store.test.ts`).

## 12b. Admin UI redacts existing API key values (2026-05-11)

**Context.** Even with encryption at rest, hydrating the admin form with
the ciphertext (or, accidentally, the plaintext) is wrong: the value
appears in HTTP response bodies, RSC payloads, and the DOM. An admin
session that gets MITM'd or whose tab is screen-shared shouldn't leak the
existing keys.

**Decision.** `src/app/admin/groups/[id]/group-form.tsx` keeps API-key
inputs **empty** on render. We only ship a boolean ("key is set" / "not
set") from the server. The admin sees a masked placeholder `••••••••` when
a key is set; saving an empty value is a no-op, a non-empty value rotates,
and an explicit Clear (X) button removes.

**Consequences.** An admin who wants to read out an existing key can't.
That's intentional — the value lives in Postgres + flows through
`getEffectiveSettings` only at request time. Admins who genuinely need to
rotate just paste a new value.

## 13. Forced password change via additional field + layout-level gate (2026-05-11)

**Context.** Admin-issued temp passwords (from access-request approval and
the new regenerate flow) should not be usable as real passwords — the user
must change them on first sign-in, and the app should be unreachable until
they do.

**Decision.** Add `mustChangePassword: boolean` to the `user` table via
Better Auth's `user.additionalFields` so the value flows through
`auth.api.getSession()` and the cookie cache. Enforce in the **root layout**:
the proxy forwards the request path as `x-dictaphone-pathname`; the root
layout reads it and, if the user is flagged and not already on
`/change-password`, `redirect("/change-password")`. The forced page itself
short-circuits when the flag is false.

**Consequences.** One DB column + one header. No proxy DB-fetch (the proxy
remains an optimistic cookie check). The gate fires uniformly for every
route under the root layout, including `/admin/*`. Down-side: a stale
cookie-cache could let a just-flagged user reach `/` for up to ~5 minutes
before the layout's session re-fetch picks up the change — acceptable
because the regenerate flow also revokes the user's sessions, forcing
re-auth which refreshes the cookie cache immediately.

## 14. Regenerate temp password revokes existing sessions (2026-05-11)

**Context.** When an admin rotates a user's password (because the user lost
the original temp, or for any reason), an open session cookie elsewhere
would still authenticate them. That's bad — the user could keep using the
app without ever going through the forced-change flow.

**Decision.** `regenerateTempPassword` calls `auth.api.revokeUserSessions`
after rotating the password (falling back to
`internalAdapter.deleteSessions(userId)` if the admin plugin endpoint isn't
available). The user is forced to sign in again with the new temp password,
which then triggers the layout gate to `/change-password`.

**Consequences.** Open tabs become 401-then-redirect on next server request,
which is the right user-visible behaviour. No risk of "phantom session"
bypassing the gate. The fallback path mirrors how the admin plugin
internally revokes sessions on ban/delete, so behaviour is consistent.

## 15. Portaled dropdown menu in admin user table (2026-05-11)

**Context.** The `/admin/users` table wrapper uses `overflow-hidden` to clip
its rounded corners. The per-row action menu was absolutely positioned inside
a cell, so it got clipped when the table only had one or two rows.

**Decision.** Render the menu through `createPortal` into `document.body`,
positioned with `position: fixed` derived from the trigger button's
`getBoundingClientRect()`. Close handlers (outside-click + Escape) live on
the portaled node and unbind on unmount.

**Consequences.** Menu always paints above every clipping ancestor and over
the rest of the page. No scroll-following needed (the menu closes on any
outside interaction anyway).
