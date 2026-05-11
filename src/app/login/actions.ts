"use server";

import { submitRequest, type SubmitResult } from "@/lib/access-requests/service";

export async function requestAccess(
  _prev: SubmitResult | null,
  form: FormData,
): Promise<SubmitResult> {
  const email = form.get("email");
  const reason = form.get("reason");
  return submitRequest({
    email: typeof email === "string" ? email : "",
    reason: typeof reason === "string" ? reason : "",
  });
}
