import { getSttProvider, ProviderError } from "@/lib/providers";
import { SttProviderSchema } from "@/types/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey) {
    return Response.json({ error: "Missing API key" }, { status: 400 });
  }
  const providerName = req.headers.get("x-stt-provider") ?? "openai";
  const parsedProvider = SttProviderSchema.safeParse(providerName);
  if (!parsedProvider.success) {
    return Response.json({ error: `Unknown STT provider: ${providerName}` }, { status: 400 });
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
  const language = (form.get("language") as string | null) ?? undefined;
  const prompt = (form.get("prompt") as string | null) ?? undefined;

  try {
    const provider = getSttProvider(parsedProvider.data);
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
