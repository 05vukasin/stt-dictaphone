# Recording

Everything related to capturing audio from the microphone.

## DictaphoneRecorder (`src/lib/recorder.ts`)

A class wrapping `MediaRecorder` with a tiny event API.

### Lifecycle

```
idle ──start()──▶ recording ──stop()──▶ stopping ──onstop──▶ idle (resolves Blob)
                       │
                    pause()
                       │
                       ▼
                     paused ──resume()──▶ recording
```

### Events

```ts
recorder.on("state", (s) => /* "idle" | "recording" | "paused" | "stopping" */)
recorder.on("durationMs", (ms) => /* 250ms tick while recording */)
recorder.on("level", (peak0to1) => /* per-frame peak amplitude */)
recorder.on("error", (err) => /* MediaRecorder error */)
```

`level` events power the small bar next to the timer. They come from a private
`AnalyserNode` attached to a copy of the stream — **not** the same analyser used
by `WaveCanvas`. Two analysers is intentional: the wave-canvas one lives in the
React component lifecycle and crossfades with the idle wave, while the recorder's
analyser is tied to recording state and gets torn down on `stop()`.

## Mime selection (`pickMimeType`)

Order of preference per `audioFormat`:

| Setting          | Tries (in order)                                                |
| ---------------- | --------------------------------------------------------------- |
| `webm` (default) | `audio/webm;codecs=opus`, `audio/webm`, `audio/ogg;codecs=opus` |
| `wav`            | `audio/wav`, `audio/x-wav`                                      |
| fallback         | `audio/mp4`, `audio/aac`                                        |

Safari historically can't record webm — it'll fall through to `mp4`/`aac`.

## Stream constraints

```ts
{ audio: { deviceId: micDeviceId || undefined,
           echoCancellation: true,
           noiseSuppression: true } }
```

Both echo-cancel and noise-suppression are on by default. They can be exposed to
settings later if dictation users want raw audio.

## Timeslice

`mediaRecorder.start(1000)` — 1-second chunks. Keeps memory low for very long
recordings; the assembled Blob is concatenated in `onstop`.

## Auto-save guarantee

`RecorderShell.toggle()` always calls `saveAndTranscribe()` immediately after
`stop()` returns, before navigating. So a user closing the tab between stop and
the transcription call won't lose audio — the blob is already in IDB.

## Permission errors

`navigator.mediaDevices.getUserMedia` rejects → caught in `toggle()`, surfaced as
an error toast ("Microphone blocked"). State stays `idle`.

## Chunking long recordings (future)

Whisper has a 25MB upload limit. For v1 we don't chunk — recordings over ~24min
of opus may fail. The plan in [ROADMAP.md](./ROADMAP.md) is to chunk at silence
boundaries (or fixed 60s windows) before upload and concatenate transcripts.
