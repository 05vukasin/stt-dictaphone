// Inserts a hyphen every 4 chars so the admin can read a temp password back
// over voice without losing place: ABCD-EFGH-JKMN-PQRS. Lives in a separate
// file from generateTempPassword so the formatter (pure, client-safe) is not
// dragged into a server-only bundle by association.
export function formatForDisplay(pw: string): string {
  return pw.match(/.{1,4}/g)?.join("-") ?? pw;
}
