# Settings

The settings panel is a single modal (`<SettingsOverlay>`) with these sections:

| Section            | Component               | Key responsibility                        |
| ------------------ | ----------------------- | ----------------------------------------- |
| Appearance         | `theme-selector.tsx`    | light / dark / system via next-themes     |
| Speech-to-Text     | `provider-section.tsx`  | STT provider + language hint              |
| Summary            | `provider-section.tsx`  | Summary provider + auto-summarize toggle  |
| API Keys           | `provider-section.tsx`  | Masked inputs for OpenAI, Groq, Anthropic |
| Prompts            | `prompt-section.tsx`    | STT prompt + summary system prompt        |
| Data               | `data-section.tsx`      | Storage usage, export/import, wipe        |
| Keyboard shortcuts | `shortcuts-section.tsx` | Read-only reference                       |
| About              | `about-section.tsx`     | Version + GitHub link                     |

## Schema

`src/types/settings.ts` defines a single zod schema:

```ts
const SettingsSchema = z.object({
  version: z.literal(1).default(1),
  sttProvider: z.enum(["openai", "groq"]).default("openai"),
  summaryProvider: z.enum(["openai", "anthropic", "groq"]).default("openai"),
  openaiApiKey: z.string().default(""),
  groqApiKey: z.string().default(""),
  anthropicApiKey: z.string().default(""),
  language: z.string().default("auto"),
  autoSummarize: z.boolean().default(true),
  audioFormat: z.enum(["webm", "wav"]).default("webm"),
  micDeviceId: z.string().default(""),
  sttPrompt: z.string().default(""),
  summaryPrompt: z.string().default(DEFAULT_SUMMARY_PROMPT),
});
```

Forward-compat: every field has a default, so adding a new field doesn't break
old saved state. Removing a field is a breaking change — bump `version` and
write a migration in `src/lib/storage/settings-store.ts`'s `load()` if/when
that happens.

## Hook usage

```tsx
import { useSettings, patchSettings } from "@/lib/storage/settings-store";

function MyComponent() {
  const settings = useSettings();
  return (
    <input
      value={settings.openaiApiKey}
      onChange={(e) => patchSettings({ openaiApiKey: e.target.value })}
    />
  );
}
```

`patchSettings` re-runs the zod parse on the merged object, so an invalid value
throws synchronously — caught here would expose UI mistakes early. In practice
all UI is wired to valid types, so it doesn't throw in the wild.

## Default summary prompt

```
You are an assistant that turns voice transcripts into structured Markdown
notes. Produce a concise note with: a one-line TL;DR, 3-7 key points as a
bulleted list, and an Action Items section if any concrete tasks were
mentioned. Keep it short and high-signal. Match the language of the transcript.
```

Editable in Settings → Prompts. A "Reset to default" link restores it.

## Export / import format

`Settings → Data → Export all` produces:

```json
{
  "settings": { ... full Settings object including API keys ... },
  "transcripts": [ ... ],
  "exportedAt": "2026-04-27T..."
}
```

Importing only restores `settings` (not transcripts) — see
[STORAGE.md](./STORAGE.md) for why.

`exportSettings(includeKeys = false)` strips API keys when called without
arguments. The default for the "Export all" button passes `true` because
it's expected the user keeps the JSON locally as a personal backup.
