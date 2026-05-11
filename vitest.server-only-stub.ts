// Stand-in for the `server-only` package during vitest runs. The real package
// throws at import time when it detects a non-RSC environment; we want
// server-side modules to be importable from tests without that guard tripping.
export {};
