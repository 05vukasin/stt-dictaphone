import { getSummaryProvider, ProviderError } from "@/lib/providers";
import { getServerSession } from "@/lib/auth/session";
import { getEffectiveSettings } from "@/lib/settings/effective";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  text?: string;
  prompt?: string;
  model?: string;
}

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

  const apiKey =
    effective.summaryProvider === "openai"
      ? effective.openaiApiKey
      : effective.summaryProvider === "groq"
        ? effective.groqApiKey
        : effective.anthropicApiKey;
  if (!apiKey) {
    return Response.json(
      {
        error: `No API key configured for summary provider "${effective.summaryProvider}". Ask your admin to set one in Admin → Groups → ${effective.groupName}.`,
      },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }

  if (!body.text) {
    return Response.json({ error: "Missing 'text'" }, { status: 400 });
  }
  // Per-request prompt override wins; otherwise the resolved summaryPrompt
  // (which is already group-default or user-override per the resolver).
  const prompt = body.prompt && body.prompt.length > 0 ? body.prompt : effective.summaryPrompt;

  try {
    const provider = getSummaryProvider(effective.summaryProvider);
    const result = await provider.summarize({
      text: body.text,
      apiKey,
      prompt,
      model: body.model,
    });
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
