import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accessRequest } from "@/lib/db/schema/access-requests";

export type AccessRequestRow = typeof accessRequest.$inferSelect;
export type NewAccessRequest = typeof accessRequest.$inferInsert;

export async function listPending(): Promise<AccessRequestRow[]> {
  return db
    .select()
    .from(accessRequest)
    .where(eq(accessRequest.status, "pending"))
    .orderBy(desc(accessRequest.requestedAt));
}

export async function listAll(): Promise<AccessRequestRow[]> {
  return db.select().from(accessRequest).orderBy(desc(accessRequest.requestedAt));
}

export async function getById(id: string): Promise<AccessRequestRow | null> {
  const rows = await db.select().from(accessRequest).where(eq(accessRequest.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPendingByEmail(email: string): Promise<AccessRequestRow | null> {
  const rows = await db
    .select()
    .from(accessRequest)
    .where(and(eq(accessRequest.email, email), eq(accessRequest.status, "pending")))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertRequest(row: NewAccessRequest): Promise<AccessRequestRow | null> {
  // ON CONFLICT DO NOTHING on the partial unique index → returns empty array
  // when an identical pending row already exists, so callers can decide
  // whether to surface a "duplicate" signal (we choose not to, to avoid
  // leaking which emails are pending).
  const rows = await db.insert(accessRequest).values(row).onConflictDoNothing().returning();
  return rows[0] ?? null;
}

export async function markApproved(
  id: string,
  decidedBy: string,
): Promise<AccessRequestRow | null> {
  const rows = await db
    .update(accessRequest)
    .set({ status: "approved", decidedAt: new Date(), decidedBy })
    .where(and(eq(accessRequest.id, id), eq(accessRequest.status, "pending")))
    .returning();
  return rows[0] ?? null;
}

export async function markRejected(
  id: string,
  decidedBy: string,
  note: string | null,
): Promise<AccessRequestRow | null> {
  const rows = await db
    .update(accessRequest)
    .set({ status: "rejected", decidedAt: new Date(), decidedBy, note })
    .where(and(eq(accessRequest.id, id), eq(accessRequest.status, "pending")))
    .returning();
  return rows[0] ?? null;
}

export async function revertToPending(id: string): Promise<void> {
  // Used by the service when a downstream createUser call fails after the
  // row was marked approved — keeps the request retryable.
  await db
    .update(accessRequest)
    .set({ status: "pending", decidedAt: null, decidedBy: null })
    .where(eq(accessRequest.id, id));
}
