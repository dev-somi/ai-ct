"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import ProblemPanel from "@/components/ProblemPanel";
import SiteHeader from "@/components/SiteHeader";
import { api } from "@/lib/client";
import { PROBLEM_TYPE_LABEL, type Problem, type ProblemType } from "@/lib/types";

const INDUSTRIES = ["자유", "금융", "제조", "통신", "반도체", "에너지", "헬스케어", "유통·물류", "공공", "IT 서비스"];

export default function GeneratePage() {
  const router = useRouter();
  const [type, setType] = useState<ProblemType>("solution");
  const [industry, setIndustry] = useState("자유");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setBusy(true);
    setError("");
    setProblem(null);
    setSaved(false);
    try {
      setProblem(
        await api<Problem>("/api/generate", {
          method: "POST",
          json: { type, industry: industry === "자유" ? "" : industry, extra },
        }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!problem) return;
    await api("/api/problems", { method: "POST", json: problem });
    setSaved(true);
  };

  const start = async () => {
    if (!problem) return;
    const r = await api<{ id: string }>("/api/sessions", { method: "POST", json: { mode: "practice", problem } });
    router.push(`/exam/${r.id}`);
  };

  return (
    <div className="min-h-screen bg-panel">
      <SiteHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <h1 className="text-xl font-bold">AI 문제 생성</h1>
        <section className="space-y-4 rounded-xl border border-line bg-white p-6">
          <div>
            <p className="mb-2 text-sm font-semibold">유형</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PROBLEM_TYPE_LABEL) as ProblemType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`rounded-lg border px-3 py-2 text-sm ${type === t ? "border-accent bg-blue-50 font-semibold text-accent" : "border-line"}`}
                >
                  {PROBLEM_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">산업 / 도메인</p>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((i) => (
                <button
                  key={i}
                  onClick={() => setIndustry(i)}
                  className={`rounded-full px-3 py-1 text-sm ${industry === i ? "bg-ink text-white" : "bg-panel text-muted"}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">추가 조건 (선택)</p>
            <input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="예) 영문 답안, 1,000자 이내, 미국 고객사 대상, 표 데이터 많이"
              className="h-10 w-full rounded-md border border-line px-3 text-sm"
            />
          </div>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "생성 중… (30초~2분)" : "문제 생성"}
          </button>
          {error && <p className="text-sm text-brand">{error}</p>}
        </section>

        {problem && (
          <section className="space-y-4 rounded-xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">{problem.title}</h2>
              <div className="ml-auto flex gap-2">
                <button onClick={generate} disabled={busy} className="rounded-md border border-line px-3 py-2 text-sm">
                  다시 생성
                </button>
                <button
                  onClick={save}
                  disabled={saved}
                  className="rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                >
                  {saved ? "문제 은행에 저장됨" : "문제 은행에 저장"}
                </button>
                <button onClick={start} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
                  바로 풀기 →
                </button>
              </div>
            </div>
            <ProblemPanel problem={problem} />
          </section>
        )}
      </main>
    </div>
  );
}
