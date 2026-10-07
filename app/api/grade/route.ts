import { completeText, extractJson } from "@/lib/llm";
import { GRADER_SYSTEM, gradingPrompt } from "@/lib/prompts";
import { getSession, getSettings, saveSession } from "@/lib/store";
import type { Grade } from "@/lib/types";

export const maxDuration = 600;

// 같은 문제를 동시에 두 번 채점하지 않도록 진행 중인 작업을 공유한다
const store = globalThis as unknown as { __grading?: Map<string, Promise<Response>> };
const inflight = (store.__grading ??= new Map());

/** body: { sessionId, stageIndex, force? } → 채점 후 세션에 저장 */
export async function POST(req: Request) {
  const { sessionId, stageIndex, force } = (await req.json()) as {
    sessionId: string;
    stageIndex: number;
    force?: boolean;
  };
  const key = `${sessionId}:${stageIndex}`;
  let job = inflight.get(key);
  if (!job) {
    job = grade(sessionId, stageIndex, !!force).finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return (await job).clone();
}

async function grade(sessionId: string, stageIndex: number, force: boolean): Promise<Response> {
  const session = await getSession(sessionId);
  const stage = session?.stages[stageIndex];
  if (!session || !stage) return Response.json({ error: "not found" }, { status: 404 });
  if (stage.grade && !force) return Response.json(stage.grade);

  const settings = await getSettings();
  const choice = settings.grader;
  try {
    const raw = await completeText(
      settings,
      choice,
      GRADER_SYSTEM,
      gradingPrompt(stage, stage.timeSpentSec),
    );
    const g = extractJson<Omit<Grade, "total" | "gradedBy" | "gradedAt">>(raw);
    const scores = g.scores.map((s) => ({ ...s, score: Math.max(0, Math.min(s.max, Number(s.score) || 0)) }));
    const grade: Grade = {
      ...g,
      scores,
      strengths: g.strengths ?? [],
      improvements: g.improvements ?? [],
      betterPrompts: g.betterPrompts ?? [],
      modelAnswer: g.modelAnswer ?? "",
      total: scores.reduce((s, x) => s + x.score, 0),
      gradedBy: `${choice.provider}:${choice.model}`,
      gradedAt: Date.now(),
    };
    // 채점 도중 다른 단계가 저장됐을 수 있으므로 다시 읽어서 병합
    const fresh = (await getSession(sessionId)) ?? session;
    fresh.stages[stageIndex] = { ...fresh.stages[stageIndex], grade, gradeError: undefined };
    if (fresh.stages.every((s) => s.grade)) fresh.status = "graded";
    await saveSession(fresh);
    return Response.json(grade);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const fresh = (await getSession(sessionId)) ?? session;
    fresh.stages[stageIndex] = { ...fresh.stages[stageIndex], gradeError: msg };
    await saveSession(fresh);
    return Response.json({ error: msg }, { status: 500 });
  }
}
