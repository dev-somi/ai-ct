import { getSettings, saveSettings, toPublic } from "@/lib/store";
import type { Settings } from "@/lib/types";

export async function GET() {
  return Response.json(toPublic(await getSettings()));
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  await saveSettings(body);
  return Response.json(toPublic(await getSettings()));
}
