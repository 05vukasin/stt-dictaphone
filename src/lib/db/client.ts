import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

type Client = ReturnType<typeof postgres>;

let client: Client | null = null;
let _db: Database | null = null;

function readUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. The app cannot reach Postgres. See .env.example.");
  }
  return url;
}

export function getDb(): Database {
  if (_db) return _db;
  client = postgres(readUrl(), { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

// Lazy proxy so importing `db` doesn't connect at module-evaluation time —
// matters for the vitest jsdom environment where we mock the module.
export const db = new Proxy({} as Database, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

// Test-only: drop the cached client + db so a fresh DATABASE_URL or mocked
// `postgres` import can take over between tests.
export async function __resetDbForTests() {
  if (client) {
    try {
      await client.end({ timeout: 1 });
    } catch {
      // ignore
    }
  }
  client = null;
  _db = null;
}
