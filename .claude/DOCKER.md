# Docker

Multi-stage Dockerfile + `docker-compose.yml` for a one-command stack: a
Postgres 16 container and the Next.js app running `next start`. Recordings
still live on the user's device — the container only holds auth state.

## Files

| Path                   | What's in it                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `Dockerfile`           | `deps` → `builder` → `runner`. Node 22 alpine, non-root user, healthcheck on `/api/health`. |
| `docker-compose.yml`   | `postgres` (postgres:16-alpine, healthcheck) + `web` (depends on healthy postgres).         |
| `docker/entrypoint.sh` | Runs `tsx scripts/migrate.ts`, then `seed-admin.ts`, then `exec next start`.                |
| `.dockerignore`        | Excludes `.next`, `node_modules`, `docs/`, `.claude/`, env files, the generated SW.         |
| `.env.example`         | Every env var the stack reads (with one-line purpose).                                      |

## Required env vars

| Name                                                | Required   | Purpose                                                                                                     |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                      | yes        | Postgres connection string. Compose builds this from `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`. |
| `BETTER_AUTH_SECRET`                                | yes        | 32+ byte random secret. Generate with `openssl rand -base64 32`. Signs session cookies + JWKS.              |
| `BETTER_AUTH_URL`                                   | yes        | The base URL the browser uses. Must match — cookies are domain-bound.                                       |
| `ADMIN_EMAIL`                                       | first boot | Seed admin email. Ignored after an admin exists.                                                            |
| `ADMIN_PASSWORD`                                    | first boot | Seed admin password. Ignored after an admin exists.                                                         |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | no         | Compose-only. Default `dictaphone`.                                                                         |
| `NEXT_TELEMETRY_DISABLED`                           | no         | Set to `1` to silence telemetry.                                                                            |
| `WEB_PORT`                                          | no         | Host port mapping for the web container. Default `3000`.                                                    |

## Smoke checklist

After every change touching auth, the DB schema, settings groups, or the
Dockerfile, re-run:

1. `cp .env.example .env` and fill `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
2. `docker compose up --build` — wait for `web` to report `healthy`.
3. `curl -fsS http://localhost:3000/api/health` → `{"ok":true,...}`.
4. `curl -fsS http://localhost:3000/api/auth/jwks` → JWKS doc with one key.
5. Browser → `http://localhost:3000` → redirected to `/login`.
6. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` → land on `/`.
7. **Admin → Groups → default** → paste an OpenAI key + save. Confirm
   "Group updated" toast.
8. **Admin → Groups → New group** → name `engineering` → save → on the editor
   paste a different OpenAI key.
9. Open a private window → `/login` → Request Access (`test@example.com`,
   "smoke").
10. Admin window → `/admin/requests` → Approve → temp-password modal.
11. **Admin → Users** → on the test user's row, change Group dropdown to
    `engineering`.
12. Private window → sign in with the temp password → recorder loads.
13. **DevTools Network tab open** — record + transcribe. Confirm:
    - the POST to `/api/transcribe` carries **no** `x-api-key` header;
    - the request succeeds (key is read server-side from the `engineering`
      group).
14. Settings → change language to Serbian → reload → still Serbian.
15. Account dropdown → Change password → flow succeeds; other sessions are
    revoked.
16. Sign out of the private window → sign in as admin in the same window →
    verify `/history` is empty (per-user IDB namespace is doing its job).
17. `docker compose restart web` → the seed step short-circuits ("admin user
    already exists — no-op.") and the default group survives.

## Running without `docker compose`

Some distributions (Arch / CachyOS) split the compose plugin into a separate
package. If `docker compose` says "unknown command", install `docker-compose`
(Arch) or run the stack with raw `docker`:

```sh
# Postgres
docker run --rm -d --name dictaphone-pg \
  -e POSTGRES_USER=dictaphone -e POSTGRES_PASSWORD=dictaphone -e POSTGRES_DB=dictaphone \
  -p 5432:5432 postgres:16-alpine

# Migrations + seed (host-side, talking to the container)
DATABASE_URL=postgres://dictaphone:dictaphone@localhost:5432/dictaphone \
  npm run db:migrate
DATABASE_URL=… BETTER_AUTH_SECRET=… BETTER_AUTH_URL=http://localhost:3000 \
  ADMIN_EMAIL=admin@local ADMIN_PASSWORD=… \
  NODE_OPTIONS=--conditions=react-server tsx scripts/seed-admin.ts

# Build + run the web image
docker build -t dictaphone-web .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://dictaphone:dictaphone@host.docker.internal:5432/dictaphone \
  -e BETTER_AUTH_SECRET=… -e BETTER_AUTH_URL=http://localhost:3000 \
  -e ADMIN_EMAIL=admin@local -e ADMIN_PASSWORD=… \
  dictaphone-web
```

## Build constraints

- Tailwind v4 + Serwist require **webpack**, not Turbopack. The Dockerfile
  builder stage does `RUN unset TURBOPACK && npm run build` so the env doesn't
  carry the flag inherited from a host shell. Don't move `TURBOPACK=1` into
  compose `environment:` — there's no way to un-set a var via `ENV` once it's
  there.
- The runner stage copies `src/` because `scripts/migrate.ts` and `seed-admin.ts`
  import from `src/lib/...` at runtime. They're TypeScript files run by `tsx`,
  not part of the `.next` bundle.
- `wget` is installed in the runner solely so the Docker `HEALTHCHECK` can hit
  `/api/health` without curl.
- Non-root user `nextjs:nodejs` (1001:1001).

## Common failures

- **`UnhandledSchemeError: Reading from "node:crypto"`** — a server-side
  helper is being pulled into a client bundle. Move it behind a server-only
  boundary or split it (see how `format.ts` is separate from
  `temp-password.ts`).
- **`This module cannot be imported from a Client Component`** — a script
  ran without `NODE_OPTIONS="--conditions=react-server"`. The entrypoint sets
  this for `seed-admin.ts`. Add it to any new server-side script that imports
  `src/lib/auth/server.ts`.
- **`BETTER_AUTH_SECRET must be set`** — compose fails fast with this when
  `.env` is missing it. Generate with `openssl rand -base64 32`.
