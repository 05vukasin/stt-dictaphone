import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, jwt } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

export const SESSION_COOKIE_NAME = "better-auth.session_token";

// `next build`'s "Collecting page data" phase evaluates every route's module
// graph just to introspect their config. The values it reads are not baked
// into the runtime bundle, so we can hand back a placeholder during build.
// At runtime (`next start` or a route hit), we require the real secret.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function readSecret(): string {
  const v = process.env.BETTER_AUTH_SECRET;
  if (!v || v.length < 16) {
    if (IS_BUILD) {
      return "BUILD_TIME_PLACEHOLDER_SECRET_NOT_USED_AT_RUNTIME";
    }
    throw new Error("BETTER_AUTH_SECRET must be set to a strong random value (≥16 chars).");
  }
  return v;
}

export const auth = betterAuth({
  secret: readSecret(),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true, autoSignIn: false },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  advanced: {
    cookies: { session_token: { name: SESSION_COOKIE_NAME } },
  },
  user: {
    additionalFields: {
      // Registered with Better Auth so the field flows through
      // `auth.api.getSession()` and the cookie cache. `input: false` blocks
      // the public signup path from setting it; trusted server code uses
      // `internalAdapter.updateUser`.
      mustChangePassword: {
        type: "boolean",
        input: false,
        defaultValue: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) => {
          // ctx === null means the call originated outside an HTTP endpoint —
          // i.e. trusted server code (the seed script, or a future migration
          // helper). Allow it: only public HTTP signups must be gated.
          if (ctx === null) return { data: user };
          // Admin-initiated creates bypass the gate (the /admin/users
          // approve flow calls auth.api.createUser with the admin's session).
          if (ctx.context.session?.user.role === "admin") {
            return { data: user };
          }
          const approved = await db
            .select({ id: schema.accessRequest.id })
            .from(schema.accessRequest)
            .where(
              and(
                eq(schema.accessRequest.email, user.email),
                eq(schema.accessRequest.status, "approved"),
              ),
            )
            .limit(1);
          if (approved.length === 0) {
            return false;
          }
          return { data: user };
        },
        after: async (user) => {
          // Enrol every newly-created user in the default settings group.
          // Imported dynamically so this module doesn't pull the settings
          // resolver in at evaluation time (avoids a build-time cycle).
          const { ensureUserProfile } = await import("@/lib/settings/effective");
          await ensureUserProfile(user.id);
        },
      },
    },
  },
  plugins: [
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    jwt(),
    // nextCookies() must be last in the chain.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
