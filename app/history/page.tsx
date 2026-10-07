"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { api, fmtDate } from "@/lib/client";
import { PROBLEM_TYPE_LABEL, type ProblemType, type SessionSummary } from "@/lib/types";

export default function HistoryPage() {
  const [items, setItems] = useState<SessionSummary[] | null>(null);
  const load = () => api<SessionSummary[]>("/api/sessions").then(setItems);
  useEffect(() => {
    load();
  }, []);

  if (!items) return <div className="p-10 text-sm text-muted">불러오는 중…</div>;

  // 유형별 평균 점수
  const byType = new Map<ProblemType, number[]>();
  items.forEach((s) =>
    s.types.forEach((t, i) => {
      const v = s.totals[i];
      if (v !== null) byType.set(t, [...(byType.get(t) ?? []), v]);
    }),
  );
  const graded = items.filter((s) => s.totals.some((t) => t !== null)).slice(0, 20).reverse();

  return (
    <div className="min-h-screen bg-panel">
      <SiteHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <h1 className="text-xl font-bold">응시 기록</h1>

        <section className="grid gap-3 md:grid-cols-3">
          {(["solution", "communication", "document"] as const).map((t) => {
            const arr = byType.get(t) ?? [];
            const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
            return (
              <div key={t} className="rounded-xl border border-line bg-white p-5">
                <p className="text-sm text-muted">{PROBLEM_TYPE_LABEL[t]}</p>
                <p className="mt-1 text-3xl font-black tabular-nums">
                  {avg ?? "–"}
                  <span className="text-base font-semibold text-muted"> 평균 · {arr.length}회</span>
                </p>
              </div>
            );
          })}
        </section>

        {graded.length > 1 && (
          <section className="rounded-xl border border-line bg-white p-5">
            <p className="mb-3 text-sm font-semibold">최근 점수 추이 (문제별)</p>
            <div className="flex h-40 items-end gap-2">
              {graded.flatMap((s) =>
                s.totals.map((v, i) =>
                  v === null ? null : (
                    <div key={`${s.id}-${i}`} className="flex flex-1 flex-col items-center gap-1" title={`${s.title} · ${v}점`}>
                      <span className="text-[11px] tabular-nums text-muted">{v}</span>
                      <div className="w-full max-w-8 rounded-t bg-accent" style={{ height: `${v * 1.2}px` }} />
                    </div>
                  ),
                ),
              )}
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-panel text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5">일시</th>
                <th className="px-4 py-2.5">구분</th>
                <th className="px-4 py-2.5">제목</th>
                <th className="px-4 py-2.5">점수</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted">아직 기록이 없습니다.</td>
                </tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{fmtDate(s.createdAt)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{s.mode === "mock" ? "모의고사" : "연습"}</td>
                  <td className="px-4 py-2.5">{s.title}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                    {s.status === "in_progress" ? (
                      <span className="text-amber-600">진행 중</span>
                    ) : (
                      s.totals.map((t) => (t === null ? "채점 전" : `${t}점`)).join(" / ")
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <Link
                      href={s.status === "in_progress" ? `/exam/${s.id}` : `/review/${s.id}`}
                      className="text-accent"
                    >
                      {s.status === "in_progress" ? "이어서" : "결과 보기"}
                    </Link>
                    <button
                      onClick={async () => {
                        if (!confirm("이 기록을 삭제할까요?")) return;
                        await api(`/api/sessions/${s.id}`, { method: "DELETE" });
                        load();
                      }}
                      className="ml-3 text-muted hover:text-brand"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
