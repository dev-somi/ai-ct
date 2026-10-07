import { completeText, extractJson } from "@/lib/llm";
import { generationPrompt } from "@/lib/prompts";
import { getSettings, newId } from "@/lib/store";
import type { Problem, ProblemType } from "@/lib/types";

export const maxDuration = 600;

export async function POST(req: Request) {
  const { type, industry, extra } = (await req.json()) as {
    type: ProblemType;
    industry?: string;
    extra?: string;
  };
  const settings = await getSettings();
  try {
    const raw = await completeText(
      settings,
      settings.grader,
      "당신은 기업 채용용 AI 실무역량 평가 문항을 설계하는 출제위원입니다. JSON만 출력합니다.",
      generationPrompt(type, industry ?? "", extra ?? ""),
      req.signal,
    );
    const p = extractJson<Omit<Problem, "id">>(raw);
    const problem: Problem = {
      ...p,
      type,
      id: newId(`gen-${type}-`),
      submitFormat: {
        ...p.submitFormat,
        maxChars: Number(p.submitFormat?.maxChars) || 1500,
        language: p.submitFormat?.language === "en" ? "en" : "ko",
      },
      timeLimitMin: Number(p.timeLimitMin) || 30,
      source: "generated",
    };
    return Response.json(problem);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
