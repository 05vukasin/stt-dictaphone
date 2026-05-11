import "server-only";
import { z } from "zod";
import { newId } from "@/lib/id";
import { auth } from "@/lib/auth/server";
import { generateTempPassword } from "./temp-password";
import {
  insertRequest,
  markApproved,
  markRejected,
  revertToPending,
  type AccessRequestRow,
} from "./queries";

export const submitSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  reason: z.string().trim().max(500).optional().default(""),
});

export type SubmitInput = z.infer<typeof submitSchema>;

export type SubmitResult = { ok: true } | { ok: false; error: string };
export type ApproveResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; error: string };
export type RejectResult = { ok: true } | { ok: false; error: string };

export async function submitRequest(input: unknown): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // Insert with ON CONFLICT DO NOTHING; a duplicate pending row is a silent
  // no-op so callers cannot probe for known emails.
  await insertRequest({
    id: newId(),
    email: parsed.data.email,
    reason: parsed.data.reason,
    status: "pending",
  });
  return { ok: true };
}

export async function approveRequest(
  id: string,
  adminUserId: string,
  requestHeaders: Headers,
): Promise<ApproveResult> {
  const approved = await markApproved(id, adminUserId);
  if (!approved) {
    return { ok: false, error: "Request not found or already decided" };
  }
  const tempPassword = generateTempPassword();
  let createdUserId: string | null = null;
  try {
    const created = await auth.api.createUser({
      body: {
        email: approved.email,
        password: tempPassword,
        name: approved.email,
        role: "user",
      },
      headers: requestHeaders,
    });
    createdUserId = (created as { user?: { id?: string } }).user?.id ?? null;
  } catch (err) {
    // Roll the decision back so the admin can retry without orphaning the row.
    await revertToPending(id);
    const message = err instanceof Error ? err.message : "Failed to create user";
    return { ok: false, error: message };
  }
  // Force the user through the change-password flow on their first sign-in.
  // The createUser endpoint does not accept additional fields, so we set
  // this directly via the internal adapter after creation.
  if (createdUserId) {
    try {
      const ctx = await auth.$context;
      await ctx.internalAdapter.updateUser(createdUserId, { mustChangePassword: true });
    } catch {
      // Best-effort: if the flag fails to set, the temp password still
      // works for sign-in but the forced-change gate won't fire. The
      // explicit change-password option in the account dropdown remains.
    }
  }
  return { ok: true, email: approved.email, tempPassword };
}

export async function rejectRequest(
  id: string,
  adminUserId: string,
  note: string | null,
): Promise<RejectResult> {
  const rejected = await markRejected(id, adminUserId, note);
  if (!rejected) {
    return { ok: false, error: "Request not found or already decided" };
  }
  return { ok: true };
}

export type { AccessRequestRow };
