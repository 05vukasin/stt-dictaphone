# Architecture

A high-level map of the codebase. Read this first if you're picking up the project cold.

## Auth boundary

A Better Auth + Postgres layer sits in front of the recorder. The browser still
owns recordings, transcripts, and settings; Postgres only holds users, sessions,
roles, and access requests. Detail in [`.claude/AUTH.md`](../.claude/AUTH.md);
schema in [`.claude/DATABASE.md`](../.claude/DATABASE.md); the per-user
namespacing that prevents same-browser data leakage is documented in
[`.claude/DECISIONS.md`](../.claude/DECISIONS.md) (entry 3).

```
   ┌─────────────────────────────┐
   │      Postgres (server)      │
   │  user, session, account,    │
   │  verification, jwks,        │
   │  access_request             │
   └────────────▲────────────────┘
                │ Drizzle / Better Auth
                │
   ┌────────────┴────────────────┐
   │   Next.js Route Handlers    │
   │   /api/auth/*, /api/...     │
   └────────────▲────────────────┘
                │ cookie: better-auth.session_token
                │
            (browser)
                │
       ┌────────┴────────┐
       │  proxy.ts gate  │
       └─────────────────┘
```

## System diagram

```
                          ┌──────────────────────────────────────┐
                          │             Browser (PWA)            │
                          │                                      │
   ┌────────────┐         │  ┌───────────────┐  ┌─────────────┐ │
   │ User mic   │ ──────▶ │  │ DictaphoneRec │  │ AnalyserNode│ │
   └────────────┘ Web API │  │  (recorder.ts)│──│ (audio-ctx) │ │
                          │  └───────┬───────┘  └──────┬──────┘ │
                          │          │ blob            │ amps   │
                          │          ▼                 ▼        │
                          │  ┌─────────────┐    ┌──────────────┐│
                          │  │  IndexedDB  │    │ wave-canvas  ││
                          │  │  recordings │    │  renderer    ││
                          │  └─────────────┘    └──────────────┘│
                          │          │                          │
                          │          ▼                          │
                          │  ┌────────────────────────────┐     │
                          │  │ transcription-service.ts   │     │
                          │  │  (orchestrates the calls)  │     │
                          │  └─────┬──────────────────────┘     │
                          │        │ POST /api/transcribe        │
                          │        │ POST /api/summarize         │
                          │        ▼                             │
                          │  ┌────────────────────────────┐     │
                          │  │ Next.js Route Handlers     │     │
                          │  │  (Node runtime)            │     │
                          │  └─────┬──────────────────────┘     │
                          │        │                            │
                          └────────┼────────────────────────────┘
                                   ▼
                       ┌─────────────────────────────────┐
                       │ OpenAI / Groq / Anthropic APIs  │
                       │   (user's key, never logged)    │
                       └─────────────────────────────────┘
```

## Module boundaries

```
src/
├── app/                     # Next.js routes
│   ├── layout.tsx           # PWA <head>, font, root providers
│   ├── providers.tsx        # next-themes, ToastStack, InstallPrompt, SW boot
│   ├── page.tsx             # Main: <RecorderShell />
│   ├── history/page.tsx     # <HistoryList />
│   ├── recording/[id]/page.tsx # <RecordingDetail />
│   ├── api/transcribe/route.ts
│   ├── api/summarize/route.ts
│   ├── api/health/route.ts
│   ├── globals.css          # design tokens (light + dark), keyframes
│   └── sw.ts                # Serwist service-worker entry
│
├── components/
│   ├── recorder/            # Record button, timer, level meter, wave canvas
│   ├── settings/            # Modal sections: appearance, providers, prompts, data, etc.
│   ├── history/             # History list + empty state
│   ├── recording/           # Per-recording detail UI (audio, transcript, summary, export)
│   ├── pwa/install-prompt.tsx
│   └── ui/                  # Modal, IconButton, Toast, Kbd
│
├── lib/
│   ├── recorder.ts          # MediaRecorder wrapper class
│   ├── audio-context.ts     # singleton AudioContext + AnalyserNode setup
│   ├── wave-renderer.ts     # PURE canvas drawing fns (idle + reactive)
│   ├── transcription-service.ts # Orchestrates: save → transcribe → optional summary
│   ├── api-client.ts        # fetch wrappers around /api/transcribe & /api/summarize
│   ├── providers/           # OpenAI, Groq, Anthropic provider impls
│   ├── storage/
│   │   ├── idb.ts           # opens the IDB database
│   │   ├── recordings-store.ts  # Blob CRUD
│   │   ├── settings-store.ts    # localStorage + zod schema, useSyncExternalStore hook
│   │   └── transcripts-store.ts # localStorage list + hooks
│   ├── format.ts            # mm:ss, bytes, relative time, default title
│   ├── id.ts                # ulid wrapper
│   └── use-toast.tsx        # module-level toast store
│
└── types/
    ├── recording.ts         # Transcript, RecordingBlob, Status enums
    └── settings.ts          # zod schema for the settings object
```

## State management strategy

**No state library**. We use **module-level stores + `useSyncExternalStore`**:

- `lib/use-toast.tsx`, `lib/storage/settings-store.ts`, `lib/storage/transcripts-store.ts` each maintain a private cache and a `Set<() => void>` of listeners. Components subscribe via a typed hook (`useToasts`, `useSettings`, `useTranscripts`).
- Why: React 18/19's blessed pattern, zero deps, SSR-safe (each store provides a `getServerSnapshot`). Same convention as the sister project `claw-ops-chat`.

## Data flow when you record

1. **Click record** → `RecorderShell.toggle()` constructs `DictaphoneRecorder`, calls `start()`.
2. Recorder asks for `getUserMedia` → emits `state: "recording"`, ticks `durationMs` every 250ms, emits `level` per requestAnimationFrame from its private analyser.
3. `<WaveCanvas>` reads `stream` and lazily attaches a SECOND analyser for the hybrid wave visualization (the in-recorder analyser is dedicated to the level meter).
4. **Click stop** → `stop()` returns the assembled `Blob`.
5. `transcription-service.saveAndTranscribe()`:
   - `putRecording({ id, blob, mime, createdAt })` to IndexedDB.
   - `upsertTranscript(initial)` with `status: "queued"` to localStorage.
   - Fires `runTranscription(id, blob)` in the background and routes the user to `/recording/[id]`.
6. `runTranscription` reads settings, calls `/api/transcribe` with provider header + key header + audio blob.
7. On success: `patchTranscript({ text, status: "done" })`. If `autoSummarize` is on, fires `runSummary(id)`.
8. `runSummary` calls `/api/summarize` with the transcript text → patches `summary`.

## SSR / hydration

- Storage hooks return `[]` / `DEFAULT_SETTINGS` on the server snapshot to avoid hydration mismatches.
- `<html suppressHydrationWarning>` is set because next-themes mutates `class` on the html element after mount.
- Mount-detection (theme selector, install prompt) uses `useSyncExternalStore` or `useState` lazy initializers — never `setState` inside `useEffect` (React 19 lints it).

## Build pipeline

- **Build uses Webpack, dev uses Turbopack**:
  - `npm run build` passes `--webpack` (and unsets `TURBOPACK=1`) so @serwist/next
    can hook into the webpack pipeline, inject the precache manifest into
    `src/app/sw.ts`, and emit `public/sw.js`.
  - `npm run dev` stays on Turbopack — the SW is intentionally `disable`d in
    dev anyway, and Turbopack handles Tailwind v4's `@import "tailwindcss"`
    natively. Forcing webpack in dev breaks Tailwind's CSS pipeline.
- **PWA**: `withSerwistInit({ swSrc, swDest, ... })` wraps the Next config.
  Disabled in dev so HMR isn't haunted by a cached worker.

## Where to add new things

| You want to                               | Touch this                                                                                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Support a new STT/summary provider        | `src/lib/providers/<name>.ts`, register in `src/lib/providers/index.ts`, extend `SttProviderSchema` / `SummaryProviderSchema` in `src/types/settings.ts` |
| Add a settings field                      | `src/types/settings.ts` (zod) → consume via `useSettings()` and `patchSettings()`                                                                        |
| Add a recording action (e.g. "Translate") | New section in `src/components/recording/`, optional new orchestrator in `src/lib/transcription-service.ts`                                              |
| Tweak waveform look                       | `src/lib/wave-renderer.ts` — pure functions, easy to unit-test                                                                                           |
| Change keyboard shortcuts                 | `src/components/recorder/recorder-shell.tsx` (`onKey`) and `src/components/settings/shortcuts-section.tsx` (display)                                     |
