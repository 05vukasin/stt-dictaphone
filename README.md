# STT Dictaphone

A self-hostable, enterprise-grade speech-to-text dictaphone — installable PWA, multi-provider AI, server-side auth + admin panel, with the user's audio still living on the device.

- **Hybrid sound-wave visualization** — calm decorative idle loop, mic-reactive while recording.
- **Whisper transcription** via OpenAI or Groq (much faster).
- **Auto-summary** via OpenAI GPT, Anthropic Claude, or Groq Llama.
- **Local-first audio** — recordings live in IndexedDB per-user; transcripts in localStorage. Audio never leaves the device except the bytes you send to your chosen provider.
- **Server-side auth + admin** — Better Auth with admin/jwt plugins, group-managed settings, admin-issued temporary passwords with forced first-login change.
- **API keys encrypted at rest** — AES-256-GCM with a key derived from `BETTER_AUTH_SECRET` via HKDF. Operator-controlled rotation script. The browser never sees the keys.
- **Duotone UI** — dark grey + dirty white only, light/dark themed via `next-themes`.
- **Installable PWA** — works offline, with native install prompt.

## Deploy with Docker (production)

The published image is on Docker Hub: **`teslicvukasin/stt-dictaphone`**.

```bash
# 1. Copy the env template and fill in real values
cp .env.prod.example .env

# 2. Generate a strong secret
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env

# 3. Pull + start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# 4. Tail logs to confirm migrations + admin seed ran
docker compose -f docker-compose.prod.yml logs -f web
```

The first boot:

- applies all Drizzle migrations (`drizzle/*.sql`)
- creates the admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (only if the users table is empty)
- seeds the default settings group
- self-heals any plaintext API keys to encrypted at rest (`scripts/encrypt-secrets.ts`)

Sign in as the admin, head to **Admin → Groups → default**, paste your provider API keys, save. Add other users via **Admin → Requests** as they submit access requests on the login page.

Putting this behind a reverse proxy: set `BETTER_AUTH_URL` to the public URL (e.g. `https://dictaphone.example.com`) and have your proxy forward to `localhost:3000`. Cookies are HttpOnly + Secure in production.

## Quick start (dev)

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To run the full stack (Postgres + web) locally use `docker compose up --build` instead — see [`.claude/DOCKER.md`](./.claude/DOCKER.md) for the full smoke checklist.

API keys are configured **by the admin** in the admin panel and live encrypted in Postgres; the browser never sees them.

## Scripts

| Script               | What it does                                              |
| -------------------- | --------------------------------------------------------- |
| `npm run dev`        | Dev server (Turbopack; service worker is disabled in dev) |
| `npm run build`      | Production build                                          |
| `npm start`          | Start the production build                                |
| `npm test`           | Run the Vitest suite once                                 |
| `npm run test:watch` | Re-run tests on file change                               |
| `npm run lint`       | ESLint                                                    |
| `npm run typecheck`  | `tsc --noEmit`                                            |
| `npm run format`     | Format with Prettier                                      |
| `npm run icons`      | Regenerate PWA icons                                      |

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind v4 (inline `@theme` in `src/app/globals.css`)
- next-themes · react-icons · zod · ulid · idb
- @serwist/next for PWA service worker
- Vitest + @testing-library/react + fake-indexeddb

## Architecture

The bigger picture lives in [`.claude/`](./.claude):

- [STATE.md](./.claude/STATE.md) — what exists right now (read this first)
- [AUTH.md](./.claude/AUTH.md) — Better Auth wiring, sessions, forced password change
- [DATABASE.md](./.claude/DATABASE.md) — Drizzle schema + migrations workflow
- [DOCKER.md](./.claude/DOCKER.md) — image layout, env vars, smoke checklist
- [ADMIN.md](./.claude/ADMIN.md) — admin panel routes + server actions
- [DECISIONS.md](./.claude/DECISIONS.md) — ADRs (encryption, group model, etc.)

Original PWA architecture docs (recording, waves, storage) live in [`docs/`](./docs).

## Privacy

- No analytics or telemetry.
- Audio blobs never leave IndexedDB on the device they were recorded on (per-user namespaced).
- Transcript text stays in localStorage; admin-managed config (providers, prompts, API keys) lives encrypted in Postgres.
- Provider API calls go to **only** the providers your admin has configured. Keys are decrypted in-memory just long enough to forward each request; nothing is logged.
- "Wipe all data" in Settings → Data clears every device-local trace for the current user.

## License

MIT — see [LICENSE](./LICENSE).
