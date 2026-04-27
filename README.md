# STT Dictaphone

A minimal, professional speech-to-text dictaphone — installable PWA, multi-provider AI, all data stored locally.

- **Hybrid sound-wave visualization** — calm decorative idle loop, mic-reactive while recording.
- **Whisper transcription** via OpenAI or Groq (much faster).
- **Auto-summary** via OpenAI GPT, Anthropic Claude, or Groq Llama.
- **Local-first** — recordings live in IndexedDB, settings + transcripts in localStorage. Nothing leaves your device except the audio you send to your chosen provider.
- **Duotone UI** — dark grey + dirty white only, light/dark themed via `next-themes`.
- **Installable PWA** — works offline (transcription queues until you're back online), with native install prompt.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To make it actually transcribe, open Settings → API Keys and paste at least one:

- **OpenAI** (`sk-...`) — covers both transcription (Whisper) and summary (GPT-4o-mini).
- **Groq** (`gsk_...`) — fastest Whisper, Llama 3.3 70B for summary.
- **Anthropic** (`sk-ant-...`) — Claude Sonnet 4.5 for summary only.

Keys are stored in `localStorage` on this device. The Next.js API routes proxy each call to the chosen provider (so the key never leaves your machine via a direct browser CORS call).

## Scripts

| Script               | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `npm run dev`        | Dev server (webpack — required for service-worker generation) |
| `npm run build`      | Production build                                              |
| `npm start`          | Start the production build                                    |
| `npm test`           | Run the Vitest suite once                                     |
| `npm run test:watch` | Re-run tests on file change                                   |
| `npm run lint`       | ESLint                                                        |
| `npm run typecheck`  | `tsc --noEmit`                                                |
| `npm run format`     | Format with Prettier                                          |
| `npm run icons`      | Regenerate PWA icons                                          |

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript strict
- Tailwind v4 (inline `@theme` in `src/app/globals.css`)
- next-themes · react-icons · zod · ulid · idb
- @serwist/next for PWA service worker
- Vitest + @testing-library/react + fake-indexeddb

## Architecture

Detailed architecture docs live in [`docs/`](./docs):

- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — system overview
- [RECORDING.md](./docs/RECORDING.md) — MediaRecorder, formats, level meter
- [WAVE-VISUALIZATION.md](./docs/WAVE-VISUALIZATION.md) — hybrid canvas waves
- [STORAGE.md](./docs/STORAGE.md) — IndexedDB + localStorage schemas
- [AI-PROVIDERS.md](./docs/AI-PROVIDERS.md) — provider abstraction & adding new ones
- [SETTINGS.md](./docs/SETTINGS.md) — settings shape & export/import format
- [PWA.md](./docs/PWA.md) — manifest, service worker, install prompt
- [TESTING.md](./docs/TESTING.md) — what's tested and how
- [ROADMAP.md](./docs/ROADMAP.md) — ideas for v2

## Privacy

- No analytics, telemetry, or accounts.
- Audio blobs never leave IndexedDB on this device.
- Transcript text + settings are in localStorage.
- API calls go to **only** the providers whose keys you've entered, via the local Next.js API route which never logs the key.
- "Wipe all data" in Settings → Data clears everything.

## License

MIT — see [LICENSE](./LICENSE).
