import { monotonicFactory } from "ulid";

// monotonicFactory guarantees that two calls within the same millisecond
// produce strictly increasing ids — required so transcript ordering and
// access-request rows sort by creation without timestamp ties.
const next = monotonicFactory();

export function newId(): string {
  return next();
}
