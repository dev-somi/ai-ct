"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import AnswerEditor from "@/components/AnswerEditor";
import ChatPanel from "@/components/ChatPanel";
import ProblemPanel from "@/components/ProblemPanel";
import { api, fmtTime, uid } from "@/lib/client";
import type { ChatMsg, ModelChoice, PublicSettings, Session, StageState } from "@/lib/types";

const CHOICE_KEY = "aict.chatChoice";

/** 마크다운 기호·공백을 걷어낸 비교용 문자열 (채팅 → 답안 붙여넣기 감지) */
const squash = (s: string) => s.replace(/[\s*#`>|_~\-]+/g, "");

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [choice, setChoice] = useState<ModelChoice | null>(null);
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [widths, setWidths] = useState<[number, number]>([26, 37]);
  const [version, setVersion] = useState(0); // 사용자 변경 횟수 (자동저장 디바운스용)

  const sessionRef = useRef<Session | null>(null);
  const activeRef = useRef(active);
  const finishing = useRef(false);
  useLayoutEffect(() => {
    sessionRef.current = session;
    activeRef.current = active;
  });

  /* ---------- load ---------- */
  useEffect(() => {
    api<Session>(`/api/sessions/${id}`)
      .then((s) => {
        if (s.status !== "in_progress") router.replace(`/review/${id}`);
        else setSession(s);
      })
      .catch((e) => setError(String(e)));
    api<PublicSettings>("/api/settings").then((st) => {
      setSettings(st);
      let c = st.chat;
      try {
        const saved = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? "null") as ModelChoice | null;
        if (saved && st.available[saved.provider]) c = saved;
      } catch {}
      setChoice(c);
    });
  }, [id, router]);

  /* ---------- save ---------- */
  const save = useCallback(async (s?: Session) => {
    const cur = s ?? sessionRef.current;
    if (!cur) return;
    setSaveState("saving");
    try {
      await api(`/api/sessions/${cur.id}`, { method: "PUT", json: cur });
      setSaveState("saved");
      setSavedAt(Date.now());
    } catch (e) {
      setSaveState("dirty");
      setToast(`저장 실패: ${e}`);
    }
  }, []);

  const mutate = useCallback((fn: (s: Session) => Session) => {
    setSession((prev) => (prev ? fn(prev) : prev));
    setSaveState("dirty");
    setVersion((v) => v + 1);
  }, []);

  const mutateStage = useCallback(
    (i: number, fn: (st: StageState) => StageState) =>
      mutate((s) => ({ ...s, stages: s.stages.map((st, j) => (j === i ? fn(st) : st)) })),
    [mutate],
  );

  // 변경 후 3초 뒤 자동저장 (+ 30초마다 강제 저장)
  useEffect(() => {
    if (saveState !== "dirty") return;
    const t = setTimeout(() => save(), 3000);
    return () => clearTimeout(t);
  }, [saveState, version, save]);
  useEffect(() => {
    const t = setInterval(() => save(), 30000);
    return () => clearInterval(t);
  }, [save]);

  /* ---------- final submit ---------- */
  const finish = useCallback(
    async (auto = false) => {
      const cur = sessionRef.current;
      if (!cur || finishing.current) return;
      if (!auto && !confirm("최종 제출 후 시험이 종료됩니다. 제출하지 않은 답안도 현재 상태로 제출됩니다. 진행할까요?"))
        return;
      finishing.current = true;
      const t = Date.now();
      const done: Session = {
        ...cur,
        status: "submitted",
        finishedAt: t,
        stages: cur.stages.map((st) => (st.submitted ? st : { ...st, submitted: true, submittedAt: t })),
      };
      setSession(done);
      await save(done);
      router.push(`/review/${cur.id}`);
    },
    [router, save],
  );

  /* ---------- timer ---------- */
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => {
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      const cur = sessionRef.current;
      if (!cur || cur.status !== "in_progress") return;
      if (ts >= cur.startedAt + cur.timeLimitSec * 1000) {
        if (!finishing.current) setToast("제한시간이 종료되어 자동 제출합니다.");
        finishRef.current(true);
        return;
      }
      // 현재 문제 소요시간 누적 (자동저장 트리거는 하지 않음)
      setSession((prev) =>
        prev
          ? {
              ...prev,
              stages: prev.stages.map((st, j) =>
                j === activeRef.current && !st.submitted ? { ...st, timeSpentSec: st.timeSpentSec + 1 } : st,
              ),
            }
          : prev,
      );
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = session ? session.startedAt / 1000 + session.timeLimitSec - now / 1000 : 0;

  /* ---------- 탭 이탈 감지 / 이탈 경고 ---------- */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden" && sessionRef.current?.status === "in_progress") {
        mutate((s) => ({ ...s, tabSwitches: s.tabSwitches + 1 }));
        setToast("⚠️ 화면 이탈이 감지되었습니다. 실제 시험에서는 웹 검색·메모장 등 다른 프로그램을 사용할 수 없습니다.");
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (sessionRef.current?.status === "in_progress") e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [mutate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (error) return <Center>세션을 불러오지 못했습니다: {error}</Center>;
  if (!session) return <Center>불러오는 중…</Center>;

  const stage = session.stages[active];
  const thread = stage.threads[stage.threads.length - 1];
  const layout = settings?.layout ?? "skax";
  const maxChars = stage.problem.submitFormat.maxChars;

  const updateThread = (fn: (m: ChatMsg[]) => ChatMsg[]) =>
    mutateStage(active, (st) => ({
      ...st,
      threads: st.threads.map((t, k) => (k === st.threads.length - 1 ? { ...t, messages: fn(t.messages) } : t)),
    }));

  const submitStage = async () => {
    if (stage.answerText.length > maxChars && !confirm(`글자수 제한(${maxChars}자)을 초과했습니다. 그래도 제출할까요?`))
      return;
    if (!confirm("한번 [답안지 제출]을 진행하면 수정이 불가능합니다. 제출할까요?")) return;
    const next: Session = {
      ...session,
      stages: session.stages.map((st, j) => (j === active ? { ...st, submitted: true, submittedAt: Date.now() } : st)),
    };
    setSession(next);
    await save(next);
    // 다음 문제를 푸는 동안 백그라운드에서 채점
    fetch("/api/grade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: session.id, stageIndex: active }),
    }).catch(() => {});
    const nextIdx = next.stages.findIndex((st) => !st.submitted);
    if (nextIdx === -1) finish(true);
    else {
      setActive(nextIdx);
      setToast(`문제 ${active + 1} 답안이 제출되었습니다. 문제 ${nextIdx + 1}로 이동합니다.`);
    }
  };

  const onPasteText = (text: string) => {
    const s = squash(text);
    const fromChat =
      s.length >= 10 &&
      stage.threads.some((t) => t.messages.some((m) => m.role === "assistant" && squash(m.content).includes(s)));
    mutateStage(active, (st) => ({ ...st, pastes: [...st.pastes, { chars: text.length, fromChat, at: Date.now() }] }));
  };

  const setLayout = async (l: "skax" | "skcc") => {
    setSettings((s) => (s ? { ...s, layout: l } : s));
    await api("/api/settings", { method: "PUT", json: { layout: l } });
  };

  /* ---------- panels ---------- */
  const problemCol = (
    <div className="flex h-full min-h-0 flex-col bg-panel">
      <div className="border-b border-line bg-white px-5 py-4">
        <p className="text-xs text-muted">
          문제 {active + 1} / {session.stages.length}
        </p>
        <h1 className="mt-1 text-lg font-bold leading-snug">{stage.problem.title}</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ProblemPanel problem={stage.problem} />
      </div>
      <div className="space-y-2 border-t border-line bg-white p-3">
        <div className="flex items-center justify-between text-xs">
          <button disabled={active === 0} onClick={() => setActive(active - 1)} className="px-2 py-1 disabled:opacity-30">
            ← 이전 문제
          </button>
          <button
            disabled={active === session.stages.length - 1}
            onClick={() => setActive(active + 1)}
            className="px-2 py-1 disabled:opacity-30"
          >
            다음 문제 →
          </button>
        </div>
        {session.stages.map((st, j) => (
          <button
            key={j}
            onClick={() => setActive(j)}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
              j === active ? "border-accent bg-blue-50" : "border-line"
            }`}
          >
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold text-white ${
                st.submitted ? "bg-gray-400" : j === active ? "bg-accent" : "bg-gray-300"
              }`}
            >
              {st.submitted ? "제출완료" : j === active ? "진행중" : "대기"}
            </span>
            <span className="truncate">
              Stage {j + 1}. {st.problem.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const chatCol = (
    <ChatPanel
      key={`${active}-${thread.id}`}
      messages={thread.messages}
      update={updateThread}
      onNewChat={() => mutateStage(active, (st) => ({ ...st, threads: [...st.threads, { id: uid(), messages: [] }] }))}
      settings={settings}
      choice={choice}
      onChoice={(c) => {
        setChoice(c);
        try {
          localStorage.setItem(CHOICE_KEY, JSON.stringify(c));
        } catch {}
      }}
      disabled={stage.submitted}
    />
  );

  const editorCol = (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-2.5">
        <h2 className="shrink-0 text-[15px] font-bold">답안 작성</h2>
        <p className="text-right text-[11px] leading-snug text-brand">
          본 평가는 작성하신 답안의 내용 중심으로 채점되며, 서식이 점수에 영향을 미치지 않습니다.
          <br />
          AI 채팅의 결과를 복사하는 과정에서 일부 서식(폰트, 표 양식 등)이 다르게 적용될 수 있습니다.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <AnswerEditor
          key={active}
          initialHtml={stage.answerHtml}
          readOnly={stage.submitted}
          maxChars={maxChars}
          onChange={(html, text) => mutateStage(active, (st) => ({ ...st, answerHtml: html, answerText: text }))}
          onPasteText={onPasteText}
        />
      </div>
      <div className="border-t border-line px-4 py-3">
        {!stage.submitted && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-brand">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" /> 한번 [답안지 제출]을 진행하면 수정이 불가능합니다. 이
            점 유의해주세요!
          </p>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">
            상태 |{" "}
            {stage.submitted
              ? "제출 완료"
              : saveState === "saving"
                ? "저장 중…"
                : saveState === "dirty"
                  ? "저장되지 않음"
                  : savedAt
                    ? `저장됨 ${new Date(savedAt).toLocaleTimeString("ko-KR")}`
                    : "저장되지 않음"}
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => save()}
              disabled={stage.submitted}
              className="w-32 rounded-lg border border-line bg-white py-2 text-sm font-medium hover:bg-panel disabled:opacity-40"
            >
              임시저장
            </button>
            <button
              onClick={submitStage}
              disabled={stage.submitted}
              className="w-32 rounded-lg bg-accent py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
            >
              답안지 제출
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const [mid, right] = layout === "skax" ? [editorCol, chatCol] : [chatCol, editorCol];
  const lowTime = remaining < 300;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-5">
        <Link href="/" className="flex items-baseline gap-1.5" onClick={(e) => !confirm("홈으로 나가시겠습니까? (진행 상황은 저장됩니다)") && e.preventDefault()}>
          <span className="text-lg font-black text-brand">SK</span>
          <span className="text-lg font-black text-brand-2">AX</span>
          <span className="ml-2 text-sm font-bold text-ink">AICT</span>
        </Link>
        <span className="truncate text-sm text-muted">{session.title}</span>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex overflow-hidden rounded-md border border-line text-xs" title="화면 배치">
            {(["skax", "skcc"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`px-2 py-1 ${layout === l ? "bg-ink text-white" : "bg-white text-muted"}`}
              >
                {l === "skax" ? "에디터 가운데" : "채팅 가운데"}
              </button>
            ))}
          </div>
          {session.tabSwitches > 0 && <span className="text-xs text-brand">화면 이탈 {session.tabSwitches}회</span>}
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted">제한시간</span>
            <span className={`font-mono text-xl font-bold tabular-nums ${lowTime ? "text-brand" : ""}`}>{fmtTime(remaining)}</span>
          </div>
          <button
            onClick={() => finish(false)}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            최종 제출 및 시험 종료
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div style={{ width: `${widths[0]}%` }} className="min-w-0 border-r border-line">
          {problemCol}
        </div>
        <Splitter onDrag={(dx) => setWidths(([a, b]) => [clamp(a + dx, 16, 40), clamp(b - dx, 25, 60)])} />
        <div style={{ width: `${widths[1]}%` }} className="min-w-0 border-r border-line">
          {mid}
        </div>
        <Splitter onDrag={(dx) => setWidths(([a, b]) => [a, clamp(b + dx, 25, 60)])} />
        <div className="min-w-0 flex-1">{right}</div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-xl -translate-x-1/2 rounded-lg bg-ink px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function Splitter({ onDrag }: { onDrag: (dxPercent: number) => void }) {
  return (
    <div
      className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/30"
      onMouseDown={(e) => {
        e.preventDefault();
        let last = e.clientX;
        const move = (ev: MouseEvent) => {
          onDrag(((ev.clientX - last) / window.innerWidth) * 100);
          last = ev.clientX;
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    />
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen items-center justify-center text-sm text-muted">{children}</div>;
}
