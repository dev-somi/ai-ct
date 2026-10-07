"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Markdown from "@/components/Markdown";
import ProblemPanel from "@/components/ProblemPanel";
import SiteHeader from "@/components/SiteHeader";
import { api, fmtDate } from "@/lib/client";
import { PROBLEM_TYPE_LABEL, type Session, type StageState } from "@/lib/types";

type Tab = "feedback" | "compare" | "chat" | "problem";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState<Tab>("feedback");
  const [grading, setGrading] = useState<Record<number, boolean>>({});

  const reload = useCallback(() => api<Session>(`/api/sessions/${id}`).then(setSession), [id]);

  const grade = useCallback(
    async (i: number, force = false) => {
      setGrading((g) => ({ ...g, [i]: true }));
      try {
        await api("/api/grade", { method: "POST", json: { sessionId: id, stageIndex: i, force } });
      } catch {
        /* 오류는 세션의 gradeError로 표시 */
      } finally {
        setGrading((g) => ({ ...g, [i]: false }));
        reload();
      }
    },
    [id, reload],
  );

  useEffect(() => {
    api<Session>(`/api/sessions/${id}`).then((s) => {
      setSession(s);
      if (s.status === "in_progress") return;
      s.stages.forEach((st, i) => {
        if (!st.grade) grade(i);
      });
    });
  }, [id, grade]);

  if (!session) return <div className="p-10 text-sm text-muted">불러오는 중…</div>;

  if (session.status === "in_progress")
    return (
      <div className="mx-auto max-w-xl p-10">
        <p>아직 진행 중인 시험입니다.</p>
        <Link className="text-accent underline" href={`/exam/${id}`}>
          시험 이어서 보기
        </Link>
      </div>
    );

  const stage = session.stages[active];
  const graded = session.stages.filter((s) => s.grade);
  const avg = graded.length ? Math.round(graded.reduce((a, s) => a + (s.grade?.total ?? 0), 0) / graded.length) : null;

  const retry = async () => {
    const r = await api<{ id: string }>("/api/sessions", {
      method: "POST",
      json: { mode: "practice", problem: stage.problem },
    });
    router.push(`/exam/${r.id}`);
  };

  return (
    <div className="min-h-screen bg-panel">
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-5 px-6 py-6">
        <section className="flex flex-wrap items-end gap-6 rounded-xl border border-line bg-white p-6">
          <div>
            <p className="text-sm text-muted">{fmtDate(session.createdAt)} · {session.mode === "mock" ? "모의고사" : "문제 연습"}</p>
            <h1 className="mt-1 text-xl font-bold">{session.title}</h1>
            <p className="mt-1 text-sm text-muted">
              소요 {Math.round(((session.finishedAt ?? session.startedAt) - session.startedAt) / 60000)}분 / 제한{" "}
              {Math.round(session.timeLimitSec / 60)}분
              {session.tabSwitches > 0 && <span className="text-brand"> · 화면 이탈 {session.tabSwitches}회</span>}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted">평균 점수</p>
            <p className="text-4xl font-black tabular-nums">
              {avg ?? "–"}
              <span className="text-lg font-semibold text-muted"> / 100</span>
            </p>
          </div>
        </section>

        {session.stages.length > 1 && (
          <div className="flex gap-2">
            {session.stages.map((st, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  i === active ? "border-accent bg-white font-semibold text-accent" : "border-line bg-white text-muted"
                }`}
              >
                Stage {i + 1}. {PROBLEM_TYPE_LABEL[st.problem.type]}
                <span className="ml-2 tabular-nums">{st.grade ? `${st.grade.total}점` : grading[i] ? "채점 중…" : "-"}</span>
              </button>
            ))}
          </div>
        )}

        <section className="rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 pt-4">
            <h2 className="mr-4 pb-3 font-bold">{stage.problem.title}</h2>
            {(
              [
                ["feedback", "점수·피드백"],
                ["compare", "내 답안 vs 모범 답안"],
                ["chat", "AI 채팅 로그"],
                ["problem", "문제 다시 보기"],
              ] as [Tab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-3 pb-3 text-sm ${tab === k ? "border-accent font-semibold text-accent" : "border-transparent text-muted"}`}
              >
                {label}
              </button>
            ))}
            <div className="mb-3 ml-auto flex gap-2">
              <button
                onClick={() => grade(active, true)}
                disabled={grading[active]}
                className="rounded-md border border-line px-3 py-1.5 text-xs hover:bg-panel disabled:opacity-40"
              >
                {grading[active] ? "채점 중…" : "다시 채점"}
              </button>
              <button onClick={retry} className="rounded-md bg-ink px-3 py-1.5 text-xs text-white">
                이 문제 다시 풀기
              </button>
            </div>
          </div>
          <div className="p-5">
            {tab === "feedback" && <Feedback stage={stage} busy={!!grading[active]} />}
            {tab === "compare" && <Compare stage={stage} />}
            {tab === "chat" && <ChatLog stage={stage} />}
            {tab === "problem" && <ProblemPanel problem={stage.problem} />}
          </div>
        </section>
      </main>
    </div>
  );
}

function Stats({ stage }: { stage: StageState }) {
  const prompts = stage.threads.flatMap((t) => t.messages).filter((m) => m.role === "user").length;
  const pasted = stage.pastes.filter((p) => p.fromChat).reduce((a, p) => a + p.chars, 0);
  const ratio = stage.answerText.length ? Math.min(100, Math.round((pasted / stage.answerText.length) * 100)) : 0;
  const max = stage.problem.submitFormat.maxChars;
  const items = [
    ["소요 시간", `${Math.round(stage.timeSpentSec / 60)}분`],
    ["프롬프트 수", `${prompts}회 (채팅 ${stage.threads.length}개)`],
    ["답안 글자수", `${stage.answerText.length.toLocaleString()} / ${max.toLocaleString()}`],
    ["AI 응답 붙여넣기 비율", `${ratio}%`],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-panel px-4 py-3">
          <p className="text-xs text-muted">{k}</p>
          <p className={`mt-0.5 font-semibold tabular-nums ${k === "답안 글자수" && stage.answerText.length > max ? "text-brand" : ""}`}>{v}</p>
        </div>
      ))}
    </div>
  );
}

function Feedback({ stage, busy }: { stage: StageState; busy: boolean }) {
  const g = stage.grade;
  if (!g)
    return (
      <div className="space-y-4">
        <Stats stage={stage} />
        <div className="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
          {busy ? (
            <span className="animate-pulse">AI가 채점하고 있습니다… (1~3분 정도 걸립니다)</span>
          ) : stage.gradeError ? (
            <span className="text-brand">채점 오류: {stage.gradeError}</span>
          ) : (
            "채점 대기 중"
          )}
        </div>
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-5xl font-black tabular-nums">
            {g.total}
            <span className="text-xl text-muted"> / 100</span>
          </p>
          <p className="mt-1 text-xs text-muted">채점: {g.gradedBy}</p>
        </div>
        <p className="min-w-64 flex-1 text-[15px] leading-relaxed">{g.summary}</p>
      </div>
      <Stats stage={stage} />

      <div className="space-y-3">
        {g.scores.map((s) => (
          <div key={s.key} className="rounded-lg border border-line p-4">
            <div className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-sm font-semibold">{s.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuenow={s.score} aria-valuemax={s.max}>
                <div
                  className={`h-full rounded-full ${s.score / s.max >= 0.8 ? "bg-emerald-500" : s.score / s.max >= 0.6 ? "bg-accent" : "bg-brand-2"}`}
                  style={{ width: `${(s.score / s.max) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-sm font-semibold tabular-nums">
                {s.score} / {s.max}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-700">{s.comment}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="👍 잘한 점" items={g.strengths} />
        <ListCard title="🛠 개선할 점" items={g.improvements} />
      </div>

      {g.betterPrompts.length > 0 && (
        <div className="rounded-lg border border-line p-4">
          <h3 className="mb-3 font-semibold">💬 이렇게 프롬프트를 써 보세요</h3>
          <div className="space-y-2">
            {g.betterPrompts.map((p, i) => (
              <div key={i} className="group relative whitespace-pre-wrap rounded-md bg-panel p-3 pr-14 font-mono text-[13px] leading-relaxed">
                {p}
                <button
                  onClick={() => navigator.clipboard.writeText(p)}
                  className="absolute top-2 right-2 rounded border border-line bg-white px-2 py-0.5 text-[11px] opacity-0 group-hover:opacity-100"
                >
                  복사
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-line p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function Compare({ stage }: { stage: StageState }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-semibold">내 답안 ({stage.answerText.length.toLocaleString()}자)</h3>
        <div className="answer-editor max-h-[70vh] overflow-y-auto rounded-lg border border-line">
          <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: stage.answerHtml || "<p>(빈 답안)</p>" }} />
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          모범 답안 {stage.grade ? `(${stage.grade.modelAnswer.length.toLocaleString()}자)` : ""}
        </h3>
        <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-line bg-emerald-50/40 p-5">
          {stage.grade ? (
            <Markdown className="text-[15px]">{stage.grade.modelAnswer}</Markdown>
          ) : (
            <p className="text-sm text-muted">채점이 끝나면 표시됩니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatLog({ stage }: { stage: StageState }) {
  const threads = stage.threads.filter((t) => t.messages.length);
  if (!threads.length) return <p className="text-sm text-muted">AI 채팅을 사용하지 않았습니다.</p>;
  return (
    <div className="space-y-6">
      {threads.map((t, ti) => (
        <div key={t.id} className="space-y-3">
          <p className="text-xs font-semibold text-muted">채팅 {ti + 1}</p>
          {t.messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-accent px-4 py-2 text-sm text-white">
                {m.content}
              </div>
            ) : (
              <div key={i} className="max-w-[90%] rounded-2xl rounded-tl-sm bg-panel px-4 py-3">
                <Markdown>{m.content}</Markdown>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
