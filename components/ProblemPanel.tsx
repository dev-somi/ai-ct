"use client";
import Markdown from "./Markdown";
import type { Problem } from "@/lib/types";
import { PROBLEM_TYPE_LABEL } from "@/lib/types";

export default function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line border-l-4 border-l-brand-2 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold">🎯 시나리오</h3>
        <div className="space-y-3 text-sm leading-relaxed text-gray-700">
          <div>
            <p className="font-semibold text-ink">[배경]</p>
            <p className="whitespace-pre-wrap">{problem.scenario.background}</p>
          </div>
          <div>
            <p className="font-semibold text-ink">[문제]</p>
            <p className="whitespace-pre-wrap">{problem.scenario.task}</p>
          </div>
          <div>
            <p className="font-semibold text-ink">[요구사항]</p>
            <ul className="space-y-0.5">
              {problem.scenario.requirements.map((r, i) => (
                <li key={i}>- {r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {problem.references && (
        <section className="rounded-lg border border-line border-l-4 border-l-gray-400 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-[15px] font-bold">📎 참고자료</h3>
          <Markdown className="text-[13px]">{problem.references}</Markdown>
        </section>
      )}

      <section className="rounded-lg border border-line border-l-4 border-l-accent bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-[15px] font-bold">💡 제출 형식</h3>
        <p className="text-sm text-gray-700">
          Text {problem.submitFormat.maxChars.toLocaleString()}자 이내
          {problem.submitFormat.language === "en" ? " · 영어로 작성" : ""}
          {problem.submitFormat.note ? ` (${problem.submitFormat.note})` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          유형: {PROBLEM_TYPE_LABEL[problem.type]} · 권장 시간 {problem.timeLimitMin}분
        </p>
      </section>
    </div>
  );
}
