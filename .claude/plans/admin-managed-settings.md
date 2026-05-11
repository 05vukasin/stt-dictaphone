# Admin-managed settings + groups + change-password

## Context

Today every setting (providers, API keys, prompts, language, autoSummarize,
audioFormat, micDeviceId) lives in the user's localStorage. The user wants to
flip that around for the enterprise use case:

- The **admin** controls every setting from the admin panel.
- Admins can create **groups** of users; each group has its own settings.
- A user can only adjust a **small whitelist** of fields for themselves
  (language hint + summary prompt). Their overrides stick per-user.
- Admins set API keys; **the browser must never see them**.
- The account dropdown gains a **"Change password"** item next to "Sign out".

This is a privacy upgrade (API keys leave the browser) and a control upgrade
(admin enforces org-wide config). Existing per-user IDB recordings stay where
they are; this plan only touches settings.

## Bottom line

- **Effort:** ~2 to 2.5 days end-to-end, broken into 7 phases. Each phase ships
  green tests and an exit criterion.
- **Biggest design call:** "one group per user" model (FK on `user_profile`)
  rather than M:N. Simpler to reason about, simpler UI, matches the "users
  belong to a team with one config" mental model. Easy to switch to M:N later
  if a real need shows up.
- **Biggest security upgrade:** API keys move to Postgres. `/api/transcribe`
  and `/api/summarize` read the user's effective config server-side; the
  `x-api-key` header is removed entirely. Even DevTools cannot leak the keys.
- **Biggest UX tweak:** the Settings overlay is split. The Recorder's Settings
  shows only what the user is allowed to change. Everything else moves to a
  new Admin → Groups → \<group\> page.

## Field tier table

This decides everything else. Lock this first.

| Field                | Tier                                           | Where it lives                                                                                                            |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `sttProvider`        | admin                                          | `settings_group`                                                                                                          |
| `summaryProvider`    | admin                                          | `settings_group`                                                                                                          |
| `openaiApiKey`       | admin · **server-only**                        | `settings_group`, never sent to client                                                                                    |
| `groqApiKey`         | admin · **server-only**                        | `settings_group`, never sent to client                                                                                    |
| `anthropicApiKey`    | admin · **server-only**                        | `settings_group`, never sent to client                                                                                    |
| `autoSummarize`      | admin                                          | `settings_group`                                                                                                          |
| `audioFormat`        | admin                                          | `settings_group`                                                                                                          |
| `sttPrompt`          | admin                                          | `settings_group`                                                                                                          |
| `language`           | admin default + **user override**              | `settings_group` + `user_profile.language_override`                                                                       |
| `summaryPrompt`      | admin default + **user override (if allowed)** | `settings_group.summary_prompt` + `settings_group.allow_summary_prompt_override` + `user_profile.summary_prompt_override` |
| `micDeviceId`        | **device-local**                               | localStorage (different mics on different devices)                                                                        |
| `theme` (light/dark) | **device-local**                               | next-themes cookie (unchanged)                                                                                            |

`micDeviceId` and `theme` stay on the device because they're device/browser
properties, not org policy.

## Data model

New tables (Drizzle):

```ts
// src/lib/db/schema/groups.ts
export const settingsGroup = pgTable(
  "settings_group",
  {
    id: text("id").primaryKey(), // ulid via src/lib/id.ts
    name: text("name").notNull().unique(),
    description: text("description").notNull().default(""),
    isDefault: boolean("is_default").notNull().default(false),

    // Admin-controlled config:
    sttProvider: text("stt_provider").notNull().default("openai"),
    summaryProvider: text("summary_provider").notNull().default("openai"),
    openaiApiKey: text("openai_api_key").notNull().default(""),
    groqApiKey: text("groq_api_key").notNull().default(""),
    anthropicApiKey: text("anthropic_api_key").notNull().default(""),
    language: text("language").notNull().default("auto"),
    autoSummarize: boolean("auto_summarize").notNull().default(true),
    audioFormat: text("audio_format").notNull().default("webm"),
    sttPrompt: text("stt_prompt").notNull().default(""),
    summaryPrompt: text("summary_prompt").notNull().default(DEFAULT_SUMMARY_PROMPT),
    allowSummaryPromptOverride: boolean("allow_summary_prompt_override").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdBy: text("created_by"), // admin user id, nullable
  },
  (t) => ({
    // Exactly one default group at a time.
    onlyOneDefault: uniqueIndex("settings_group_default_idx")
      .on(t.isDefault)
      .where(sql`${t.isDefault} = true`),
  }),
);

export const userProfile = pgTable("user_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => settingsGroup.id, { onDelete: "set null" }),
  languageOverride: text("language_override"), // null → use group default
  summaryPromptOverride: text("summary_prompt_override"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

Notes:

- API keys are stored in plaintext. Acceptable for self-hosted; an enterprise
  follow-up could AES-GCM-wrap them with `BETTER_AUTH_SECRET` — flag it as a
  follow-up in `DECISIONS.md`.
- `user_profile.groupId` is **nullable** with `ON DELETE SET NULL` so deleting
  a group doesn't orphan users — they fall back to the default group via the
  resolver.
- The partial unique index on `is_default` enforces "at most one default" at
  the DB level, not just in app code.

## Effective-settings resolver

One place that knows how to merge group config + user override:

```ts
// src/lib/settings/effective.ts (NEW, server-only)

export interface EffectiveSettings {
  groupId: string;
  groupName: string;
  sttProvider: SttProvider;
  summaryProvider: SummaryProvider;
  openaiApiKey: string; // present only on server-side type
  groqApiKey: string;
  anthropicApiKey: string;
  language: string; // resolved (override || group default)
  autoSummarize: boolean;
  audioFormat: AudioFormat;
  sttPrompt: string;
  summaryPrompt: string; // resolved (override || group default)
  allowSummaryPromptOverride: boolean;
}

export interface PublicEffectiveSettings {
  /* same shape, no *ApiKey fields */
}

export async function getEffectiveSettings(userId: string): Promise<EffectiveSettings>;
export async function getPublicEffectiveSettings(userId: string): Promise<PublicEffectiveSettings>;
```

Resolution order:

1. Look up `user_profile` for the user. If absent, create one pointing at the
   default group.
2. Look up the group via `user_profile.group_id`. If null or deleted, fall
   back to the default group.
3. Merge: `language = override ?? group.language`,
   `summaryPrompt = (allowOverride && override) ? override : group.summaryPrompt`.

`getPublicEffectiveSettings` does the same and then `delete`s the `*ApiKey`
fields. **It is the only function the client tree imports.**

## Phased work breakdown

### Phase 1 — Schema + migration + seed default group

Files:

- `src/lib/db/schema/groups.ts` (new) — `settingsGroup`, `userProfile`.
- `src/lib/db/schema/index.ts` — re-export.
- `npm run db:generate` → new SQL migration (`drizzle/0001_groups.sql`).
- `scripts/seed-admin.ts` — extend to also seed:
  - The default group named `"default"` if no group exists.
  - A `user_profile` row for the admin (`groupId = defaultGroupId`).
- `.claude/DATABASE.md` — add the new tables.

Tests:

- `src/lib/db/schema/groups.test.ts` — quick smoke that the schema compiles
  and the partial-unique index expression renders.
- Extend `scripts/seed-admin.test.ts` — seed creates the default group when
  none exists; second run is a no-op.

**Exit:** `npm run db:migrate` adds the two tables. `docker compose restart
web` brings up the stack with one default group + the admin in it.

### Phase 2 — Effective-settings resolver + auto-provisioning

Files:

- `src/lib/settings/effective.ts` (new, `server-only`):
  - `getEffectiveSettings(userId)` + `getPublicEffectiveSettings(userId)`.
  - `ensureUserProfile(userId)` — creates the `user_profile` row pointing at
    the default group if missing. Called lazily so existing users (who
    pre-date this change) silently inherit the default.
- `src/lib/settings/queries.ts` (new) — `getGroupById`, `getDefaultGroup`,
  `getUserProfile`, `setUserOverrides`, `setGroupConfig`, `listGroups`,
  `createGroup`, `deleteGroup`, `setUserGroup`.
- `src/lib/auth/server.ts` — `databaseHooks.user.create.after`:
  inserts a `user_profile` row pointing at the default group whenever Better
  Auth creates a user (covers the admin-approve flow and the seed).

Tests (all under `vi.mock("@/lib/db/client")` — no real DB):

- `src/lib/settings/effective.test.ts` — resolves override + fallback,
  redacts keys in the public variant.
- `src/lib/settings/queries.test.ts` — orchestration around `db`.

**Exit:** unit tests green. Calling `getEffectiveSettings(adminId)` against a
running DB returns the default group's values.

### Phase 3 — Settings server actions (admin + user)

Files:

- `src/app/admin/groups/actions.ts` (new) — `'use server'` actions:
  - `createGroup({ name, description })`
  - `deleteGroup(groupId)` (refuses to delete the default group)
  - `setGroupConfig(groupId, partial)` — patch admin-controlled fields,
    validates with a zod schema lifted from `src/types/settings.ts`.
  - `setDefaultGroup(groupId)` — flips `is_default` atomically in a transaction.
- `src/app/admin/users/actions.ts` — add `moveUserToGroup(userId, groupId | null)`.
- `src/app/settings/actions.ts` (new) — `'use server'` actions for the user:
  - `setLanguageOverride(language | null)`
  - `setSummaryPromptOverride(text | null)` — rejects with `FORBIDDEN`
    when the user's group has `allowSummaryPromptOverride = false`.

Tests:

- `src/app/admin/groups/actions.test.ts` — admin gating, default-group guard,
  zod parse.
- `src/app/settings/actions.test.ts` — auth gating, override-allowed guard.

**Exit:** actions invocable from any server context. Each returns the
discriminated `{ ok, ... } | { ok: false, error }` shape we already use for
access requests so the UI is consistent.

### Phase 4 — API routes use effective settings (privacy upgrade)

Files modified:

- `src/app/api/transcribe/route.ts`:
  - Remove `x-api-key` and `x-stt-provider` header reads.
  - Call `getEffectiveSettings(session.user.id)`.
  - Use `settings.sttProvider` and the matching `*ApiKey` from the resolved
    config. Reject with 503 if the configured provider has no key (clean
    admin-facing error).
  - Use `settings.language` and `settings.sttPrompt` directly (already
    resolved with user override).
- `src/app/api/summarize/route.ts` — same, for the summary side.
- `src/lib/api-client.ts` (browser) — drop the `apiKey` parameter; just send
  the audio blob + optional per-request override (kept for forward
  compatibility but currently unused).
- `src/lib/transcription-service.ts` — no longer reads keys from the local
  store. Reads only `audioFormat`, language, etc. for the UI side from a
  new client hook (Phase 5).

Tests updated:

- `route.test.ts` for both routes: mock `getEffectiveSettings` instead of the
  `x-api-key` header. Add a "no admin-set key" → 503 case.

**Exit:** A signed-in user can record + transcribe with no API key in their
browser. DevTools network tab never carries `x-api-key`.

### Phase 5 — Client-side effective-settings consumer

Files added:

- `src/lib/settings/client-context.tsx` — `<EffectiveSettingsProvider value>`,
  `useEffectiveSettings()`. Pure client; receives the
  `PublicEffectiveSettings` from the server layout (Phase 6).

Files modified:

- `src/app/providers.tsx` — accepts `effectiveSettings` as a prop; wraps the
  tree in `<EffectiveSettingsProvider>`.
- `src/app/layout.tsx` (server) — fetches public effective settings alongside
  the session.
- `src/components/recorder/recorder-shell.tsx` — replaces `useSettings()`
  reads with `useEffectiveSettings()` for the admin-controlled fields. The
  recorder constructs `DictaphoneRecorder` with `effective.audioFormat`.
- `src/components/recording/transcript-view.tsx` and `summary-view.tsx` —
  call the API routes without an apiKey; just pass language/prompt as needed.
- `src/lib/storage/settings-store.ts`:
  - Old fields go away (the only thing left in localStorage is
    `micDeviceId` + the install-dismissed flag). New shape:
    ```ts
    DeviceSettingsSchema = z.object({
      version: z.literal(2),
      micDeviceId: z.string().default(""),
    });
    ```
  - Old `v1` data is detected and silently dropped via the existing
    fallback-to-defaults branch — that's already how the loader works on
    schema mismatch.

Tests:

- `src/lib/storage/settings-store.test.ts` — updated to the new shape.
- `src/lib/settings/client-context.test.tsx` — context resolves.
- Recorder-shell smoke (existing test still passes because the shell just
  forwards what it reads).

**Exit:** local API keys are gone. Settings overlay still loads (Phase 6
trims its content).

### Phase 6 — User Settings overlay rewrite

The existing `<SettingsOverlay>` becomes a thin shell. Sections:

- **Appearance** — unchanged (theme toggle).
- **Recording** — language hint (editable), summary prompt
  (editable if `allowSummaryPromptOverride`, else read-only with a "Managed
  by your admin" hint), microphone device (editable, device-local).
- **Defaults from admin** — read-only cards showing the provider, audio
  format, autoSummarize state, etc. Each labelled "Managed by your admin"
  with the group name.
- **Account** — sign out, **change password** (Phase 7 hooks it up).

Files changed:

- `src/components/settings/provider-section.tsx` — DELETE the API key inputs.
  Show provider + audioFormat + autoSummarize as read-only chips.
- `src/components/settings/prompt-section.tsx` — STT prompt becomes
  read-only; summary prompt is editable iff allowed.
- `src/components/settings/language-section.tsx` (new) — moves language to
  its own section since it's user-overridable.
- `src/components/settings/mic-section.tsx` (new) — pulls the mic picker out
  of provider-section (today it's bundled there); it's the one device-local
  thing besides the theme.
- `src/components/settings/data-section.tsx` — unchanged behaviour, still
  the only place to wipe local data.
- `src/components/settings/settings-overlay.tsx` — composes the trimmed sections.

Tests:

- `provider-section.test.tsx`, `prompt-section.test.tsx` updated.
- `settings-overlay.test.tsx` — shape smoke.

**Exit:** A regular user signs in, opens Settings, sees ONLY language +
summary prompt (if allowed) + mic + theme + change password. The user cannot
see API keys, cannot change providers.

### Phase 7 — Admin → Groups panel + Change password

#### Admin → Groups

Files added:

- `src/app/admin/groups/page.tsx` — server fetch of all groups, list view
  with "+ New group" and a star next to the default.
- `src/app/admin/groups/new/page.tsx` — minimal "name + description" form.
- `src/app/admin/groups/[id]/page.tsx` — full settings editor.
- `src/app/admin/groups/[id]/group-form.tsx` (client) — form bound to
  `setGroupConfig`. API key inputs use `type="password"` + show/hide toggle.
- `src/app/admin/groups/[id]/members-section.tsx` (client) — lists users in
  this group with an "Add user" picker that calls `moveUserToGroup`.
- `src/components/admin/admin-shell.tsx` — adds the "Groups" tab to the nav.
- `src/app/admin/users/users-table.tsx` — adds a "Group" column with an
  inline dropdown; "Move to group" action.

#### Change password

Files added:

- `src/components/auth/change-password-dialog.tsx` — modal with current /
  new / confirm fields. On submit:
  `authClient.changePassword({ currentPassword, newPassword,
revokeOtherSessions: true })`. Toasts on success/failure.
- `src/components/auth/auth-button.tsx` — gains a "Change password" item
  above "Sign out".

Tests:

- `src/app/admin/groups/actions.test.ts` (covered in Phase 3, extended).
- `src/components/auth/change-password-dialog.test.tsx` — three-field
  validation (match, min length), calls `authClient.changePassword` once.
- `src/components/auth/auth-button.test.tsx` — extends existing test.

**Exit:** End-to-end click-through:

1. Admin → Groups → create "engineering" → set OpenAI key + provider.
2. Admin → Users → move alice@example.com to "engineering".
3. Alice signs in → records → transcript appears (key was never in her
   browser, the API route used the engineering group's key).
4. Alice changes her language to Serbian — sticks across reloads.
5. Alice opens dropdown → Change password → flow succeeds, other sessions
   are revoked (Better Auth handles this).

## Existing-data migration

Run-once on first sign-in after deploy:

- `settings-store` on first read detects `version: 1` in localStorage and
  drops it (already the behaviour — schema mismatch → defaults). API keys
  effectively disappear from the device.
- Existing IndexedDB recordings are untouched (they live under their per-user
  namespace from Phase 4 of the previous wave).

Documented as ADR entry 9 in `.claude/DECISIONS.md`.

## Tests added or touched

| File                                                  | Coverage                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/db/schema/groups.test.ts`                    | schema compiles, default-group constraint                                            |
| `src/lib/settings/effective.test.ts`                  | resolver merges, public variant redacts keys                                         |
| `src/lib/settings/queries.test.ts`                    | each query helper                                                                    |
| `src/app/admin/groups/actions.test.ts`                | admin gating, default-group guard, group CRUD, setGroupConfig zod                    |
| `src/app/settings/actions.test.ts`                    | auth gating, override-allowed guard                                                  |
| `src/app/api/transcribe/route.test.ts`                | rewritten — no more x-api-key, mocks getEffectiveSettings, adds 503-when-key-missing |
| `src/app/api/summarize/route.test.ts`                 | same                                                                                 |
| `src/lib/storage/settings-store.test.ts`              | new v2 shape (just `micDeviceId`)                                                    |
| `src/components/auth/change-password-dialog.test.tsx` | field validation, submit                                                             |
| `src/components/auth/auth-button.test.tsx`            | Change password menu item appears                                                    |

Manual smoke (added to `.claude/DOCKER.md`):

1. Sign in as admin → `/admin/groups` → see "default" group seeded.
2. Edit it → paste an OpenAI key → save.
3. Create new group "team-a", paste a different key, set summaryProvider.
4. `/admin/users` → move test user into "team-a".
5. Sign in as test user → record → transcript works without any key in
   localStorage (verify in DevTools).
6. Test user → Settings → change language → reload → still Serbian.
7. Test user → account dropdown → Change password → succeeds; old session
   on a second tab is logged out within the 5-minute cookie-cache window.

## Documentation updates

| File                   | Edit                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/STATE.md`     | Settings now Postgres-backed for admin tier; localStorage holds only `micDeviceId`.                                                               |
| `.claude/DATABASE.md`  | `settings_group` + `user_profile` tables.                                                                                                         |
| `.claude/AUTH.md`      | `databaseHooks.user.create.after` provisions `user_profile`. Change-password endpoint exposed.                                                    |
| `.claude/ADMIN.md`     | `/admin/groups` workflow, "default group cannot be deleted" rule, group-membership change flow.                                                   |
| `.claude/DECISIONS.md` | New ADRs: (9) admin-managed settings + key redaction; (10) one-group-per-user; (11) API keys stored in plaintext, follow-up to AES-GCM-wrap.      |
| `docs/ARCHITECTURE.md` | Auth boundary diagram gains a "Settings (admin-managed)" arrow from the DB to route handlers; explicit note that the browser never sees API keys. |

## Open questions

1. **Per-recording overrides.** Today the user can change language right
   before hitting Record. With server-side effective settings the user would
   instead change it in Settings first. Acceptable? Or should the recorder
   show an inline language picker that triggers `setLanguageOverride`
   under the hood?
2. **Default summary prompt source of truth.** `src/types/settings.ts` has
   `DEFAULT_SUMMARY_PROMPT`. After this change, the **group row** is the
   source of truth at runtime — but the seeded default group needs to read
   it from somewhere. Plan: keep `DEFAULT_SUMMARY_PROMPT` in the types file
   as the **first-boot seed value**; after that, any change goes through
   the admin UI.
3. **Audit logging.** Not in scope. Would add a `settings_audit` table
   storing every group/user override change. Note as a follow-up.

## Critical files to land correctly

- `src/lib/settings/effective.ts` — the single resolver. Every other
  feature depends on it returning the right merge.
- `src/lib/db/schema/groups.ts` — schema typos here cascade through every
  test.
- `src/app/api/transcribe/route.ts` / `summarize/route.ts` — removing
  `x-api-key` is the privacy upgrade; missing this leaves keys in the wire.
- `src/app/providers.tsx` + `src/app/layout.tsx` — they wire the
  server-fetched public effective settings into the client tree. Without
  this the recorder doesn't know which audioFormat to use.
- `src/components/auth/auth-button.tsx` + `change-password-dialog.tsx` —
  the user-facing change-password flow.
