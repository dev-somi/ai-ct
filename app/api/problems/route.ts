import type { NextRequest } from "next/server";
import { deleteGeneratedProblem, listProblems, saveGeneratedProblem } from "@/lib/store";
import type { Problem } from "@/lib/types";

export async function GET() {
  return Response.json(await listProblems());
}

export async function POST(req: Request) {
  const p = (await req.json()) as Problem;
  await saveGeneratedProblem({ ...p, source: "generated" });
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id 필요" }, { status: 400 });
  await deleteGeneratedProblem(id);
  return Response.json({ ok: true });
}
