"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { api, fmtDate } from "@/lib/client";
import {
  PROBLEM_TYPE_LABEL,
  PROVIDER_LABEL,
  type Problem,
  type ProblemType,
  type PublicSettings,
  type SessionSummary,
} from "@/lib/types";

const EXAM_DATE = new Date(2026, 9, 15); // 10/15(목)

export default function Home() {
  const router = useRouter();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [filter, setFilter] = useState<ProblemType | "all">("all");
  const [starting, setStarting] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    api<Problem[]>("/api/problems").then(setProblems);
    api<SessionSummary[]>("/api/sessions").then(setSessions);
    api<PublicSettings>("/api/settings").then(setSettings);
  };
  useEffect(load, []);

  const start = async (key: string, body: unknown) => {
    setStarting(key);
    setError("");
    try {
      const r = await api<{ id: string }>("/api/sessions", { method: "POST", json: body });
      router.push(`/exam/${r.id}`);
    } catch (e) {
      setError(String(e));
      setStarting("");
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dday = Math.round((EXAM_DATE.getTime() - today.getTime()) / 86400000);
  const inProgress = sessions.filter((s) => s.status === "in_progress");
  const shown = problems.filter((p) => filter === "all" || p.type === filter);

  return (
    <div className="min-h-screen bg-panel">
      <SiteHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section className="flex flex-wrap items-center gap-6 rounded-2xl bg-ink p-7 text-white">
          <div className="min-w-72 flex-1">
            <p className="text-sm text-white/60">SK AI 실무역량검사 (Global) · 10/15(목) 9:00~13:00</p>
            <h1 className="mt-2 text-2xl font-bold leading-snug">
              AI를 활용한 문제해결·전략적 커뮤니케이션
              <br />
              실전처럼 연습하고 AI 채점으로 피드백 받기
            </h1>
            <ul className="mt-4 space-y-1 text-sm text-white/75">
              <li>• 총 60분, 2개 Stage: ① AI를 활용한 비즈니스 솔루션 설계 ② 전략적 커뮤니케이션</li>
              <li>• 웹 검색·메모장 등 별도 프로그램 사용 불가 → 화면 속 AI 채팅만으로 해결</li>
              <li>• 결과물 품질과 AI 활용 과정(프롬프트·검증·편집)을 함께 평가</li>
            </ul>
          </div>
          <div className="text-center">
            <p className="text-sm text-white/60">시험까지</p>
            <p className="text-5xl font-black tabular-nums text-brand-2">{dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : "종료"}</p>
          </div>
        </section>

        {inProgress.length > 0 && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-semibold">진행 중인 시험이 있습니다</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {inProgress.map((s) => (
                <Link key={s.id} href={`/exam/${s.id}`} className="rounded-md bg-white px-3 py-1.5 shadow-sm hover:shadow">
                  {s.title} · {fmtDate(s.createdAt)} → 이어서
                </Link>
              ))}
            </div>
          </section>
        )}

        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-brand">{error}</p>}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col rounded-xl border-2 border-brand/70 bg-white p-6 md:col-span-2">
            <span className="w-fit rounded bg-brand px-2 py-0.5 text-xs font-semibold text-white">실전</span>
            <h2 className="mt-3 text-lg font-bold">AI 실무역량검사 (Global) 모의고사</h2>
            <p className="mt-1 text-sm text-muted">
              60분 · Stage 1 비즈니스 솔루션 설계 + Stage 2 전략적 커뮤니케이션 (문제 은행에서 무작위 출제)
            </p>
            <div className="mt-auto flex items-center gap-3 pt-5">
              <button
                onClick={() => start("mock", { mode: "mock" })}
                disabled={!!starting}
                className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {starting === "mock" ? "준비 중…" : "모의고사 시작 (60분)"}
              </button>
              <button
                onClick={() => start("mock30", { mode: "mock", timeLimitMin: 30 })}
                disabled={!!starting}
                className="rounded-lg border border-line px-4 py-2.5 text-sm hover:bg-panel disabled:opacity-50"
              >
                스피드 모드 (30분)
              </button>
            </div>
          </div>
          <div className="flex flex-col rounded-xl border border-line bg-white p-6">
            <span className="w-fit rounded bg-accent px-2 py-0.5 text-xs font-semibold text-white">AI 출제</span>
            <h2 className="mt-3 text-lg font-bold">새 문제 생성</h2>
            <p className="mt-1 text-sm text-muted">유형·산업을 고르면 AI가 실제 시험 형식의 새 문제를 만들어 줍니다.</p>
            <Link href="/generate" className="mt-auto w-fit rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white">
              문제 만들기 →
            </Link>
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-3 text-lg font-bold">문제별 연습</h2>
            {(["all", "solution", "communication", "document"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`rounded-full px-3 py-1 text-sm ${filter === t ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-line"}`}
              >
                {t === "all" ? `전체 ${problems.length}` : `${PROBLEM_TYPE_LABEL[t]} ${problems.filter((p) => p.type === t).length}`}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {shown.map((p) => {
              const tries = sessions.filter((s) => s.title === p.title);
              const best = Math.max(-1, ...tries.flatMap((s) => s.totals.filter((x): x is number => x !== null)));
              return (
                <div key={p.id} className="flex flex-col rounded-xl border border-line bg-white p-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-panel px-1.5 py-0.5 text-muted">{PROBLEM_TYPE_LABEL[p.type]}</span>
                    {p.industry && <span className="text-muted">{p.industry}</span>}
                    {p.source === "generated" && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-accent">AI 생성</span>}
                    {best >= 0 && <span className="ml-auto font-semibold text-emerald-600">최고 {best}점</span>}
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.scenario.task}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                    <span>{p.timeLimitMin}분</span>
                    <span>{p.submitFormat.maxChars.toLocaleString()}자</span>
                    <span>{p.submitFormat.language === "en" ? "영문 답안" : "국문 답안"}</span>
                    {p.source === "generated" && (
                      <button
                        onClick={async () => {
                          if (!confirm("이 생성 문제를 삭제할까요?")) return;
                          await api(`/api/problems?id=${p.id}`, { method: "DELETE" });
                          load();
                        }}
                        className="hover:text-brand"
                      >
                        삭제
                      </button>
                    )}
                    <button
                      onClick={() => start(p.id, { mode: "practice", problemId: p.id })}
                      disabled={!!starting}
                      className="ml-auto rounded-md bg-ink px-3 py-1.5 text-white disabled:opacity-50"
                    >
                      {starting === p.id ? "준비 중…" : "풀기"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4 text-sm">
          <span className="text-muted">AI 채팅:</span>
          <b>{settings ? `${PROVIDER_LABEL[settings.chat.provider]} · ${settings.chat.model}` : "…"}</b>
          <span className="ml-4 text-muted">채점:</span>
          <b>{settings ? `${PROVIDER_LABEL[settings.grader.provider]} · ${settings.grader.model}` : "…"}</b>
          <Link href="/settings" className="ml-auto text-accent">설정 변경 →</Link>
        </section>
      </main>
    </div>
  );
}
