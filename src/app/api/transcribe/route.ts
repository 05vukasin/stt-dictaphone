import { getSttProvider, ProviderError } from "@/lib/providers";
import { getServerSession } from "@/lib/auth/session";
import { getEffectiveSettings } from "@/lib/settings/effective";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let effective;
  try {
    effective = await getEffectiveSettings(session.user.id);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Settings unavailable" },
      { status: 500 },
    );
  }

  const apiKey = effective.sttProvider === "openai" ? effective.openaiApiKey : effective.groqApiKey;
  if (!apiKey) {
    return Response.json(
      {
        error: `No API key configured for STT provider "${effective.sttProvider}". Ask your admin to set one in Admin → Groups → ${effective.groupName}.`,
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart/form-data body" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return Response.json({ error: "Missing 'audio' field" }, { status: 400 });
  }
  // Per-request overrides win when present; otherwise the resolved values
  // (group default or saved override) apply.
  const language =
    typeof form.get("language") === "string" && (form.get("language") as string).length > 0
      ? (form.get("language") as string)
      : effective.language;
  const prompt =
    typeof form.get("prompt") === "string" && (form.get("prompt") as string).length > 0
      ? (form.get("prompt") as string)
      : effective.sttPrompt || undefined;

  try {
    const provider = getSttProvider(effective.sttProvider);
    const result = await provider.transcribe({ audio, apiKey, language, prompt });
    return Response.json(result);
  } catch (err) {
    if (err instanceof ProviderError) {
      return Response.json({ error: err.message, provider: err.provider }, { status: err.status });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
