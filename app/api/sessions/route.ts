import { getProblem, listProblems, listSessions, newId, saveSession } from "@/lib/store";
import type { Problem, Session, StageState } from "@/lib/types";

export async function GET() {
  return Response.json(await listSessions());
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function stage(problem: Problem): StageState {
  return {
    problem,
    threads: [{ id: newId("t-"), messages: [] }],
    answerHtml: "",
    answerText: "",
    submitted: false,
    pastes: [],
    timeSpentSec: 0,
  };
}

/**
 * body:
 *  { mode: "mock" }                                    → Global 모의고사 (솔루션 + 커뮤니케이션, 60분)
 *  { mode: "practice", problemId, timeLimitMin? }      → 단일 문제
 *  { mode: "practice", problem, timeLimitMin? }        → (생성된) 문제 객체로 바로 시작
 */
export async function POST(req: Request) {
  const body = await req.json();
  const now = Date.now();
  let session: Session;

  if (body.mode === "mock") {
    const all = await listProblems();
    const sol = all.filter((p) => p.type === "solution");
    const com = all.filter((p) => p.type === "communication");
    if (!sol.length || !com.length)
      return Response.json({ error: "문제 은행에 솔루션/커뮤니케이션 문제가 필요합니다." }, { status: 400 });
    session = {
      id: newId("s-"),
      mode: "mock",
      title: "AI 실무역량검사 (Global) 모의고사",
      createdAt: now,
      startedAt: now,
      timeLimitSec: (Number(body.timeLimitMin) || 60) * 60,
      status: "in_progress",
      stages: [stage(pick(sol)), stage(pick(com))],
      tabSwitches: 0,
    };
  } else {
    const problem: Problem | null = body.problem ?? (await getProblem(String(body.problemId)));
    if (!problem) return Response.json({ error: "문제를 찾을 수 없습니다." }, { status: 404 });
    session = {
      id: newId("s-"),
      mode: "practice",
      title: problem.title,
      createdAt: now,
      startedAt: now,
      timeLimitSec: (Number(body.timeLimitMin) || problem.timeLimitMin) * 60,
      status: "in_progress",
      stages: [stage(problem)],
      tabSwitches: 0,
    };
  }
  await saveSession(session);
  return Response.json({ id: session.id });
}
