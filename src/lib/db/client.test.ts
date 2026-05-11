import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { postgresMock, endMock, drizzleMock } = vi.hoisted(() => {
  const end = vi.fn(() => Promise.resolve());
  const pg = vi.fn(() => {
    const fn = () => undefined;
    Object.assign(fn, { end, parsers: {}, types: {}, options: {} });
    return fn;
  });
  const drizzle = vi.fn(() => ({ query: {}, __drizzle: true }));
  return { postgresMock: pg, endMock: end, drizzleMock: drizzle };
});

vi.mock("postgres", () => ({ default: postgresMock }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }));

import { __resetDbForTests, db, getDb } from "./client";

describe("db/client", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    endMock.mockClear();
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
  });

  afterEach(async () => {
    await __resetDbForTests();
    delete process.env.DATABASE_URL;
  });

  it("creates the client lazily and reuses it across calls", () => {
    const a = getDb();
    const b = getDb();
    expect(a).toBe(b);
    expect(postgresMock).toHaveBeenCalledTimes(1);
    expect(postgresMock).toHaveBeenCalledWith(
      "postgres://test:test@localhost:5432/test",
      expect.objectContaining({ prepare: false }),
    );
  });

  it("proxies property access through the lazy db handle", () => {
    expect(typeof (db as unknown as { query: unknown }).query).toBe("object");
    expect(postgresMock).toHaveBeenCalledTimes(1);
  });

  it("throws when DATABASE_URL is missing", () => {
    delete process.env.DATABASE_URL;
    expect(() => getDb()).toThrow(/DATABASE_URL is not set/);
  });

  it("__resetDbForTests calls client.end and clears the cache", async () => {
    getDb();
    await __resetDbForTests();
    expect(endMock).toHaveBeenCalledTimes(1);
    getDb();
    expect(postgresMock).toHaveBeenCalledTimes(2);
  });
});
