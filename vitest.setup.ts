import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Some tests transitively import `@/lib/auth/server`, which validates
// BETTER_AUTH_SECRET at module load. Production callers always have it set
// via env; tests stub it here so the module evaluates cleanly. Real auth
// behaviour is mocked at the boundary in the tests that exercise it.
process.env.BETTER_AUTH_SECRET ??= "test-only-fake-secret-32-bytes-long-x";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";

// Node 25 ships a built-in localStorage global that shadows jsdom's and has no
// methods unless --localstorage-file is set. Install an in-memory Storage stub.
if (typeof window !== "undefined") {
  const makeStorage = () => {
    const store = new Map<string, string>();
    return {
      get length() {
        return store.size;
      },
      key(i: number) {
        return Array.from(store.keys())[i] ?? null;
      },
      getItem(k: string) {
        return store.has(k) ? store.get(k)! : null;
      },
      setItem(k: string, v: string) {
        store.set(k, String(v));
      },
      removeItem(k: string) {
        store.delete(k);
      },
      clear() {
        store.clear();
      },
    } as Storage;
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: makeStorage(),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    writable: true,
    value: makeStorage(),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (typeof window !== "undefined") {
    window.localStorage.clear();
    window.sessionStorage.clear();
  }
});

// jsdom doesn't implement matchMedia
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom doesn't implement ResizeObserver
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = ResizeObserverStub;
}
