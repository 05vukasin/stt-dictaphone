# STT Dictaphone — current state

Snapshot of what exists in the repo right now. Updated at the end of every
implementation phase. Read this first when picking the project up cold.

## Surface area

| Concern                     | Location                                                                         |
| --------------------------- | -------------------------------------------------------------------------------- |
| Auth library                | Better Auth 1.6 + admin + jwt plugins · `src/lib/auth/server.ts`                 |
| ORM                         | Drizzle + `postgres-js` · `src/lib/db/client.ts`                                 |
| Migrations                  | `drizzle/` (generated from `src/lib/db/schema/*.ts`)                             |
| Auth handler                | `src/app/api/auth/[...all]/route.ts` (mounts every Better Auth route)            |
| Proxy (was middleware)      | `src/proxy.ts` — gates everything except the public allowlist                    |
| Login UI                    | `src/app/login/` (tabbed: Sign in / Request access)                              |
| Admin panel                 | `src/app/admin/{page,users,groups,requests}`                                     |
| Default-admin seed          | `scripts/seed-admin.ts` — admin + default group + admin profile, idempotent      |
| Per-user storage            | `src/lib/storage/user-scope.tsx` + `<UserScopeProvider>` in `src/app/layout.tsx` |
| Admin-managed settings      | `src/lib/db/schema/groups.ts` + `src/lib/settings/{queries,effective}.ts`        |
| Effective settings (client) | `src/lib/settings/client-context.tsx` (`useEffectiveSettings`)                   |
| Change password             | `src/components/auth/change-password-dialog.tsx` (mounted via `AuthButton`)      |
| Forced change-password flow | `src/app/change-password/{page,forced-form,actions}.tsx` + layout gate           |
| Temp-password regenerate    | `regenerateTempPassword` in `src/app/admin/users/actions.ts`                     |

## Routes

- Public: `/login`, `/api/auth/*`, `/api/health`, `/sw.js`, `/manifest.json`, `/_next/*`, `/icons/*`.
- Authenticated: `/`, `/history`, `/recording/[id]`, `/api/transcribe`, `/api/summarize`.
- Admin-only: `/admin`, `/admin/users`, `/admin/groups`, `/admin/groups/new`, `/admin/groups/[id]`, `/admin/requests`.

API gating returns `401 {error: "Unauthorized"}` (JSON), HTML gating 307s to `/login?next=…`.
Transcribe/summarize return `503` when no API key is configured for the user's group.

## Postgres tables

`user`, `session`, `account`, `verification`, `jwks`, `access_request`,
`settings_group` (admin-managed config, partial-unique on `is_default`),
`user_profile` (group membership + per-user overrides for `language` and
`summary_prompt`).

Recordings + transcripts still live on the device. The device-local settings
slot now holds **only `micDeviceId`** (v2 schema). Old v1 blobs (which carried
API keys) are silently dropped on read.

## Field tier

| Field                                                                         | Tier                                                                | Storage                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| `sttProvider`, `summaryProvider`, `autoSummarize`, `audioFormat`, `sttPrompt` | admin                                                               | `settings_group`                                          |
| `openaiApiKey`, `groqApiKey`, `anthropicApiKey`                               | admin · **server-only**                                             | `settings_group`, never sent to client                    |
| `language`                                                                    | admin default + user override                                       | `settings_group` + `user_profile.language_override`       |
| `summaryPrompt`                                                               | admin default + user override (iff `allow_summary_prompt_override`) | `settings_group` + `user_profile.summary_prompt_override` |
| `micDeviceId`                                                                 | device-local                                                        | localStorage v2                                           |
| `theme`                                                                       | device-local                                                        | next-themes cookie                                        |

## Effective-settings resolver

`src/lib/settings/effective.ts` is the single brain. `getEffectiveSettings(userId)`
returns the merged value with API keys (server-only); `getPublicEffectiveSettings`
strips them and is the only variant the client tree sees, fed from the root
layout into `<EffectiveSettingsProvider>`.

## How to bring it up locally

```
cp .env.example .env
# fill BETTER_AUTH_SECRET (openssl rand -base64 32), ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up --build
```

Sign in as admin, go to **Admin → Groups → default**, paste API keys, save.
From then on every member of that group can record without ever seeing the
keys. Create more groups for other teams via "+ New group".

## Tests

`npm run test` — currently 33 files / 179 tests. Coverage tables in
`docs/TESTING.md` and `.claude/DOCKER.md`.
