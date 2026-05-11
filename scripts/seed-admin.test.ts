import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { contextMock, dbMock, flags } = vi.hoisted(() => {
  const ctx = {
    internalAdapter: {
      countTotalUsers: vi.fn(),
      findUserByEmail: vi.fn(),
      createUser: vi.fn(),
      linkAccount: vi.fn(),
      listUsers: vi.fn(),
    },
    password: { hash: vi.fn() },
  };
  const f = { defaultGroupExists: false, profileExists: false };
  // Minimal drizzle-style chained builders. We don't validate every link —
  // just resolve the terminal `.limit(1)` to an array shaped like the real
  // result. Inserts are no-ops the test counts via `dbMock.insert`.
  const select = vi.fn((spec: Record<string, unknown>) => {
    // Discriminate by the shape of the select() projection.
    // ensureDefaultGroup selects { id }, ensureAdminProfile selects { userId }.
    const keys = Object.keys(spec ?? {});
    const isGroupQuery = keys.includes("id");
    const isProfileQuery = keys.includes("userId");
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => {
            if (isGroupQuery && f.defaultGroupExists) {
              return Promise.resolve([{ id: "g1" }]);
            }
            if (isProfileQuery && f.profileExists) {
              return Promise.resolve([{ userId: "u-existing" }]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
    };
  });
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => Promise.resolve()),
      then: (r: (v: unknown) => unknown) => Promise.resolve(undefined).then(r),
    })),
  }));
  return { contextMock: ctx, dbMock: { select, insert }, flags: f };
});

vi.mock("../src/lib/auth/server", () => ({
  auth: { $context: Promise.resolve(contextMock) },
}));

vi.mock("../src/lib/db/client", () => ({ db: dbMock }));

import { seedAdmin } from "./seed-admin";

beforeEach(() => {
  for (const fn of Object.values(contextMock.internalAdapter))
    (fn as ReturnType<typeof vi.fn>).mockReset();
  contextMock.password.hash.mockReset();
  contextMock.password.hash.mockResolvedValue("hashed");
  contextMock.internalAdapter.countTotalUsers.mockResolvedValue(0);
  contextMock.internalAdapter.findUserByEmail.mockResolvedValue(null);
  contextMock.internalAdapter.createUser.mockResolvedValue({ id: "u1" });
  contextMock.internalAdapter.linkAccount.mockResolvedValue({});
  contextMock.internalAdapter.listUsers.mockResolvedValue([]);
  dbMock.select.mockClear();
  dbMock.insert.mockClear();
  flags.defaultGroupExists = false;
  flags.profileExists = false;
  process.env.ADMIN_EMAIL = "Admin@Dictaphone.Test";
  process.env.ADMIN_PASSWORD = "p4ssw0rd-test";
});

afterEach(() => {
  delete process.env.ADMIN_EMAIL;
  delete process.env.ADMIN_PASSWORD;
});

describe("seedAdmin", () => {
  it("creates admin + default group + admin profile on a fresh DB", async () => {
    const r = await seedAdmin();
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/created admin user admin@dictaphone\.test/);
    expect(contextMock.internalAdapter.createUser).toHaveBeenCalledOnce();
    // 1× insert(settings_group), 1× insert(user_profile) for the new admin.
    expect(dbMock.insert).toHaveBeenCalledTimes(2);
  });

  it("is a no-op when an admin already exists, but still ensures default group + admin profile", async () => {
    contextMock.internalAdapter.countTotalUsers.mockResolvedValue(1);
    contextMock.internalAdapter.listUsers.mockResolvedValue([{ id: "admin-existing" }]);
    const r = await seedAdmin();
    expect(r.reason).toMatch(/already exists/);
    expect(contextMock.internalAdapter.createUser).not.toHaveBeenCalled();
    // settings_group insert + user_profile insert for the admin.
    expect(dbMock.insert).toHaveBeenCalledTimes(2);
  });

  it("seeds the default group even when ADMIN_EMAIL is missing", async () => {
    delete process.env.ADMIN_EMAIL;
    const r = await seedAdmin();
    expect(r.reason).toMatch(/not set/);
    expect(contextMock.internalAdapter.countTotalUsers).not.toHaveBeenCalled();
    expect(dbMock.insert).toHaveBeenCalledTimes(1); // just the default group
  });

  it("refuses to overwrite an existing non-admin user with the seed email", async () => {
    contextMock.internalAdapter.findUserByEmail.mockResolvedValue({
      user: { id: "u9", role: "user" },
      accounts: [],
    });
    const r = await seedAdmin();
    expect(r.reason).toMatch(/refusing to overwrite/);
    expect(contextMock.internalAdapter.createUser).not.toHaveBeenCalled();
  });

  it("does not re-create the default group or admin profile when both exist", async () => {
    flags.defaultGroupExists = true;
    flags.profileExists = true;
    contextMock.internalAdapter.countTotalUsers.mockResolvedValue(1);
    contextMock.internalAdapter.listUsers.mockResolvedValue([{ id: "admin-existing" }]);
    const r = await seedAdmin();
    expect(r.ok).toBe(true);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});
