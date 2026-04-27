import { getSummaryProvider, ProviderError } from "@/lib/providers";
import { SummaryProviderSchema } from "@/types/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  text?: string;
  prompt?: string;
  model?: string;
}

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-api-key") ?? "";
  if (!apiKey) {
    return Response.json({ error: "Missing API key" }, { status: 400 });
  }
  const providerName = req.headers.get("x-summary-provider") ?? "openai";
  const parsedProvider = SummaryProviderSchema.safeParse(providerName);
  if (!parsedProvider.success) {
    return Response.json({ error: `Unknown summary provider: ${providerName}` }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "Expected JSON body" }, { status: 400 });
  }

  if (!body.text || !body.prompt) {
    return Response.json({ error: "Missing 'text' or 'prompt'" }, { status: 400 });
  }

  try {
    const provider = getSummaryProvider(parsedProvider.data);
    const result = await provider.summarize({
      text: body.text,
      apiKey,
      prompt: body.prompt,
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
