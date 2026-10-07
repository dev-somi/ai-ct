import type { Problem, ProblemType, StageState } from "./types";
import { PROBLEM_TYPE_LABEL } from "./types";

/** 시험 화면 AI 채팅: 실제 시험의 'AI Agent'처럼 문제 맥락을 모르는 범용 업무 보조 AI */
export const CHAT_SYSTEM = `당신은 기업 실무자를 돕는 범용 업무 보조 AI Agent입니다.
- 사용자의 언어(한국어/영어)에 맞춰 답하세요.
- 요청한 문서·분석·아이디어·번역·이메일 초안 등을 실무에 바로 쓸 수 있는 수준으로 작성하세요.
- 사실 정보가 불확실하면 가정임을 밝히세요.
- 마크다운(제목, 목록, 표)을 적절히 사용하세요.`;

export function problemToText(p: Problem) {
  return [
    `# ${p.title} (${PROBLEM_TYPE_LABEL[p.type]})`,
    `## 배경\n${p.scenario.background}`,
    `## 문제\n${p.scenario.task}`,
    `## 요구사항\n${p.scenario.requirements.map((r) => `- ${r}`).join("\n")}`,
    p.references ? `## 참고자료\n${p.references}` : "",
    `## 제출 형식\nText ${p.submitFormat.maxChars.toLocaleString()}자 이내, 작성 언어: ${
      p.submitFormat.language === "en" ? "영어" : "한국어"
    }${p.submitFormat.note ? ` (${p.submitFormat.note})` : ""}`,
    p.rubricHints?.length ? `## 출제 의도(채점 참고)\n${p.rubricHints.map((r) => `- ${r}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const GRADER_SYSTEM = `당신은 SK그룹 'AI 실무역량검사(AICT)'의 채점관입니다.
이 검사는 지원자가 생성형 AI를 활용해 실제 업무 과제(비즈니스 솔루션 설계, 전략적 커뮤니케이션, 업무 문서 작성)를 수행하는 능력을 평가합니다.
결과물의 품질과 AI 활용 과정을 함께 평가하며, 서식(폰트·표 양식)은 점수에 영향을 주지 않습니다.
엄격하지만 공정하게 채점하고, 지원자가 다음 시험에서 점수를 올릴 수 있는 구체적 피드백을 주세요.
반드시 지정된 JSON 하나만 출력하세요.`;

export function gradingPrompt(stage: StageState, elapsedSec: number) {
  const p = stage.problem;
  const msgs = stage.threads.flatMap((t, ti) =>
    t.messages.map((m) => `(채팅${ti + 1}) [${m.role === "user" ? "지원자" : "AI"}] ${m.content}`),
  );
  const userPrompts = stage.threads.flatMap((t) => t.messages.filter((m) => m.role === "user")).length;
  const answerLen = stage.answerText.length;
  const pastedFromChat = stage.pastes.filter((x) => x.fromChat).reduce((s, x) => s + x.chars, 0);
  const pasteRatio = answerLen ? Math.min(1, pastedFromChat / answerLen) : 0;

  return `${problemToText(p)}

---
# 지원자 최종 답안 (${answerLen.toLocaleString()}자 / 제한 ${p.submitFormat.maxChars.toLocaleString()}자)
<answer>
${stage.answerText || "(빈 답안)"}
</answer>

---
# AI 채팅 로그 (프롬프트 ${userPrompts}회)
<chat_log>
${msgs.join("\n\n").slice(0, 60000) || "(AI를 사용하지 않음)"}
</chat_log>

# 과정 지표
- 이 문제 소요 시간: 약 ${Math.round(elapsedSec / 60)}분 (제한 ${p.timeLimitMin}분 기준)
- AI 응답을 답안에 그대로 붙여넣은 비율(추정): ${Math.round(pasteRatio * 100)}%
- 글자수 제한 ${answerLen > p.submitFormat.maxChars ? "초과" : "준수"}

---
# 채점 기준 (총 100점)
1. requirements (30점) 요구사항 충족도: 문제의 [요구사항]을 빠짐없이, 정확히 반영했는가. 참고자료 데이터를 올바르게 활용했는가.
2. logic (20점) 논리·구조: 문제 정의 → 원인/근거 → 해결안 → 기대효과 흐름, 문서 구조의 명료함.
3. specificity (20점) 구체성·실행가능성: 수치·일정·담당·KPI·리스크 대응 등 실무에 바로 쓸 수 있는 수준인가. 일반론에 그치지 않았는가.
4. communication (15점) 독자·톤·커뮤니케이션: 독자(고객, 경영진, 구성원, 해외 파트너 등)에 맞는 어조·언어·설득 전략. 영어 답안이면 비즈니스 영어의 자연스러움.
5. ai_usage (15점) AI 활용 역량: 프롬프트에 맥락·제약·형식을 구체적으로 줬는가, 결과를 검증·보완하며 반복 개선했는가, AI 출력을 그대로 복붙하지 않고 자신의 판단으로 편집했는가. AI를 쓰지 않았으면 낮게.

# 출력 형식 (JSON만)
{
  "scores": [
    {"key":"requirements","label":"요구사항 충족도","score":0,"max":30,"comment":"근거와 함께 2~3문장"},
    {"key":"logic","label":"논리·구조","score":0,"max":20,"comment":"..."},
    {"key":"specificity","label":"구체성·실행가능성","score":0,"max":20,"comment":"..."},
    {"key":"communication","label":"독자·톤·커뮤니케이션","score":0,"max":15,"comment":"..."},
    {"key":"ai_usage","label":"AI 활용 역량","score":0,"max":15,"comment":"..."}
  ],
  "summary": "총평 2~3문장",
  "strengths": ["잘한 점", "..."],
  "improvements": ["구체적 개선점 (무엇을 어떻게)", "..."],
  "betterPrompts": ["이 문제에서 썼으면 좋았을 프롬프트 예시 (그대로 복사해 쓸 수 있게)", "..."],
  "modelAnswer": "제출 형식(언어·글자수 제한)을 지킨 모범 답안 전문 (일반 텍스트, 줄바꿈 사용)"
}`;
}

export function generationPrompt(type: ProblemType, industry: string, extra: string) {
  const typeGuide: Record<ProblemType, string> = {
    solution:
      "AI를 활용한 비즈니스 솔루션 설계. 글로벌 업무 상황(해외 법인·고객·시장)에서 데이터(표)를 분석해 문제를 정의하고 AI 기반 해결안/실행계획을 설계하게 한다. 참고자료에 마크다운 표 형태의 수치 데이터(2개 이상)와 이해관계자 코멘트를 포함한다.",
    communication:
      "전략적 커뮤니케이션. 해외 고객사/파트너/본사 경영진 등에게 민감한 상황(지연, 가격 인상, 협상, 사과, 설득)을 전달하는 이메일·메시지·보고를 작성하게 한다. 참고자료에 상대방이 보낸 영문 메일 원문과 사내 사실관계를 포함한다. 답안 언어는 영어 또는 한국어로 지정한다.",
    document:
      "업무 문서 작성형. 요건서, 기획안, 보고서, 공지문, Letter 등 실무 문서를 작성하게 한다. 참고자료에 회의록·현황·제약사항을 포함하고, 일부 정보는 주어지지 않아 AI Agent를 통해 찾아 적용하도록 한다.",
  };
  return `SK그룹 'AI 실무역량검사(AICT)' 연습용 문제를 1개 만들어 주세요.

유형: ${PROBLEM_TYPE_LABEL[type]} — ${typeGuide[type]}
산업/도메인: ${industry || "자유 (금융·제조·통신·헬스케어·유통·에너지 중 택1)"}
${extra ? `추가 조건: ${extra}` : ""}

실제 시험 문항의 형식: [배경] 회사/상황 설명 → [문제] 과제 지시("주어진 AI Tool을 활용하여 ~를 작성해 주세요") → [요구사항] 3~5개 불릿 → 제출 형식(Text N자 이내).
가상의 회사명을 사용하고, 실존 기업을 사칭하지 마세요. 숫자와 사실관계는 내부적으로 일관되게 만드세요.

JSON 하나만 출력:
{
  "type": "${type}",
  "title": "짧은 문제 제목",
  "industry": "도메인",
  "scenario": {
    "background": "배경 (3~6문장)",
    "task": "문제 지시문",
    "requirements": ["요구사항1", "요구사항2", "요구사항3"]
  },
  "references": "참고자료 (마크다운: 표, 메일 원문, 회의록 등)",
  "submitFormat": {"maxChars": 1500, "language": "ko", "note": "선택"},
  "timeLimitMin": 30,
  "rubricHints": ["채점 포인트1", "채점 포인트2", "채점 포인트3"]
}`;
}
