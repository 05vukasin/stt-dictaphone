import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Access requests submitted from the public /login (Request Access tab).
// One pending row per email is guaranteed by the partial unique index, which
// also acts as a natural rate-limit and a guard against double-approve races.

export const accessRequest = pgTable(
  "access_request",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("pending"),
    requestedAt: timestamp("requested_at").notNull().defaultNow(),
    decidedAt: timestamp("decided_at"),
    decidedBy: text("decided_by"),
    note: text("note"),
  },
  (t) => ({
    pendingEmailUnique: uniqueIndex("access_request_pending_email_idx")
      .on(t.email)
      .where(sql`${t.status} = 'pending'`),
  }),
);

export type AccessRequestStatus = "pending" | "approved" | "rejected";
