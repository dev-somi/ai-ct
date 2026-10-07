import type { NextRequest } from "next/server";
import { listRemoteModels, MODEL_SUGGESTIONS } from "@/lib/llm";
import { getSettings } from "@/lib/store";
import type { Provider } from "@/lib/types";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") as Provider | null;
  if (!provider || !(provider in MODEL_SUGGESTIONS))
    return Response.json({ error: "provider 필요" }, { status: 400 });
  try {
    const models = await listRemoteModels(await getSettings(), provider);
    return Response.json({ models });
  } catch (e) {
    return Response.json({ models: MODEL_SUGGESTIONS[provider], error: String(e) });
  }
}
