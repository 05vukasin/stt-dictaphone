import "server-only";
import { randomBytes } from "node:crypto";

// 32 char alphabet (Crockford base32, no I/L/O/U → no look-alikes).
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const DEFAULT_LENGTH = 16;

// Generates a one-time password the admin shows once after approving an
// access request. 16 chars × ~5 bits ≈ 80 bits of entropy — well above the
// 60 bits typically considered "strong" for a credential that is shown once
// and rotated by the user on first login.
export function generateTempPassword(length = DEFAULT_LENGTH): string {
  if (length < 8) throw new Error("temp password length must be ≥ 8");
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
