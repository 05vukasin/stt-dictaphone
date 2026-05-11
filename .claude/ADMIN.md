# Admin panel

`/admin` is server-gated by `src/app/admin/layout.tsx`:

```ts
const session = await getServerSession();
if (!session?.user?.id) redirect("/login?next=/admin");
if (!isAdmin(session)) redirect("/");
```

Anything reachable from `/admin/**` runs through this layout, so role
enforcement is centralised — even if the proxy cookie is stale, the layout
calls `auth.api.getSession` which reads the live session row.

## Pages

| Route                | What it does                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin`             | Landing — Users / Requests cards, pending-count badge.                                                                                                                               |
| `/admin/users`       | Lists users via `auth.api.listUsers` (limit 200, newest first). Per-row dropdown: Promote ⇄ Demote, Ban / Unban, Delete. Inline Group selector per row.                              |
| `/admin/groups`      | All settings groups with member counts. ★ marks the default group. New group button at top right.                                                                                    |
| `/admin/groups/new`  | Name + description form. Settings are edited on the next page.                                                                                                                       |
| `/admin/groups/[id]` | Full editor: description, providers, audio format, autoSummarize, API keys (password inputs), language default, STT prompt, summary prompt + override toggle. Members section below. |
| `/admin/requests`    | Lists `access_request` rows (pending + decided). Per-pending-row: Approve, Reject.                                                                                                   |

## Server actions

| Action                             | File                                | What it does                                                                                                                                                    |
| ---------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setRole(userId, role)`            | `src/app/admin/users/actions.ts`    | Refuses if `userId === adminId`. Calls `auth.api.setRole`. Revalidates `/admin/users`.                                                                          |
| `banUser(userId, banReason?)`      | same                                | Refuses self-target. Calls `auth.api.banUser` with default reason.                                                                                              |
| `unbanUser(userId)`                | same                                | No self-target guard (an admin can lift their own ban — useful if a colleague did it).                                                                          |
| `removeUser(userId)`               | same                                | Refuses self-target. Cascades to `session` and `account` (FK).                                                                                                  |
| `approve(id)`                      | `src/app/admin/requests/actions.ts` | Calls `approveRequest(id, adminId, await headers())` which is transactional. Returns `{ ok, email, tempPassword }`. UI shows the temp password once in a modal. |
| `reject(id, note)`                 | same                                | Calls `rejectRequest`. No user row is created.                                                                                                                  |
| `createGroup({name, description})` | `src/app/admin/groups/actions.ts`   | Inserts a new group with default settings. Surfaces "Group name already exists." on unique-violation.                                                           |
| `deleteGroup(id)`                  | same                                | Refuses to delete the default group. Members fall back to the default via `ON DELETE SET NULL`.                                                                 |
| `setGroupConfig(id, patch)`        | same                                | Zod-strict patch over the admin-mutable fields. Revalidates `/admin/groups/[id]` and `/` so members see new settings on next render.                            |
| `setDefaultGroup(id)`              | same                                | Atomic flip inside a transaction — clears every other `is_default = true` before setting this one.                                                              |
| `moveUserToGroup(userId, gid)`     | same                                | Upserts the user's `user_profile.group_id`. `null` clears (member falls back to default via the resolver).                                                      |

All actions start with `requireAdmin(await getServerSession())` — if a non-admin
ever calls them directly (curl / devtools), they throw before touching the DB.

## Default admin seed

`scripts/seed-admin.ts` runs from the container entrypoint:

1. Reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` (lowercase email). Exits silently if either is unset.
2. Counts users with `role = 'admin'`. If ≥ 1, no-op.
3. If an account with the seed email exists but isn't admin → refuses to
   overwrite. Promote it via `/admin/users` instead.
4. Otherwise: `internalAdapter.createUser({ role: "admin" })` + `linkAccount({
providerId: "credential", password: hashed })`. The hashing uses Better
   Auth's own `password.hash` so the credential is verified by the standard
   sign-in flow.

The script is idempotent. A second `docker compose up` produces:

```
[seed-admin] admin user already exists — no-op.
```

## Admin self-lockout recovery

If the only admin demotes / bans / deletes themselves through some path that
bypassed the guards (a manual `psql` poke, or a future code regression):

1. Open a `psql` shell against the running Postgres container:
   `docker exec -it <postgres-container> psql -U dictaphone -d dictaphone`.
2. Promote a user back:
   `UPDATE "user" SET role = 'admin', banned = false WHERE email = 'you@…';`
3. Restart the web container so the cookie cache is invalidated.

The seed script will _not_ repair this — it only acts when the users table has
zero admins.
