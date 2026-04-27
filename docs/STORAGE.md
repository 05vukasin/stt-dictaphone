# Storage

All user data lives in the browser. Nothing syncs.

## Why two stores

- **IndexedDB** — for audio blobs (kilobytes to megabytes per recording).
  Built for binary; localStorage tops out around 5MB total per origin.
- **localStorage** — for settings and transcript metadata (small JSON, fast
  synchronous reads, easy `useSyncExternalStore` integration).

## IndexedDB: `stt-dictaphone`

| Property     | Value                        |
| ------------ | ---------------------------- |
| DB name      | `stt-dictaphone`             |
| Version      | 1                            |
| Object store | `recordings` (keyPath: `id`) |
| Indexes      | `by-createdAt`               |

```ts
interface RecordingBlob {
  id: string; // ulid
  blob: Blob; // raw audio
  mime: string; // e.g. "audio/webm;codecs=opus"
  createdAt: number; // ms
}
```

API in `src/lib/storage/recordings-store.ts`:

- `putRecording(rec)`
- `getRecording(id)`
- `deleteRecording(id)`
- `listRecordingIds()`
- `clearAllRecordings()`
- `getStorageEstimate()` — wraps `navigator.storage.estimate()`

Tests use `fake-indexeddb` (loaded in `vitest.setup.ts`).

## localStorage keys

| Key                          | Schema                                   | Validated by                         |
| ---------------------------- | ---------------------------------------- | ------------------------------------ |
| `stt-dict:settings:v1`       | `Settings` (see `src/types/settings.ts`) | zod (`SettingsSchema.parse`)         |
| `stt-dict:transcripts:v1`    | `Transcript[]`                           | shape-checked via TS at the boundary |
| `stt-dict:install-dismissed` | `"1"`                                    | `null` vs not-null                   |

### Settings

```ts
interface Settings {
  version: 1;
  sttProvider: "openai" | "groq";
  summaryProvider: "openai" | "anthropic" | "groq";
  openaiApiKey: string;
  groqApiKey: string;
  anthropicApiKey: string;
  language: string; // "auto" or ISO code
  autoSummarize: boolean;
  audioFormat: "webm" | "wav";
  micDeviceId: string; // empty = system default
  sttPrompt: string;
  summaryPrompt: string;
}
```

If the stored JSON fails the zod schema (forward-incompatible upgrade,
corruption, version bump) the store falls back to `DEFAULT_SETTINGS`. The
`version` field is reserved for future migrations.

### Transcripts

```ts
interface Transcript {
  id: string; // matches IDB recording id
  title: string;
  text: string;
  language?: string;
  durationMs: number;
  sizeBytes: number;
  mime: string;
  createdAt: number;
  status: "idle" | "queued" | "transcribing" | "done" | "error";
  errorMessage?: string;
  summary?: string;
  summaryStatus: "idle" | "queued" | "summarizing" | "done" | "error";
  summaryError?: string;
}
```

The list is kept newest-first by `upsertTranscript`. If localStorage hits its
quota during save, the store trims the oldest 20% and retries; if it still
fails, it gives up silently (transcripts in memory remain valid for the session).

## Hooks

`useSettings()`, `useTranscripts()`, `useTranscript(id)` are
`useSyncExternalStore` wrappers. Each sets up a one-time `storage` event
listener so cross-tab updates propagate.

## Backup format

`Settings → Data → Export all` writes a JSON file:

```json
{
  "settings": { ... full settings, including API keys ... },
  "transcripts": [ ... ],
  "exportedAt": "2026-04-27T20:34:00.000Z"
}
```

Audio blobs are **not** included. Re-importing restores settings; re-importing
transcripts is not yet wired (transcripts without their audio blobs are weird).
See [ROADMAP.md](./ROADMAP.md).

## Wiping

`clearAllRecordings()` (IDB) + `clearAllTranscripts()` (localStorage) are
called together by the "Wipe all data" button in Settings → Data.
