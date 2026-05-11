"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  approveRequest,
  rejectRequest,
  type ApproveResult,
  type RejectResult,
} from "@/lib/access-requests/service";
import { requireAdmin } from "@/lib/auth/roles";
import { getServerSession } from "@/lib/auth/session";

export async function approve(id: string): Promise<ApproveResult> {
  const session = requireAdmin(await getServerSession());
  const result = await approveRequest(id, session.user.id, await headers());
  if (result.ok) revalidatePath("/admin/requests");
  return result;
}

export async function reject(id: string, note: string | null): Promise<RejectResult> {
  const session = requireAdmin(await getServerSession());
  const result = await rejectRequest(id, session.user.id, note);
  if (result.ok) revalidatePath("/admin/requests");
  return result;
}
