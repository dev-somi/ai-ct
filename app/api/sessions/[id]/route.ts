import type { NextRequest } from "next/server";
import { deleteSession, getSession, saveSession } from "@/lib/store";
import type { Session } from "@/lib/types";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const s = await getSession(id);
  if (!s) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(s);
}

/** 클라이언트가 세션 전체를 저장 (자동저장/임시저장/제출) */
export async function PUT(req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const existing = await getSession(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  const incoming = (await req.json()) as Session;
  // 이미 제출된 문제/채점 결과는 덮어쓰지 않는다
  const stages = incoming.stages.map((st, i) => {
    const prev = existing.stages[i];
    if (prev?.submitted) return { ...prev, threads: st.threads, grade: prev.grade ?? st.grade };
    return st;
  });
  const status = existing.status === "graded" ? "graded" : incoming.status;
  await saveSession({ ...incoming, id, stages, status });
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  await deleteSession(id);
  return Response.json({ ok: true });
}
