# Database

Postgres 16. The schema only holds auth-related data — recordings, transcripts,
and settings stay device-local on purpose. Drizzle ORM owns the schema; Drizzle
Kit generates migrations from `src/lib/db/schema/*.ts`.

## Files

| Path                                   | What lives there                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/client.ts`                 | Lazy `postgres-js` singleton + `drizzle()` handle. `db` is a Proxy so importing it doesn't connect at module-eval time. |
| `src/lib/db/schema/auth.ts`            | Better Auth core tables + admin + jwt fields.                                                                           |
| `src/lib/db/schema/access-requests.ts` | `access_request` table with the partial unique index.                                                                   |
| `src/lib/db/schema/groups.ts`          | `settings_group` (admin-managed config) + `user_profile` (group membership + overrides).                                |
| `src/lib/db/schema/index.ts`           | Re-exports the schemas as one `schema` object for `drizzleAdapter({ schema })`.                                         |
| `drizzle.config.ts`                    | Drizzle Kit config. Points at the schema dir, writes to `./drizzle/`.                                                   |
| `drizzle/0000_init.sql`                | Initial migration (6 tables + 1 partial-unique index).                                                                  |
| `drizzle/0001_groups.sql`              | Groups migration (`settings_group`, `user_profile`, default-group partial-unique index).                                |
| `scripts/migrate.ts`                   | `tsx` entry point — calls `migrate(db, { migrationsFolder: "./drizzle" })`.                                             |
| `scripts/seed-admin.ts`                | Idempotent default-admin seeder using `auth.$context.internalAdapter`.                                                  |

## Workflow

| Action                                              | Command                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------ |
| Generate a migration from schema edits              | `npm run db:generate` (writes a new SQL file to `drizzle/`)        |
| Apply pending migrations                            | `npm run db:migrate` (reads `DATABASE_URL`)                        |
| Push schema without a migration file (dev only)     | `npm run db:push`                                                  |
| Inspect data                                        | `npm run db:studio`                                                |
| Sanity-check schema vs Better Auth's expected shape | `npm run auth:generate` then diff with `src/lib/db/schema/auth.ts` |
| Seed the default admin                              | `npm run seed:admin` (skipped when an admin already exists)        |

Tables created by the first migration:

```
access_request   id, email, reason, status, requested_at, decided_at, decided_by, note
                 partial unique index: (email) WHERE status = 'pending'
account          id, user_id (→ user.id ON DELETE CASCADE), provider_id, account_id, password, ...
jwks             id, public_key, private_key, created_at
session          id, user_id (→ user.id ON DELETE CASCADE), token (unique), expires_at, ...
user             id, email (unique), name, role, banned, ban_reason, ban_expires, ...
verification     id, identifier, value, expires_at, ...
```

## Migration application on boot

`docker/entrypoint.sh` runs `tsx scripts/migrate.ts` before `next start`. The
migrate script opens a one-shot Postgres connection (`max: 1, prepare: false`)
and calls `drizzle-orm/postgres-js/migrator.migrate`. Repeated runs are no-ops
once all SQL files have been applied (Drizzle tracks them in
`__drizzle_migrations`).

After migrations run, the entrypoint invokes `tsx scripts/seed-admin.ts` with
`NODE_OPTIONS="--conditions=react-server"` — needed because the auth server
module imports `server-only`, which throws under the default condition.

## Schema evolution

1. Edit `src/lib/db/schema/{auth,access-requests}.ts`.
2. `npm run db:generate` — review the diff that Drizzle Kit writes to a new
   `drizzle/00NN_*.sql` file. Drizzle Kit is occasionally too eager
   (renames/destructive moves); read it before committing.
3. Apply locally: `DATABASE_URL=… npm run db:migrate`.
4. Commit the migration alongside the schema change.
5. On deploy, the entrypoint runs the migration. Down-migrations are not
   automated — write them by hand if you need rollback.

## Vitest + `postgres-js`

`postgres-js` is Node-only. The vitest jsdom environment can't import it. The
client module is therefore mocked at the import boundary
(`vi.mock("postgres", ...)` in `src/lib/db/client.test.ts`). DB-touching tests
(`access-requests/queries.test.ts`, `service.test.ts`) mock at the query
helpers, not at the SQL level.

A real-DB integration test against `testcontainers` would be gated behind
`INTEGRATION=1` — not built yet. The closest live verification is the
`docker compose up` smoke (`.claude/DOCKER.md`).
