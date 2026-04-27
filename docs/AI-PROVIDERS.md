# AI Providers

Two contracts, three providers, one registry.

## Contracts

`src/lib/providers/types.ts`:

```ts
interface SttProviderImpl {
  name: SttProvider;
  transcribe(req: SttRequest): Promise<SttResponse>;
}

interface SummaryProviderImpl {
  name: SummaryProvider;
  summarize(req: SummaryRequest): Promise<SummaryResponse>;
}

class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  );
}
```

## Providers shipped in v1

| Provider                                     | STT                 | Summary                    | Default model |
| -------------------------------------------- | ------------------- | -------------------------- | ------------- |
| OpenAI (`src/lib/providers/openai.ts`)       | ✅ Whisper-1        | ✅ GPT-4o-mini             | both          |
| Groq (`src/lib/providers/groq.ts`)           | ✅ whisper-large-v3 | ✅ llama-3.3-70b-versatile | both          |
| Anthropic (`src/lib/providers/anthropic.ts`) | ❌                  | ✅ claude-sonnet-4-5       | summary       |

Selection is per-call via the `x-stt-provider` / `x-summary-provider` request
headers, looked up in `STT_PROVIDERS` / `SUMMARY_PROVIDERS` records in
`src/lib/providers/index.ts`.

## Where the secrets live

API keys never go to a server we control:

1. User pastes them into Settings → API Keys; stored in localStorage.
2. The browser-side `lib/api-client.ts` wrappers send them as the
   `x-api-key` header to the local Next.js Route Handler (`/api/transcribe`,
   `/api/summarize`).
3. The route handler reads `req.headers.get("x-api-key")`, forwards to the
   provider, and throws everything else away. **The header is never logged**.

This pattern means:

- The user's key only leaves their machine on calls TO the chosen provider's
  domain (e.g. `api.openai.com`), not to anywhere else.
- We don't need to deal with browser CORS quirks for each provider individually
  (some providers don't allow direct browser calls; the route handler bypasses
  that cleanly).

## Adding a new provider

1. Implement either or both of `SttProviderImpl`/`SummaryProviderImpl` in a new
   file under `src/lib/providers/`.
2. Add the name to the relevant zod enum in `src/types/settings.ts`
   (`SttProviderSchema` / `SummaryProviderSchema`).
3. Register it in `STT_PROVIDERS` / `SUMMARY_PROVIDERS` in
   `src/lib/providers/index.ts`.
4. Add a key field to `Settings` (e.g. `myProviderApiKey`) and surface it in
   `src/components/settings/provider-section.tsx`.
5. Wire key resolution in `src/lib/transcription-service.ts` (the small
   `apiKey = ...switch...` blocks).
6. Add a unit test under `src/lib/providers/<name>.test.ts` mocking `fetch`.

## Cost ballpark (rough, as of 2026-04)

| Operation         | Provider           | Approx. cost |
| ----------------- | ------------------ | ------------ |
| 1 minute audio    | OpenAI Whisper     | ~$0.006      |
| 1 minute audio    | Groq Whisper       | ~$0.0001     |
| 500-token summary | OpenAI GPT-4o-mini | ~$0.0002     |
| 500-token summary | Anthropic Sonnet   | ~$0.005      |
| 500-token summary | Groq Llama 3.3 70B | ~$0.0003     |

Always check current pricing at the provider before relying on these.

## Error handling

Provider modules wrap `!res.ok` into `ProviderError(provider, status, body)`.
The Route Handlers re-emit the status verbatim — so a 401 from OpenAI surfaces
to the client as an HTTP 401 with `{ error: "...", provider: "openai" }`. The
`api-client.ts` wrapper extracts the error string and throws it; the
`transcription-service.ts` orchestrator catches and surfaces a toast.
