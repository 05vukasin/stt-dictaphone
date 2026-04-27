# Roadmap

Things deliberately not in v1, ordered by likely value.

## High value

- **Long-recording chunking** — split blobs > 24MB at silence boundaries before
  upload, concatenate transcripts. Avoids Whisper's hard limit.
- **Offline transcription queue** — when the network call fails, keep the
  transcript in `queued` status and retry on next `online` event. Service
  worker `sync` API can drive this.
- **Pause / resume in the UI** — the recorder already supports pause; we just
  need a button. v1 shows a single button to keep the surface minimal.
- **Cost preview** — show "~$0.006 for 1 min audio" before each call so users
  understand spend.
- **Recording detail: edit transcript** — let users hand-correct Whisper's
  output. Auto-resummarize after edits.
- **Multiple summary outputs** — keep a small history of summary attempts so
  users can A/B different prompts.

## Medium value

- **Speaker diarization** — Whisper doesn't do it natively; we'd need a
  separate provider (e.g. AssemblyAI) or run a small client-side model.
- **Search highlighting** — current History search is "contains" filter only.
  Highlight matches inline.
- **Tags / folders for recordings** — once the list grows past ~50 items.
- **Command palette** — ⌘K to navigate, run actions, jump to recordings.
- **Custom shortcuts** — let users rebind keys.
- **Per-recording prompt overrides** — a small "Use custom prompt for this
  recording" affordance on the detail page.

## Smaller polish

- **Drag-and-drop file import** — drop a .webm/.mp3 into the page and treat it
  as a recording (transcribe + summarize).
- **Apple touch startup images** — for that iOS-app feel during launch.
- **High-contrast mode** for the duotone palette.
- **Optional cloud sync** — encrypted, user-owned, opt-in. Probably a separate
  product.

## Things that are NOT planned

- Account system / login.
- Server-side storage of audio.
- Built-in API key proxying through someone else's keys.
- Mobile app (the PWA covers this for most users).
